import { getStoredSession } from '../utils/authStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export async function fetchUserDashboard(userId) {
  const session = getStoredSession();
  const response = await fetch(
    `${API_BASE_URL}/user/dashboard?userId=${encodeURIComponent(userId)}`,
    {
      headers: {
        'x-user-id': String(session?.user?.userId || ''),
        'x-user-role': String(session?.role || '')
      }
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'The user dashboard could not be loaded.');
  }

  return data;
}
