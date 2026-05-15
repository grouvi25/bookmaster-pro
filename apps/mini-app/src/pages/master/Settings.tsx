import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { mastersApi, analyticsApi, supportApi, servicesApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { ListSkeleton, StatGridSkeleton } from '@/shared/ui/Skeleton';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import StatCard from '@/shared/ui/StatCard';
import PageHeader from '@/shared/ui/PageHeader';
import MenuItem from '@/shared/ui/MenuItem';
import { toast } from '@/shared/ui/Toast';
import type { Service, SupportTicket, MasterProfile } from '@/shared/types/api';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { ArrowLeft } from 'lucide-react';

const TAB_TITLES: Record<SettingsTab, string> = {
  main: 'Настройки',
  analytics: 'Аналитика',
  services: 'Мои услуги',
  profile: 'Профиль',
  support: 'Поддержка',
};

type SettingsTab = 'main' | 'analytics' | 'services' | 'profile' | 'support';

export default function Settings() {
  const [tab, setTab] = useState<SettingsTab>('main');

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text pb-24 screen-enter">
      <PageHeader
        title={TAB_TITLES[tab]}
        left={
          tab !== 'main' ? (
            <button onClick={() => setTab('main')} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : undefined
        }
      />

      <div className="px-screen-x">
      {tab === 'main' ? (
        <SettingsMain onNavigate={setTab} />
      ) : tab === 'analytics' ? (
        <AnalyticsSection />
      ) : tab === 'services' ? (
        <ServicesSection />
      ) : tab === 'profile' ? (
        <ProfileSection />
      ) : (
        <SupportSection />
      )}
      </div>
    </div>
  );
}

function SettingsMain({ onNavigate }: { onNavigate: (tab: SettingsTab) => void }) {
  const navigate = useNavigate();
  const analyticsEnabled = useFeatureFlag('analytics_enabled');
  const broadcastEnabled = useFeatureFlag('broadcast_enabled');
  const locationsEnabled = useFeatureFlag('locations_enabled');
  const widgetEnabled = useFeatureFlag('widget_enabled');
  const clientSubscriptions = useFeatureFlag('client_subscriptions');

  return (
    <div className="flex flex-col gap-card-gap">
      {analyticsEnabled && (
        <MenuItem
          emoji={'📊'}
          label="Аналитика"
          description="Статистика и отчёты"
          onClick={() => onNavigate('analytics')}
        />
      )}
      <MenuItem
        emoji={'⏰'}
        label="Рабочее расписание"
        description="Часы работы по дням недели"
        onClick={() => navigate('/master/work-schedule')}
      />
      <MenuItem
        emoji={'📋'}
        label="Мои услуги"
        description="Управление услугами"
        onClick={() => onNavigate('services')}
      />
      <MenuItem
        emoji={'👤'}
        label="Профиль"
        description="Настройки профиля"
        onClick={() => onNavigate('profile')}
      />
      <MenuItem
        emoji={'💬'}
        label="Поддержка"
        description="Помощь и обратная связь"
        onClick={() => onNavigate('support')}
      />
      <MenuItem
        emoji={'🔗'}
        label="Моя страница-визитка"
        description="TapLink-аналог"
        onClick={() => navigate('/link-page/edit')}
      />
      <MenuItem
        emoji={'💳'}
        label="Тарифы и подписка"
        description="Управление подпиской"
        onClick={() => navigate('/billing')}
      />
      {broadcastEnabled && (
        <MenuItem
          emoji={'📢'}
          label="Рассылки"
          description="Рассылки по сегментам"
          onClick={() => navigate('/master/broadcast')}
        />
      )}
      {widgetEnabled && (
        <MenuItem
          emoji={'💻'}
          label="Виджет для сайта"
          description="Встройте запись на свой сайт"
          onClick={() => navigate('/master/widget')}
        />
      )}
      {clientSubscriptions && (
        <MenuItem
          emoji={'📦'}
          label="Абонементы"
          description="Пакеты визитов для клиентов"
          onClick={() => navigate('/master/subscription-packages')}
        />
      )}
      {locationsEnabled && (
        <MenuItem
          emoji={'📍'}
          label="Локации"
          description="Управление адресами"
          onClick={() => navigate('/master/locations')}
        />
      )}
    </div>
  );
}

function AnalyticsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-revenue'],
    queryFn: () => analyticsApi.revenue({ period: '30d' }).then((r) => r.data),
  });

  const { data: funnel } = useQuery({
    queryKey: ['analytics-funnel'],
    queryFn: () => analyticsApi.funnel({ days: '30' }).then((r) => r.data),
  });

  if (isLoading) return <StatGridSkeleton count={4} />;

  return (
    <div className="screen-enter">
      <h2 className="text-h2 mb-3">Аналитика за 30 дней</h2>

      <div className="grid grid-cols-2 gap-card-gap mb-4">
        <StatCard label="Выручка" value={`${(data?.total_revenue ?? 0).toLocaleString('ru')} ₽`} />
        <StatCard label="Записей" value={data?.total_bookings ?? 0} />
        <StatCard label="Клиентов" value={data?.unique_clients ?? 0} />
        <StatCard label="Средний чек" value={`${(data?.avg_check ?? 0).toLocaleString('ru')} ₽`} />
      </div>

      {funnel && (
        <>
          <h3 className="text-h3 mb-2">Воронка записей</h3>
          <div className="grid grid-cols-3 gap-card-gap mb-4">
            <StatCard label="Завершённые" value={funnel.completed ?? 0} />
            <StatCard label="Отмены" value={funnel.cancelled ?? 0} />
            <StatCard label="No-show" value={funnel.no_show ?? 0} />
          </div>
        </>
      )}
    </div>
  );
}

function ServicesSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['my-services'],
    queryFn: () => servicesApi.list().then((r) => r.data),
  });
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDuration, setFormDuration] = useState('60');
  const [formLoading, setFormLoading] = useState(false);

  if (isLoading) return <ListSkeleton count={3} />;

  const services = toArray<Service>(data);

  const handleCreate = async () => {
    if (!formName.trim()) { toast.error('Введите название'); return; }
    setFormLoading(true);
    try {
      await servicesApi.create({
        name: formName.trim(),
        price: formPrice ? Number(formPrice) : 0,
        duration_min: Number(formDuration) || 60,
      });
      await queryClient.invalidateQueries({ queryKey: ['my-services'] });
      toast.success('Услуга добавлена');
      setShowForm(false);
      setFormName(''); setFormPrice(''); setFormDuration('60');
    } catch {
      toast.error('Ошибка при создании');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await servicesApi.delete(id);
      await queryClient.invalidateQueries({ queryKey: ['my-services'] });
      toast.success('Услуга удалена');
    } catch {
      toast.error('Ошибка при удалении');
    }
  };

  return (
    <div className="screen-enter">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-h2">Мои услуги</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-tg-link text-body">
          {'➕'} Добавить
        </button>
      </div>

      {showForm && (
        <Card className="mb-3">
          <div className="flex flex-col gap-3">
            <input value={formName} onChange={e => setFormName(e.target.value)}
              placeholder="Название услуги" className="input-field" />
            <div className="flex gap-2">
              <input value={formPrice} onChange={e => setFormPrice(e.target.value)}
                placeholder="Цена, ₽" type="number" className="input-field flex-1" />
              <input value={formDuration} onChange={e => setFormDuration(e.target.value)}
                placeholder="Мин" type="number" className="input-field w-20" />
            </div>
            <Button onClick={handleCreate} loading={formLoading} fullWidth size="sm">Создать</Button>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-card-gap">
        {services.map((svc) => (
          <Card key={svc.id} className="flex justify-between items-center">
            <div>
              <div className="font-medium text-body">{svc.name}</div>
              <div className="text-aux text-tg-hint">{svc.duration_min} мин</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-body text-tg-link">
                {svc.price ? `${Number(svc.price).toLocaleString('ru')} ₽` : 'Дог.'}
              </span>
              <button onClick={() => handleDelete(svc.id)} className="text-status-danger interactive">
                {'🗑️'}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProfileSection() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery<MasterProfile>({
    queryKey: ['master-profile'],
    queryFn: () => mastersApi.getProfile().then((r) => r.data),
  });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [prepayPercent, setPrepayPercent] = useState('');
  const [saving, setSaving] = useState(false);

  if (isLoading) return <ListSkeleton count={3} />;

  const startEdit = () => {
    setName(profile?.display_name || '');
    setBio(profile?.description || '');
    setCity(profile?.city || '');
    setDepositAmount(profile?.noshow_deposit_amount ? String(profile.noshow_deposit_amount) : '');
    setPrepayPercent(profile?.noshow_prepay_percent ? String(profile.noshow_prepay_percent) : '');
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await mastersApi.updateProfile({
        display_name: name,
        description: bio,
        city,
        noshow_deposit_amount: depositAmount ? Number(depositAmount) : 0,
        noshow_prepay_percent: prepayPercent ? Number(prepayPercent) : 0,
      });
      await queryClient.invalidateQueries({ queryKey: ['master-profile'] });
      toast.success('Профиль обновлён');
      setEditing(false);
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen-enter">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-h2">Профиль</h2>
        {!editing && (
          <button onClick={startEdit} className="text-tg-link text-body interactive">
            Редактировать
          </button>
        )}
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 bg-tg-secondary rounded-full flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-[32px]">{'👤'}</span>
            )}
          </div>
          <div>
            <div className="font-bold text-body">{profile?.display_name}</div>
            <div className="text-aux text-tg-hint">{profile?.specialization}</div>
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-micro text-tg-hint mb-1 block">Имя</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="text-micro text-tg-hint mb-1 block">О себе</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                className="input-field !h-auto resize-none" style={{ padding: '12px 14px' }} />
            </div>
            <div>
              <label className="text-micro text-tg-hint mb-1 block">Город</label>
              <input value={city} onChange={e => setCity(e.target.value)} className="input-field" />
            </div>

            <div className="pt-2 border-t border-tg-secondary">
              <label className="text-micro font-medium text-tg-text mb-2 block">Антино-шоу: депозит и предоплата</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-micro text-tg-hint mb-1 block">Депозит, ₽</label>
                  <input value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                    type="number" placeholder="0" className="input-field" />
                </div>
                <div className="flex-1">
                  <label className="text-micro text-tg-hint mb-1 block">Предоплата, %</label>
                  <input value={prepayPercent} onChange={e => setPrepayPercent(e.target.value)}
                    type="number" placeholder="0" min="0" max="100" className="input-field" />
                </div>
              </div>
              <p className="text-micro text-tg-hint mt-1">При высоком риске no-show система запросит оплату</p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} loading={saving} fullWidth>Сохранить</Button>
              <Button onClick={() => setEditing(false)} variant="secondary" fullWidth>Отмена</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-body">
            {profile?.description && (
              <p className="text-tg-text mb-2">{profile.description}</p>
            )}
            <div className="flex justify-between">
              <span className="text-tg-hint">Slug</span>
              <span className="font-mono text-aux">{profile?.slug}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-tg-hint">Город</span>
              <span>{profile?.city || 'Не указан'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-tg-hint">Рейтинг</span>
              <span className="flex items-center gap-1">
                {'⭐'} {profile?.rating_avg?.toFixed(1) || '—'} ({profile?.rating_count || 0})
              </span>
            </div>
            {(profile?.noshow_deposit_amount || profile?.noshow_prepay_percent) ? (
              <>
                <div className="flex justify-between">
                  <span className="text-tg-hint">Депозит</span>
                  <span>{profile.noshow_deposit_amount ? `${profile.noshow_deposit_amount} ₽` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tg-hint">Предоплата</span>
                  <span>{profile.noshow_prepay_percent ? `${profile.noshow_prepay_percent}%` : '—'}</span>
                </div>
              </>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}

function SupportSection() {
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('technical');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => supportApi.list().then((r) => r.data),
  });

  const handleSubmit = async () => {
    if (!message.trim() || !subject.trim()) return;
    try {
      await supportApi.create({
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setMessage('');
      setSubject('');
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Тикет создан');
    } catch {
      toast.error('Ошибка отправки');
    }
  };

  if (isLoading) return <ListSkeleton count={3} />;

  const tickets = toArray<SupportTicket>(data);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      open: 'Открыт', in_progress: 'В работе',
      waiting_user: 'Ожидание', resolved: 'Решён', closed: 'Закрыт',
    };
    return map[s] || s;
  };

  return (
    <div className="screen-enter">
      <h2 className="text-h2 mb-3">Поддержка</h2>

      <div className="mb-4 space-y-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input-field"
        >
          <option value="technical">Техническая проблема</option>
          <option value="billing">Оплата / биллинг</option>
          <option value="abuse">Жалоба</option>
          <option value="feature_request">Предложение</option>
          <option value="feedback">Обратная связь</option>
        </select>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Тема обращения..."
          className="input-field"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Опишите вашу проблему..."
          className="input-field resize-none !h-24"
          style={{ padding: '12px 14px', height: '96px' }}
        />
        <Button onClick={handleSubmit} disabled={!message.trim() || !subject.trim()} fullWidth size="sm">
          {'📨'} Отправить
        </Button>
      </div>

      {tickets.length > 0 && (
        <>
          <h3 className="text-h3 mb-2">Ваши обращения</h3>
          <div className="flex flex-col gap-card-gap">
            {tickets.map((t) => (
              <Card key={t.id}>
                <div className="flex justify-between text-body">
                  <span className="font-medium">{t.subject}</span>
                  <span className={`text-micro px-2 py-0.5 rounded-badge ${
                    t.status === 'resolved' || t.status === 'closed'
                      ? 'bg-[#34C759]/15 text-[#34C759]'
                      : t.status === 'in_progress'
                        ? 'bg-[#007AFF]/15 text-[#007AFF]'
                        : 'bg-[#FF9500]/15 text-[#FF9500]'
                  }`}>
                    {statusLabel(t.status)}
                  </span>
                </div>
                <p className="text-micro text-tg-hint mt-1">
                  {t.ticket_code} · {t.category}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
