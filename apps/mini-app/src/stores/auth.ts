import { create } from 'zustand';
import type { PlatformUser } from '@/platform/platform-adapter';

type Role = 'client' | 'master' | 'superadmin' | null;

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
  role: null,
  token: localStorage.getItem('access_token'),
  masterId: null,
  setUser: (user) => set({ user }),
  setAuth: (token, role, masterId = null) => {
    localStorage.setItem('access_token', token);
    set({ token, role, masterId });
  },
  logout: () => {
    localStorage.removeItem('access_token');
    set({ token: null, role: null, user: null, masterId: null });
  },
}));
