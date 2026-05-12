import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/endpoints';
import { useAuthStore } from '@/stores/auth';
import { PlatformAdapter } from '@/platform/platform-adapter';
import { Scissors, UserCircle } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [selectedRole, setSelectedRole] = useState<'master' | 'client' | null>(null);
  const [specialization, setSpecialization] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!selectedRole) return;
    setLoading(true);
    setError('');

    try {
      const initData = PlatformAdapter.getInitData();
      const resp = await authApi.register({
        init_data: initData || '',
        role: selectedRole,
        ...(selectedRole === 'master' && specialization ? { specialization } : {}),
      });
      const data = resp.data;
      setAuth(data.access_token, data.role, data.master_id);
      navigate(data.role === 'master' ? '/master' : '/', { replace: true });
    } catch {
      setError('Ошибка регистрации. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-tg-bg text-tg-text p-6 animate-fade-in">
      <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
        <Scissors className="w-8 h-8 text-brand-500" strokeWidth={1.8} />
      </div>
      <h1 className="text-2xl font-bold mb-2">Добро пожаловать!</h1>
      <p className="text-tg-hint text-center text-sm mb-8">
        Выберите, как вы хотите использовать BookMaster Pro
      </p>

      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => setSelectedRole('master')}
          className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
            selectedRole === 'master'
              ? 'border-tg-button bg-tg-button/10'
              : 'border-gray-200 bg-tg-secondary'
          }`}
        >
          <Scissors className="w-6 h-6 text-brand-500 mb-1" strokeWidth={1.8} />
          <div className="font-semibold">Я мастер</div>
          <div className="text-tg-hint text-xs mt-1">
            Принимайте записи, управляйте расписанием, используйте AI-помощника
          </div>
        </button>

        <button
          onClick={() => setSelectedRole('client')}
          className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
            selectedRole === 'client'
              ? 'border-tg-button bg-tg-button/10'
              : 'border-gray-200 bg-tg-secondary'
          }`}
        >
          <UserCircle className="w-6 h-6 text-brand-500 mb-1" strokeWidth={1.8} />
          <div className="font-semibold">Я клиент</div>
          <div className="text-tg-hint text-xs mt-1">
            Записывайтесь к мастерам, копите баллы, получайте напоминания
          </div>
        </button>
      </div>

      {selectedRole === 'master' && (
        <div className="w-full max-w-sm mt-4">
          <input
            type="text"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="Ваша специализация (напр. маникюр, барбер...)"
            className="w-full px-4 py-3 bg-tg-secondary rounded-xl text-sm outline-none"
          />
        </div>
      )}

      {error && (
        <p className="text-red-500 text-sm mt-3">{error}</p>
      )}

      <button
        onClick={handleRegister}
        disabled={!selectedRole || loading}
        className="w-full max-w-sm mt-6 py-3 bg-tg-button text-tg-button-text rounded-xl font-medium text-sm disabled:opacity-50"
      >
        {loading ? 'Регистрация...' : 'Продолжить'}
      </button>
    </div>
  );
}
