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

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('bm_access_token');
      localStorage.removeItem('bm_user_role');
      localStorage.removeItem('bm_master_id');
      localStorage.removeItem('sa_original_token');
      // Перезагрузка — пользователь увидит экран авторизации вместо сломанного UI
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
