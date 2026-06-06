import { create } from 'zustand';
import type { PlatformUser } from '@/platform/platform-adapter';

type Role = 'client' | 'master' | 'moderator' | 'superadmin' | null;

// localStorage-ключи (с префиксом bm_). Старый 'access_token' больше не
// используется и устареет сам.
const TOKEN_KEY = 'bm_access_token';
const ROLE_KEY = 'bm_user_role';
const MASTER_ID_KEY = 'bm_master_id';

/**
 * Восстановление роли из localStorage при старте.
 * superadmin и moderator НИКОГДА не восстанавливаются из кэша — эти роли
 * подтверждаются только сервером через identify(). Это защищает от того,
 * что stale-роль в localStorage даст доступ к привилегированным экранам.
 */
function readPersistedRole(): Role {
  const v = localStorage.getItem(ROLE_KEY);
  if (v === 'superadmin' || v === 'moderator') return null;
  if (v === 'client' || v === 'master') return v;
  return null;
}

function readPersistedMasterId(): number | null {
  const v = localStorage.getItem(MASTER_ID_KEY);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface AuthState {
  user: PlatformUser | null;
  role: Role;
  token: string | null;
  masterId: number | null;
  setUser: (user: PlatformUser | null) => void;
  setAuth: (token: string, role: Role, masterId?: number | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: readPersistedRole(),
  token: localStorage.getItem(TOKEN_KEY),
  masterId: readPersistedMasterId(),
  setUser: (user) => set({ user }),
  setAuth: (token, role, masterId = null) => {
    localStorage.setItem(TOKEN_KEY, token);
    // Привилегированные роли в localStorage не пишем.
    if (role === 'master' || role === 'client') {
      localStorage.setItem(ROLE_KEY, role);
    } else {
      localStorage.removeItem(ROLE_KEY);
    }
    if (masterId != null) {
      localStorage.setItem(MASTER_ID_KEY, String(masterId));
    } else {
      localStorage.removeItem(MASTER_ID_KEY);
    }
    set({ token, role, masterId });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(MASTER_ID_KEY);
    // Очищаем сохранённый superadmin-токен при выходе/смене аккаунта,
    // чтобы он не "заражал" другие аккаунты через SuperadminReturnButton.
    localStorage.removeItem('sa_original_token');
    set({ token: null, role: null, user: null, masterId: null });
  },
}));
