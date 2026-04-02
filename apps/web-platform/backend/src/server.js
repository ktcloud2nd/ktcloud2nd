import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { query, withTransaction } from './db.js';
import { initSchema } from './initSchema.js';
import {
  getAnomalyEmbedUrls,
  getEmbedDefinitions,
  getVehicleEmbedUrls,
  validateQuickSightConfig
} from './quicksight.js';
import { getGrafanaEmbedPayload } from './grafana.js';
import { loadUserDashboard } from './userDashboard.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const appTarget = (process.env.APP_TARGET || 'all').toLowerCase();
const allowedOrigins =
  process.env.CORS_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) || [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:8082'
  ];

function isEnabledForTarget(...targets) {
  return appTarget === 'all' || targets.includes(appTarget);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    }
  })
);
app.use(express.json());

function handleQuickSightError(response, error, target) {
  if (error.code === 'QUICKSIGHT_CONFIG_MISSING') {
    response.status(503).json({
      message: `QuickSight ${target} embedding configuration is incomplete.`,
      missingFields: error.details,
      panels: getEmbedDefinitions(target)
    });
    return;
  }

  response.status(500).json({
    message: `Failed to generate QuickSight ${target} embed URLs.`,
    details: error.message
  });
}

app.get('/api/health', async (_request, response) => {
  const result = await query('SELECT NOW() AS now');
  response.json({ ok: true, now: result.rows[0].now, appTarget });
});

if (isEnabledForTarget('login')) {
  app.get('/api/model-codes', async (_request, response) => {
    const result = await query(
      'SELECT code, model_name AS "modelName", image_url AS "imageUrl" FROM model_codes ORDER BY code ASC'
    );
    response.json(result.rows);
  });

  app.post('/api/auth/signup', async (request, response) => {
    const { userId, password, userName, vehicleId, modelCode } = request.body;

    if (!userId || !password || !userName || !modelCode) {
      response.status(400).json({
        message: 'userId, password, userName, and modelCode are required.'
      });
      return;
    }

    const numericModelCode = Number(modelCode);

    if (![1, 2, 3, 4].includes(numericModelCode)) {
      response.status(400).json({
        message: 'modelCode must be one of 1, 2, 3, or 4.'
      });
      return;
    }

    if (!vehicleId) {
      response.status(400).json({
        message: 'vehicleId is required.'
      });
      return;
    }

    const duplicateUser = await query(
      'SELECT id FROM accounts WHERE user_id = $1',
      [userId]
    );

    if (duplicateUser.rowCount > 0) {
      response.status(409).json({
        code: 'DUPLICATE_USER_ID',
        message: 'That userId is already in use.'
      });
      return;
    }

    const duplicateVehicle = await query(
      'SELECT id FROM vehicle_master WHERE vehicle_id = $1',
      [vehicleId]
    );

    if (duplicateVehicle.rowCount > 0) {
      response.status(409).json({
        code: 'DUPLICATE_VEHICLE_ID',
        message: 'That vehicleId is already in use.'
      });
      return;
    }

    const createdUser = await withTransaction(async (client) => {
      const accountResult = await client.query(
        `
          INSERT INTO accounts (user_id, password_hash, role, user_name)
          VALUES ($1, $2, 'user', $3)
          RETURNING id, user_id AS "userId", user_name AS "userName", role;
        `,
        [userId, password, userName]
      );

      await client.query(
        `
          INSERT INTO vehicle_master (vehicle_id, model_code)
          VALUES ($1, $2)
        `,
        [vehicleId, numericModelCode]
      );

      await client.query(
        `
          INSERT INTO user_vehicle_mapping (account_id, vehicle_id)
          VALUES ($1, $2)
        `,
        [accountResult.rows[0].id, vehicleId]
      );

      const userResult = await client.query(
        `
          SELECT
            a.id,
            a.user_id AS "userId",
            a.user_name AS "userName",
            a.role,
            v.vehicle_id AS "vehicleId",
            v.model_code AS "modelCode"
          FROM accounts a
          LEFT JOIN user_vehicle_mapping uvm ON uvm.account_id = a.id
          LEFT JOIN vehicle_master v ON v.vehicle_id = uvm.vehicle_id
          WHERE a.id = $1
        `,
        [accountResult.rows[0].id]
      );

      return userResult.rows[0];
    });

    response.status(201).json({
      message: 'Sign up completed successfully.',
      user: createdUser
    });
  });

  app.post('/api/auth/login', async (request, response) => {
    const { userId, password } = request.body;

    if (!userId || !password) {
      response.status(400).json({
        message: 'userId and password are required.'
      });
      return;
    }

    const result = await query(
      `
        SELECT
          a.id,
          a.user_id AS "userId",
          a.user_name AS "userName",
          a.role,
          v.vehicle_id AS "vehicleId",
          v.model_code AS "modelCode"
        FROM accounts a
        LEFT JOIN user_vehicle_mapping uvm
          ON uvm.account_id = a.id
          AND a.role = 'user'
        LEFT JOIN vehicle_master v ON v.vehicle_id = uvm.vehicle_id
        WHERE a.user_id = $1 AND a.password_hash = $2
      `,
      [userId, password]
    );

    if (result.rowCount === 0) {
      response.status(401).json({
        message: 'Invalid userId or password.'
      });
      return;
    }

    response.json({
      role: result.rows[0].role,
      user: result.rows[0]
    });
  });
}

if (isEnabledForTarget('operator')) {
  app.get('/api/grafana/embed', (_request, response) => {
    response.json(getGrafanaEmbedPayload());
  });

  app.get('/api/anomalies/latest-alert', async (_request, response) => {
    try {
      const result = await query(
        `
          SELECT
            vehicle_id AS "vehicleId",
            anomaly_type AS "anomalyType",
            description,
            evidence,
            TO_CHAR(TO_TIMESTAMP(occurred_at), 'YYYY-MM-DD HH24:MI:SS') AS "occurredAtDt"
          FROM vehicle_anomaly_alerts
          ORDER BY occurred_at DESC
          LIMIT 1
        `
      );

      response.json({
        alert: result.rows[0] || null
      });
    } catch (error) {
      response.status(500).json({
        message: 'Failed to load the latest anomaly alert.',
        details: error.message
      });
    }
  });

  app.get('/api/quicksight/anomaly-embeds', async (_request, response) => {
    try {
      const embeds = await getAnomalyEmbedUrls();
      response.json({
        panels: embeds
      });
    } catch (error) {
      handleQuickSightError(response, error, 'anomaly');
    }
  });

  app.get('/api/quicksight/vehicle-embeds', async (_request, response) => {
    try {
      const embeds = await getVehicleEmbedUrls();
      response.json({
        panels: embeds
      });
    } catch (error) {
      handleQuickSightError(response, error, 'vehicle');
    }
  });

  app.get('/api/quicksight/anomaly-embeds/status', (_request, response) => {
    const validation = validateQuickSightConfig('anomaly');
    response.json(validation);
  });

  app.get('/api/quicksight/vehicle-embeds/status', (_request, response) => {
    const validation = validateQuickSightConfig('vehicle');
    response.json(validation);
  });
}

if (isEnabledForTarget('user')) {
  app.get('/api/user/dashboard', async (request, response) => {
    const userId = String(request.query.userId || '').trim();
    const sessionUserId = String(request.header('x-user-id') || '').trim();
    const sessionRole = String(request.header('x-user-role') || '').trim().toLowerCase();

    if (!userId) {
      response.status(400).json({
        message: 'userId query parameter is required.'
      });
      return;
    }

    if (!sessionUserId || sessionRole !== 'user') {
      response.status(401).json({
        message: 'Authenticated user context is required.'
      });
      return;
    }

    if (sessionUserId !== userId) {
      response.status(403).json({
        message: 'You are not allowed to access another user dashboard.'
      });
      return;
    }

    try {
      const dashboard = await loadUserDashboard(userId);

      if (!dashboard) {
        response.status(404).json({
          message: 'User dashboard data could not be found.'
        });
        return;
      }

      response.json(dashboard);
    } catch (error) {
      response.status(500).json({
        message: 'User dashboard could not be loaded.',
        details: error.message
      });
    }
  });
}

async function startServer() {
  await initSchema();

  app.listen(port, () => {
    console.log(`Backend server listening on http://localhost:${port} (target: ${appTarget})`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start backend server', error);
  process.exit(1);
});
