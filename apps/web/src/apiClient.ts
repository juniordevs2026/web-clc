export const API = 'http://localhost:4000/api';

export function authHeaders(extra: Record<string, string> = {}) {
  const token = sessionStorage.getItem('clc_token');
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

export function authFetch(path: string, options: RequestInit = {}) {
  return fetch(`${API}${path}`, { ...options, headers: authHeaders((options.headers as Record<string, string>) ?? {}) });
}
