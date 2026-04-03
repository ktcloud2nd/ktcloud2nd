/*
[Lambda 코드]
- PostgreSQL 접속
- alert_delivery_state애서 마지막 id 조회
- vehicle_anomaly_alerts에서 신규 row 조회
- Slack 전송 후 마지막 id 갱신 
*/

import pg from 'pg';

const { Pool } = pg;

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function createSslConfig() {
  if (!isTruthy(process.env.DB_SSL)) {
    return undefined;
  }

  return {
    rejectUnauthorized: !['false', '0', 'no', 'off'].includes(
      String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase()
    )
  };
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ...(createSslConfig() ? { ssl: createSslConfig() } : {})
});

const CONSUMER_NAME = process.env.CONSUMER_NAME || 'slack_anomaly_notifier';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

function formatMessage(alert) {
  return {
    text:
      `[이상탐지 알림]\n` +
      `차량: ${alert.vehicle_id}\n` +
      `유형: ${alert.anomaly_type || '-'}\n` +
      `설명: ${alert.description || '-'}\n` +
      `근거: ${alert.evidence || '-'}\n` +
      `발생시각: ${alert.occurred_at || '-'}`
  };
}

async function sendSlackMessage(payload) {
  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack send failed: ${response.status} ${text}`);
  }
}

async function ensureConsumerState(client) {
  await client.query(
    `
      INSERT INTO alert_delivery_state (consumer_name, last_sent_id)
      VALUES ($1, 0)
      ON CONFLICT (consumer_name) DO NOTHING
    `,
    [CONSUMER_NAME]
  );
}

export const handler = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureConsumerState(client);

    const stateResult = await client.query(
      `
        SELECT last_sent_id
        FROM alert_delivery_state
        WHERE consumer_name = $1
        FOR UPDATE
      `,
      [CONSUMER_NAME]
    );

    const lastSentId = stateResult.rows[0]?.last_sent_id ?? 0;

    const alertResult = await client.query(
      `
        SELECT id, vehicle_id, anomaly_type, description, evidence, occurred_at, alert_time
        FROM vehicle_anomaly_alerts
        WHERE id > $1
        ORDER BY id ASC
        LIMIT 100
      `,
      [lastSentId]
    );

    const alerts = alertResult.rows;
    await client.query('COMMIT');

    if (alerts.length === 0) {
      return { ok: true, message: 'No new alerts' };
    }

    for (const alert of alerts) {
      await sendSlackMessage(formatMessage(alert));
    }

    const maxId = alerts[alerts.length - 1].id;

    await client.query('BEGIN');
    await ensureConsumerState(client);
    await client.query(
      `
        INSERT INTO alert_delivery_state (consumer_name, last_sent_id, updated_at)
        VALUES ($2, $1, CURRENT_TIMESTAMP)
        ON CONFLICT (consumer_name) DO UPDATE
        SET last_sent_id = EXCLUDED.last_sent_id,
            updated_at = CURRENT_TIMESTAMP
      `,
      [maxId, CONSUMER_NAME]
    );

    await client.query('COMMIT');
    return { ok: true, sent: alerts.length, lastSentId: maxId };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackError) {
      // Ignore rollback failures after the transaction has already been closed.
    }
    throw error;
  } finally {
    client.release();
  }
};
