import axios from 'axios';
import { PlatformAdapter } from '@/platform/platform-adapter';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const initData = PlatformAdapter.getInitData();
  if (initData) {
    config.headers['X-Init-Data'] = initData;
  }
  const token = localStorage.getItem('bm_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Anti-loop: не делаем reload чаще 1 раза в 5 секунд.
 * Если токена и так нет — reload бессмысленен.
 */
const RELOAD_COOLDOWN_KEY = 'bm_last_401_reload';
const RELOAD_COOLDOWN_MS = 5000;

function shouldReloadOn401(): boolean {
  // Если токена нет — перезагрузка бессмысленна (и создаёт бесконечный цикл)
  const hadToken = localStorage.getItem('bm_access_token');
  if (!hadToken) return false;

  // Анти-луп: не чаще раза в 5 сек
  const lastReload = Number(sessionStorage.getItem(RELOAD_COOLDOWN_KEY) || '0');
  if (Date.now() - lastReload < RELOAD_COOLDOWN_MS) return false;

  return true;
}

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      const doReload = shouldReloadOn401();

      localStorage.removeItem('bm_access_token');
      localStorage.removeItem('bm_user_role');
      localStorage.removeItem('bm_master_id');
      localStorage.removeItem('sa_original_token');

      if (doReload) {
        sessionStorage.setItem(RELOAD_COOLDOWN_KEY, String(Date.now()));
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
