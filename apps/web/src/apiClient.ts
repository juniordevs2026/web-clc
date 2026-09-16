export const API = 'https://web-clc-api.vercel.app/api';

export function authHeaders(extra: Record<string, string> = {}) {
  const token = sessionStorage.getItem('clc_token');
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

export function authFetch(path: string, options: RequestInit = {}) {
  return fetch(`${API}${path}`, { ...options, headers: authHeaders((options.headers as Record<string, string>) ?? {}) });
}
