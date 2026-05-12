import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { mastersApi, analyticsApi, supportApi, servicesApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import { BarChart3, ClipboardList, User, MessageCircle, Link2, CreditCard, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type SettingsTab = 'main' | 'analytics' | 'services' | 'profile' | 'support';

export default function Settings() {
  const [tab, setTab] = useState<SettingsTab>('main');

  return (
    <div className="p-4 pb-20 animate-fade-in">
      <h1 className="text-xl font-bold mb-4">Настройки</h1>

      {tab === 'main' ? (
        <SettingsMain onNavigate={setTab} />
      ) : tab === 'analytics' ? (
        <AnalyticsSection onBack={() => setTab('main')} />
      ) : tab === 'services' ? (
        <ServicesSection onBack={() => setTab('main')} />
      ) : tab === 'profile' ? (
        <ProfileSection onBack={() => setTab('main')} />
      ) : (
        <SupportSection onBack={() => setTab('main')} />
      )}
    </div>
  );
}

function SettingsMain({ onNavigate }: { onNavigate: (tab: SettingsTab) => void }) {
  const navigate = useNavigate();
  const menuItems: { key: SettingsTab; Icon: LucideIcon; label: string; desc: string }[] = [
    { key: 'analytics', Icon: BarChart3, label: 'Аналитика', desc: 'Статистика и отчёты' },
    { key: 'services', Icon: ClipboardList, label: 'Мои услуги', desc: 'Управление услугами' },
    { key: 'profile', Icon: User, label: 'Профиль', desc: 'Настройки профиля' },
    { key: 'support', Icon: MessageCircle, label: 'Поддержка', desc: 'Помощь и обратная связь' },
  ];

  return (
    <div className="flex flex-col gap-2">
      {menuItems.map((item) => (
        <button
          key={item.key}
          onClick={() => onNavigate(item.key)}
          className="flex items-center gap-3 p-4 bg-tg-secondary rounded-xl text-left active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
            <item.Icon className="w-5 h-5 text-brand-500" strokeWidth={1.8} />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{item.label}</div>
            <div className="text-xs text-tg-hint">{item.desc}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-tg-hint" />
        </button>
      ))}

      <button
        onClick={() => navigate('/link-page/edit')}
        className="flex items-center gap-3 p-4 bg-brand-50 rounded-xl text-left"
      >
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
          <Link2 className="w-5 h-5 text-brand-500" strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm text-brand-700">
            Моя страница-визитка
          </div>
          <div className="text-xs text-brand-600">TapLink-аналог</div>
        </div>
        <ChevronRight className="w-4 h-4 text-brand-400" />
      </button>

      <button
        onClick={() => navigate('/billing')}
        className="flex items-center gap-3 p-4 bg-tg-secondary rounded-xl text-left"
      >
        <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-brand-500" strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">Тарифы и подписка</div>
          <div className="text-xs text-tg-hint">Управление подпиской</div>
        </div>
        <ChevronRight className="w-4 h-4 text-tg-hint" />
      </button>
    </div>
  );
}

function AnalyticsSection({ onBack }: { onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-revenue'],
    queryFn: () => analyticsApi.revenue({ period: '30d' }).then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  return (
    <div className="animate-slide-up">
      <button onClick={onBack} className="flex items-center gap-0.5 text-tg-link text-sm mb-3">
        <ChevronLeft className="w-4 h-4" /> Назад
      </button>
      <h2 className="font-bold text-lg mb-3">Аналитика за 30 дней</h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: 'Выручка', value: `${(data?.total_revenue ?? 0).toLocaleString('ru')} \u20bd` },
          { label: 'Записей', value: data?.total_bookings ?? 0 },
          { label: 'Клиентов', value: data?.unique_clients ?? 0 },
          { label: 'Средний чек', value: `${(data?.avg_check ?? 0).toLocaleString('ru')} \u20bd` },
        ].map((item) => (
          <div key={item.label} className="bg-tg-secondary rounded-xl p-3">
            <div className="text-xl font-bold">{item.value}</div>
            <div className="text-xs text-tg-hint">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServicesSection({ onBack }: { onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['my-services'],
    queryFn: () => servicesApi.list().then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  const services = Array.isArray(data) ? data : data?.items || [];

  return (
    <div className="animate-slide-up">
      <button onClick={onBack} className="flex items-center gap-0.5 text-tg-link text-sm mb-3">
        <ChevronLeft className="w-4 h-4" /> Назад
      </button>
      <h2 className="font-bold text-lg mb-3">Мои услуги</h2>

      <div className="flex flex-col gap-2">
        {services.map((svc: Record<string, unknown>) => (
          <div
            key={svc.id as number}
            className="flex justify-between items-center p-3 bg-tg-secondary rounded-xl"
          >
            <div>
              <div className="font-medium text-sm">{svc.name as string}</div>
              <div className="text-xs text-tg-hint">
                {svc.duration_min as number} мин
              </div>
            </div>
            <div className="font-bold text-sm text-brand-600">
              {svc.price ? `${Number(svc.price).toLocaleString('ru')} \u20bd` : 'Дог.'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileSection({ onBack }: { onBack: () => void }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['master-profile'],
    queryFn: () => mastersApi.getProfile().then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  return (
    <div className="animate-slide-up">
      <button onClick={onBack} className="flex items-center gap-0.5 text-tg-link text-sm mb-3">
        <ChevronLeft className="w-4 h-4" /> Назад
      </button>
      <h2 className="font-bold text-lg mb-3">Профиль</h2>

      <div className="bg-tg-secondary rounded-xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-brand-400" strokeWidth={1.5} />
            )}
          </div>
          <div>
            <div className="font-bold">{profile?.name}</div>
            <div className="text-sm text-tg-hint">{profile?.specialization}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-tg-hint">Slug</span>
            <span className="font-mono">{profile?.slug}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tg-hint">Город</span>
            <span>{profile?.city || 'Не указан'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tg-hint">Рейтинг</span>
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              {profile?.rating_avg?.toFixed(1) || '\u2014'} ({profile?.rating_count || 0})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SupportSection({ onBack }: { onBack: () => void }) {
  const [message, setMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => supportApi.list().then((r) => r.data),
  });

  const handleSubmit = async () => {
    if (!message.trim()) return;
    try {
      await supportApi.create({ subject: 'Вопрос', message: message.trim() });
      setMessage('');
    } catch {
      // handled by interceptor
    }
  };

  if (isLoading) return <Loading />;

  const tickets = data?.items || [];

  return (
    <div className="animate-slide-up">
      <button onClick={onBack} className="flex items-center gap-0.5 text-tg-link text-sm mb-3">
        <ChevronLeft className="w-4 h-4" /> Назад
      </button>
      <h2 className="font-bold text-lg mb-3">Поддержка</h2>

      <div className="mb-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Опишите вашу проблему..."
          className="w-full px-4 py-3 bg-tg-secondary rounded-xl text-sm outline-none resize-none h-24"
        />
        <button
          onClick={handleSubmit}
          disabled={!message.trim()}
          className="w-full mt-2 bg-tg-button text-tg-button-text py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          Отправить
        </button>
      </div>

      {tickets.length > 0 && (
        <>
          <h3 className="font-medium text-sm mb-2">Ваши обращения</h3>
          <div className="flex flex-col gap-2">
            {tickets.map((t: Record<string, unknown>) => (
              <div
                key={t.id as number}
                className="bg-tg-secondary rounded-xl p-3"
              >
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{t.subject as string}</span>
                  <span className="text-xs text-tg-hint">{t.status as string}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
