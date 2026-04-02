import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { getStoredSession } from '../../utils/authStorage';

const assetBaseUrl = import.meta.env.BASE_URL || '/';
const DEFAULT_WEATHER_COORDS = {
  latitude: 37.5665,
  longitude: 126.978
};

const MODEL_IMAGE_MAP = {
  1: {
    name: 'Avante',
    imageUrl: `${assetBaseUrl}models/avante.png`
  },
  2: {
    name: 'Grandeur',
    imageUrl: `${assetBaseUrl}models/grandeur.png`
  },
  3: {
    name: 'Santafe',
    imageUrl: `${assetBaseUrl}models/santafe.png`
  },
  4: {
    name: 'Tucson',
    imageUrl: `${assetBaseUrl}models/tucson.png`
  }
};

const WEATHER_LABELS = {
  0: 'Clear',
  1: 'Mostly Clear',
  2: 'Partly Cloudy',
  3: 'Cloudy',
  45: 'Fog',
  48: 'Rime Fog',
  51: 'Light Drizzle',
  53: 'Drizzle',
  55: 'Heavy Drizzle',
  61: 'Light Rain',
  63: 'Rain',
  65: 'Heavy Rain',
  71: 'Light Snow',
  73: 'Snow',
  75: 'Heavy Snow',
  80: 'Rain Showers',
  81: 'Rain Showers',
  82: 'Heavy Showers',
  95: 'Thunderstorm'
};

function getWeatherIcon(code, isDay) {
  if (code === 0) {
    return isDay ? '\u2600\uFE0F' : '\uD83C\uDF19';
  }

  if ([1, 2].includes(code)) {
    return isDay ? '\u26C5' : '\u2601\uFE0F';
  }

  if ([3, 45, 48].includes(code)) {
    return '\u2601\uFE0F';
  }

  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
    return '\uD83C\uDF27\uFE0F';
  }

  if ([71, 73, 75].includes(code)) {
    return '\u2744\uFE0F';
  }

  if (code === 95) {
    return '\u26C8\uFE0F';
  }

  return '\uD83C\uDF24\uFE0F';
}

/* ✅ 추가된 함수 (로케이션용) */
async function getLocationLabel(latitude, longitude) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
    );

    if (!response.ok) {
      return 'Seoul';
    }

    const data = await response.json();
    const address = data.address || {};

    return (
      address.suburb ||
      address.city_district ||
      address.neighbourhood ||
      address.town ||
      address.city ||
      'Seoul'
    );
  } catch {
    return 'Seoul';
  }
}

function UserDashboardPage() {
  const session = getStoredSession();
  const user = session?.user;
  const vehicleModel = MODEL_IMAGE_MAP[Number(user?.modelCode)] || null;
  const greetingName = user?.userName || 'User';
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather(latitude, longitude) {
      try {
        /* ✅ 여기만 수정됨 (Promise.all 추가) */
        const [weatherResponse, locationLabel] = await Promise.all([
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day&timezone=auto`
          ),
          getLocationLabel(latitude, longitude)
        ]);

        if (!weatherResponse.ok) {
          return;
        }

        const data = await weatherResponse.json();
        const current = data.current;

        if (!current || cancelled) {
          return;
        }

        setWeather({
          temperature: current.temperature_2m.toFixed(1),
          label: WEATHER_LABELS[current.weather_code] || 'Weather',
          icon: getWeatherIcon(current.weather_code, current.is_day === 1),
          locationLabel // 👈 timezone 대신 여기로 변경
        });
      } catch {
        if (!cancelled) {
          setWeather(null);
        }
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          loadWeather(position.coords.latitude, position.coords.longitude);
        },
        () => {
          loadWeather(DEFAULT_WEATHER_COORDS.latitude, DEFAULT_WEATHER_COORDS.longitude);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
      );
    } else {
      loadWeather(DEFAULT_WEATHER_COORDS.latitude, DEFAULT_WEATHER_COORDS.longitude);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout
      role="USER"
      metaContent={weather ? (
        <div className="dashboard-meta-line">
          {`${weather.icon} ${weather.temperature}°C · ${weather.locationLabel}`}
        </div>
      ) : null}
      title={"내 차량 대시보드"}
      description={`${greetingName}님, 좋은 하루 되세요!`}
    >
      {vehicleModel ? (
        <section className="user-vehicle-hero">
          <h2>{vehicleModel.name}</h2>
          <img
            src={vehicleModel.imageUrl}
            alt={vehicleModel.name}
            className="user-vehicle-image"
          />
        </section>
      ) : null}

      <div className="card-grid">
        <div className="card">Trip Summary</div>
        <div className="card">Vehicle Status</div>
        <div className="card">Alert Center</div>
        <div className="card">Recent Activity</div>
      </div>
    </DashboardLayout>
  );
}

export default UserDashboardPage;