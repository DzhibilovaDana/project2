/**
 * Базовый URL API. Для продакшена: REACT_APP_API_URL=https://your-host:5050
 */
export const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5050').replace(/\/$/, '');

const TOKEN_KEY = 'api_token';
const USER_KEY = 'api_user';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredAuth(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * @param {string} path - путь с ведущим слэшем, например /api/pins/config
 * @param {object} options
 * @param {string} [options.method]
 * @param {object} [options.headers] - дополнительные заголовки
 * @param {object} [options.json] - тело как JSON (выставит Content-Type)
 * @param {BodyInit} [options.body] - сырое тело (например FormData)
 * @param {boolean} [options.auth] - по умолчанию true: добавить Bearer из localStorage
 */
export async function apiFetch(path, options = {}) {
  const { method = 'GET', headers = {}, json, body, auth = true } = options;
  const h = new Headers(headers);
  if (json !== undefined) {
    h.set('Content-Type', 'application/json');
  }
  if (auth) {
    const token = getStoredToken();
    if (token) h.set('Authorization', `Bearer ${token}`);
  }
  const init = { method, headers: h };
  if (json !== undefined) init.body = JSON.stringify(json);
  else if (body !== undefined) init.body = body;

  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, init);
}
