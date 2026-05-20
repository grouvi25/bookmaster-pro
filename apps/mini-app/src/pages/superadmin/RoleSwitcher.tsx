import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, UserCircle, ArrowRightLeft } from 'lucide-react';
import { authApi } from '@/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import { useAuthStore } from '@/stores/auth';

const ORIGINAL_TOKEN_KEY = 'sa_original_token';

/** Кнопки переключения роли — отображаются в заголовке суперадминки. */
export function RoleSwitcher() {
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
  const { setAuth, token } = useAuthStore();

  const switchToRole = async (targetRole: 'master' | 'client') => {
    if (!token || switching) return;
    setSwitching(true);
    try {
      const { data } = await authApi.switchRole(targetRole);
      const newToken = data.access_token;
      localStorage.setItem(ORIGINAL_TOKEN_KEY, token);
      setAuth(newToken, targetRole, data.master_id ?? null);
      navigate(targetRole === 'master' ? '/master' : '/client');
    } catch {
      toast.error('Не удалось переключить роль');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => switchToRole('master')}
        disabled={switching}
        className="flex-1 flex items-center justify-center gap-2 p-3 bg-brand-500/10 text-brand-600 rounded-btn text-sm font-medium active:scale-[0.97] transition-all disabled:opacity-50"
      >
        <Wrench className="w-4 h-4" />
        {switching ? '...' : 'Режим мастера'}
      </button>
      <button
        onClick={() => switchToRole('client')}
        disabled={switching}
        className="flex-1 flex items-center justify-center gap-2 p-3 bg-status-info/10 text-status-info rounded-btn text-sm font-medium active:scale-[0.97] transition-all disabled:opacity-50"
      >
        <UserCircle className="w-4 h-4" />
        {switching ? '...' : 'Режим клиента'}
      </button>
    </div>
  );
}

/** Плавающая кнопка возврата в суперадминку, когда работаем под master/client. */
export function SuperadminReturnButton() {
  const navigate = useNavigate();
  const { role, setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const originalToken = localStorage.getItem(ORIGINAL_TOKEN_KEY);
  if (role === 'superadmin' || !originalToken) return null;

  const handleReturn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      setAuth(originalToken, 'superadmin');
      const { data } = await authApi.switchRole('superadmin');
      localStorage.removeItem(ORIGINAL_TOKEN_KEY);
      setAuth(data.access_token, 'superadmin');
      navigate('/superadmin');
    } catch {
      localStorage.removeItem(ORIGINAL_TOKEN_KEY);
      setAuth(originalToken, 'superadmin');
      navigate('/superadmin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReturn}
      disabled={loading}
      className="fixed top-4 right-4 z-[100] flex items-center gap-1.5 px-3 py-2 bg-status-danger text-white rounded-full text-xs font-semibold shadow-lg active:scale-95 transition-all disabled:opacity-50"
    >
      <ArrowRightLeft className="w-3.5 h-3.5" />
      {loading ? '...' : 'Суперадмин'}
    </button>
  );
}
