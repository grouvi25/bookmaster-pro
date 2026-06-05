import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, promoApi } from '@/api/endpoints';
import { useAuthStore } from '@/stores/auth';
import { PlatformAdapter } from '@/platform/platform-adapter';
import { Scissors, UserCircle, ChevronLeft, Link2, ArrowRight } from 'lucide-react';
import Button from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';
import { useMutation } from '@tanstack/react-query';

type Step = 'have-account' | 'enter-link-code' | 'role' | 'master-form' | 'client-form';

const SPECIALIZATIONS = [
  'Маникюр/педикюр', 'Брови и ресницы', 'Массаж',
  'Косметология', 'Парикмахер', 'Фотограф',
  'Репетитор', 'Фитнес-тренер', 'Другое',
];

export default function Register() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState<Step>('have-account');
  const [linkCode, setLinkCode] = useState('');
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplying, setPromoApplying] = useState(false);

  const linkMutation = useMutation({
    mutationFn: async (code: string) => {
      const resp = await authApi.applyLinkCode(code);
      return resp;
    },
    onSuccess: async () => {
      toast.success('Аккаунт привязан! Входим\u2026');
      try {
        const initData = PlatformAdapter.getInitData();
        if (initData) {
          const resp = await authApi.identify(initData);
          const data = resp.data;
          if (data.access_token) {
            setAuth(data.access_token, data.role, data.master_id);
            navigate(data.role === 'master' ? '/master' : '/', { replace: true });
          }
        }
      } catch {
        toast.error('Войдите заново');
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Неверный код или истёк');
    },
  });

  const handleRegisterMaster = async () => {
    if (!name.trim() || !specialization || !city.trim()) {
      toast.error('Заполните все обязательные поля');
      return;
    }
    setLoading(true);
    try {
      const initData = PlatformAdapter.getInitData();
      const user = await PlatformAdapter.getUser();
      const resp = await authApi.register({
        init_data: initData || '',
        role: 'master',
        name: name.trim(),
        specialization,
        city: city.trim(),
        platform: PlatformAdapter.platform,
        platform_id: user?.id,
      });
      const data = resp.data;
      setAuth(data.access_token, data.role, data.master_id);

      if (promoCode.trim()) {
        setPromoApplying(true);
        try {
          await promoApi.apply(promoCode.trim());
          toast.success('Промо-код применён!');
        } catch {
          toast.error('Промо-код недействителен');
        } finally {
          setPromoApplying(false);
        }
      }

      toast.success('Добро пожаловать!');
      navigate('/master', { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка регистрации. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterClient = async () => {
    if (!name.trim()) {
      toast.error('Введите имя');
      return;
    }
    setLoading(true);
    try {
      const initData = PlatformAdapter.getInitData();
      const user = await PlatformAdapter.getUser();
      const resp = await authApi.register({
        init_data: initData || '',
        role: 'client',
        name: name.trim(),
        platform: PlatformAdapter.platform,
        platform_id: user?.id,
        ...(phone ? { phone } : {}),
      });
      const data = resp.data;
      setAuth(data.access_token, data.role, data.master_id);
      toast.success('Добро пожаловать!');
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Ошибка регистрации.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'have-account') {
    return (
      <div className="flex flex-col min-h-screen px-screen-x pt-16 pb-8 gap-6 animate-fade-in">
        <div className="text-center">
          <div className="text-5xl mb-4">\ud83d\udd17</div>
          <h1 className="text-xl font-bold mb-2">
            Уже пользуетесь BookMaster Pro?
          </h1>
          <p className="text-tg-hint text-sm">
            Если у вас есть аккаунт в Telegram или MAX —
            привяжите его, чтобы видеть все свои данные здесь.
          </p>
        </div>

        <div className="flex-1" />

        <div className="flex flex-col gap-3">
          <button
            onClick={() => setStep('enter-link-code')}
            className="bg-surface-elevated p-card-inner rounded-card text-left active:scale-[0.98] transition-all duration-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-card bg-brand-500/10 flex items-center justify-center">
                <Link2 className="w-6 h-6 text-brand-500" strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-base">Да, привязать аккаунт</div>
                <div className="text-sm text-tg-hint">Введите код из другого мессенджера</div>
              </div>
              <ArrowRight className="w-4 h-4 text-tg-hint" />
            </div>
          </button>

          <button
            onClick={() => setStep('role')}
            className="bg-surface-elevated p-card-inner rounded-card text-left active:scale-[0.98] transition-all duration-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-card bg-accent-emerald/10 flex items-center justify-center">
                <UserCircle className="w-6 h-6 text-accent-emerald" strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-base">Нет, создать новый</div>
                <div className="text-sm text-tg-hint">Зарегистрироваться с нуля</div>
              </div>
              <ArrowRight className="w-4 h-4 text-tg-hint" />
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'enter-link-code') {
    return (
      <div className="flex flex-col min-h-screen px-screen-x pt-6 pb-8 gap-5 animate-fade-in">
        <button
          onClick={() => setStep('have-account')}
          className="text-tg-link self-start flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Назад
        </button>

        <div className="text-center">
          <div className="text-4xl mb-3">\ud83d\udd11</div>
          <h2 className="text-xl font-bold mb-2">Введите код привязки</h2>
          <p className="text-tg-hint text-sm">
            Откройте BookMaster в другом мессенджере →{' '}
            Настройки → Связанные аккаунты → «Получить код»
          </p>
        </div>

        <div className="flex-1" />

        <input
          value={linkCode}
          onChange={(e) => setLinkCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          inputMode="numeric"
          autoFocus
          className="text-center font-mono text-3xl tracking-[0.4em] p-4 rounded-card bg-surface-elevated outline-none"
        />

        <div className="flex-1" />

        <Button
          onClick={() => linkMutation.mutate(linkCode)}
          loading={linkMutation.isPending}
          disabled={linkCode.length !== 6}
          fullWidth
          size="lg"
        >
          Привязать аккаунт
        </Button>
      </div>
    );
  }

  if (step === 'role') {
    return (
      <div className="flex flex-col min-h-screen px-screen-x pt-16 pb-8 gap-6 animate-fade-in">
        <div className="text-center">
          <div className="w-16 h-16 bg-brand-500/10 rounded-card flex items-center justify-center mx-auto mb-4">
            <Scissors className="w-8 h-8 text-brand-500" strokeWidth={1.8} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">BookMaster Pro</h1>
          <p className="text-tg-hint">Онлайн-запись к мастерам</p>
        </div>

        <div className="flex-1" />

        <div className="flex flex-col gap-3">
          <p className="text-center text-sm text-tg-hint mb-2">Кто вы?</p>

          <button
            onClick={() => setStep('master-form')}
            className="bg-surface-elevated p-card-inner rounded-card text-left active:scale-[0.98] transition-all duration-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-card bg-brand-500/10 flex items-center justify-center">
                <Scissors className="w-6 h-6 text-brand-500" strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-base">Я — мастер</div>
                <div className="text-sm text-tg-hint">Принимаю клиентов</div>
              </div>
              <div className="text-tg-hint">
                <ChevronLeft className="w-4 h-4 rotate-180" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setStep('client-form')}
            className="bg-surface-elevated p-card-inner rounded-card text-left active:scale-[0.98] transition-all duration-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-card bg-accent-emerald/10 flex items-center justify-center">
                <UserCircle className="w-6 h-6 text-accent-emerald" strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-base">Я — клиент</div>
                <div className="text-sm text-tg-hint">Записываюсь к мастерам</div>
              </div>
              <div className="text-tg-hint">
                <ChevronLeft className="w-4 h-4 rotate-180" />
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'master-form') {
    return (
      <div className="flex flex-col min-h-screen px-screen-x pt-6 pb-8 gap-5 animate-fade-in">
        <button
          onClick={() => setStep('role')}
          className="text-tg-link self-start flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Назад
        </button>

        <h2 className="text-2xl font-bold">Расскажите о себе</h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-tg-hint mb-1 block">Ваше имя *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Анна Иванова"
              className="input-field !text-base !p-4"
            />
          </div>

          <div>
            <label className="text-sm text-tg-hint mb-1 block">Специализация *</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setSpecialization(s)}
                  className={`chip ${
                    specialization === s
                      ? 'chip-active'
                      : 'chip-inactive'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-tg-hint mb-1 block">Город *</label>
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Москва"
              className="input-field !text-base !p-4"
            />
          </div>
          <div>
            <label className="text-sm text-tg-hint mb-1 block">Промо-код (необязательно)</label>
            <input
              value={promoCode}
              onChange={e => setPromoCode(e.target.value.toUpperCase())}
              placeholder="PARTNER30"
              className="input-field !text-base !p-4"
            />
            <p className="text-xs text-tg-hint mt-1">Если есть промо-код, введите для бесплатного доступа</p>
          </div>
        </div>

        <div className="flex-1" />

        <Button onClick={handleRegisterMaster} loading={loading || promoApplying} fullWidth size="lg">
          Начать работу
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen px-screen-x pt-6 pb-8 gap-5 animate-fade-in">
      <button
        onClick={() => setStep('role')}
        className="text-tg-link self-start flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="w-4 h-4" />
        Назад
      </button>

      <h2 className="text-2xl font-bold">Как вас зовут?</h2>

      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm text-tg-hint mb-1 block">Имя *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Мария"
            className="input-field !text-base !p-4"
          />
        </div>
        <div>
          <label className="text-sm text-tg-hint mb-1 block">Телефон (необязательно)</label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+7 (999) 000-00-00"
            type="tel"
            className="input-field !text-base !p-4"
          />
        </div>
      </div>

      <div className="flex-1" />

      <Button onClick={handleRegisterClient} loading={loading} fullWidth size="lg">
        Продолжить
      </Button>
    </div>
  );
}
