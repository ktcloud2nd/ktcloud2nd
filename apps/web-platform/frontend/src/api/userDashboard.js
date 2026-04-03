const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'The request could not be completed.');
  }

  return data;
}

export async function fetchUserDashboard(vehicleId) {
  const encodedVehicleId = encodeURIComponent(vehicleId);
  return request(`/user/dashboard?vehicleId=${encodedVehicleId}`);
}
