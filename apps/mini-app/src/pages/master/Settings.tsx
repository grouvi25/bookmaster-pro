import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mastersApi, analyticsApi, supportApi, servicesApi, uploadsApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { ListSkeleton, StatGridSkeleton, ServiceCardSkeleton, TicketCardSkeleton } from '@/shared/ui/Skeleton';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import StatCard from '@/shared/ui/StatCard';
import PageHeader from '@/shared/ui/PageHeader';
import MenuItem from '@/shared/ui/MenuItem';
import { toast } from '@/shared/ui/Toast';
import type { Service, SupportTicket, MasterProfile } from '@/shared/types/api';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { ArrowLeft, Camera } from 'lucide-react';
import { clsx } from 'clsx';

const TAB_TITLES: Record<SettingsTab, string> = {
  main: 'Настройки',
  analytics: 'Аналитика',
  services: 'Мои услуги',
  profile: 'Профиль',
  payments: 'Приём оплаты',
  notifications: 'Уведомления',
  support: 'Поддержка',
};

type SettingsTab = 'main' | 'analytics' | 'services' | 'profile' | 'payments' | 'notifications' | 'support';

export default function Settings() {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab | null);
  const [tab, setTab] = useState<SettingsTab>(
    initialTab && initialTab in TAB_TITLES ? initialTab : 'main',
  );

  return (
    <div >
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
      ) : tab === 'payments' ? (
        <PaymentsSection />
      ) : tab === 'notifications' ? (
        <NotificationsSection />
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
        emoji={'💳'}
        label="Приём оплаты"
        description="Онлайн-оплата и вывод денег"
        onClick={() => onNavigate('payments')}
      />
      <MenuItem
        emoji={'🔔'}
        label="Уведомления"
        description="Настройка оповещений"
        onClick={() => onNavigate('notifications')}
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
        <div className="animate-fade-in">
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

  if (isLoading) return <ServiceCardSkeleton count={3} />;

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
        <div className="animate-fade-in">
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
  const [bufferMinutes, setBufferMinutes] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) return <TicketCardSkeleton count={3} />;

  const startEdit = () => {
    setName(profile?.display_name || '');
    setBio(profile?.description || '');
    setCity(profile?.city || '');
    setDepositAmount(profile?.noshow_deposit_amount ? String(profile.noshow_deposit_amount) : '');
    setPrepayPercent(profile?.noshow_prepay_percent ? String(profile.noshow_prepay_percent) : '');
    setBufferMinutes(profile?.buffer_minutes != null ? String(profile.buffer_minutes) : '30');
    setEditing(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение');
      e.target.value = '';
      return;
    }
    setAvatarUploading(true);
    try {
      const uploadResp = await uploadsApi.uploadFile(file, 'avatars');
      const url = uploadResp.data.public_url;
      await mastersApi.updateProfile({ avatar_url: url });
      await queryClient.invalidateQueries({ queryKey: ['master-profile'] });
      toast.success('Фото обновлено');
    } catch {
      toast.error('Не удалось загрузить фото');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
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
        buffer_minutes: bufferMinutes !== '' ? Number(bufferMinutes) : 30,
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
        <div className="animate-fade-in">
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
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="relative w-16 h-16 bg-tg-secondary rounded-full flex items-center justify-center overflow-hidden shrink-0 active:scale-95 transition-transform"
            aria-label="Изменить фото профиля"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-[32px]">{'👤'}</span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              {avatarUploading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin-fast" />
              ) : (
                <Camera className="w-5 h-5 text-white drop-shadow" />
              )}
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <div>
            <div className="font-bold text-body">{profile?.display_name}</div>
            <div className="text-aux text-tg-hint">{profile?.specialization}</div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="text-tg-link text-aux mt-0.5"
            >
              {profile?.avatar_url ? 'Изменить фото' : 'Добавить фото'}
            </button>
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
              <label className="text-micro font-medium text-tg-text mb-2 block">
                ⏱️ Перерыв между записями
              </label>
              <div className="flex gap-2 items-center">
                <input
                  value={bufferMinutes}
                  onChange={e => setBufferMinutes(e.target.value)}
                  type="number"
                  min="0"
                  max="120"
                  step="5"
                  placeholder="30"
                  className="input-field w-24"
                />
                <span className="text-sm text-tg-hint">минут</span>
              </div>
              <p className="text-micro text-tg-hint mt-1">
                Время после визита на уборку и подготовку. По умолчанию — 30 минут.
              </p>
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

const PLAN_COMMISSION: Record<string, number> = {
  start: 7,
  basic: 7,
  pro: 6,
  pro_ai: 5.5,
  business: 5,
};

function PaymentsSection() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery<MasterProfile>({
    queryKey: ['master-profile'],
    queryFn: () => mastersApi.getProfile().then((r) => r.data),
  });

  const [editing, setEditing] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  if (isLoading) return <TicketCardSkeleton count={2} />;

  const hasSubAccount = !!profile?.yookassa_account_id;
  const isCommission = profile?.tariff_type === 'A';
  const onlineEnabled = !!profile?.accept_online_payment;
  const commission = PLAN_COMMISSION[profile?.current_plan || 'start'] ?? 7;

  const toggleOnline = async () => {
    setToggling(true);
    try {
      await mastersApi.updateProfile({ accept_online_payment: !onlineEnabled });
      await queryClient.invalidateQueries({ queryKey: ['master-profile'] });
      toast.success(onlineEnabled ? 'Онлайн-оплата выключена' : 'Онлайн-оплата включена');
    } catch {
      toast.error('Не удалось изменить режим оплаты');
    } finally {
      setToggling(false);
    }
  };

  const startEdit = () => {
    setAccountId(profile?.yookassa_account_id || '');
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await mastersApi.updateProfile({
        yookassa_account_id: accountId.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['master-profile'] });
      toast.success('Настройки оплаты сохранены');
      setEditing(false);
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-section-y flex flex-col gap-4 animate-fade-in">
      {/* Как принимать оплату от клиентов (перенесено из «Тарифы») */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold">Онлайн-оплата от клиентов</div>
            <div className="text-xs text-tg-hint mt-0.5">
              {onlineEnabled
                ? 'Включена — клиенты платят картой при записи'
                : 'Выключена — клиенты платят вам лично (наличные, перевод, СБП)'}
            </div>
            {onlineEnabled && (
              <div className="text-xs text-orange-600 mt-1">
                Комиссия сервиса: {commission}%
              </div>
            )}
          </div>
          <button
            onClick={toggleOnline}
            disabled={toggling}
            className={clsx(
              'relative w-12 h-6 rounded-full transition-colors flex-shrink-0',
              onlineEnabled ? 'bg-brand-500' : 'bg-gray-300',
              toggling && 'opacity-60'
            )}
            aria-label="Переключить онлайн-оплату"
          >
            <div
              className={clsx(
                'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                onlineEnabled ? 'translate-x-6' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>
        <div className="text-2xs text-tg-hint mt-2 leading-relaxed">
          Без онлайн-оплаты комиссия сервиса 0% — платите только абонемент. Для приёма
          картой нужна регистрация ИП/самозанятости и верификация в ЮKassa.
        </div>
      </Card>

      {/* Куда поступают деньги — раздельные платежи (сплиты) */}
      <Card>
        <h3 className="font-bold text-base mb-1">Куда поступают деньги</h3>
        <p className="text-aux text-tg-hint mb-3">
          По умолчанию онлайн-оплата проходит через сервис, и мы переводим вам выручку
          отдельно. Можно подключить свой магазин ЮKassa — тогда деньги клиентов будут
          поступать напрямую вам, а сервис автоматически удержит только комиссию.
        </p>

        {!editing ? (
          <div className="flex flex-col gap-2 text-body">
            <div className="flex justify-between items-center">
              <span className="text-tg-hint">Способ зачисления</span>
              <span className="font-medium">
                {isCommission && hasSubAccount ? 'Напрямую вам (сплит)' : 'Через сервис'}
              </span>
            </div>
            {hasSubAccount && (
              <div className="flex justify-between items-center">
                <span className="text-tg-hint">Магазин ЮKassa</span>
                <span className="font-mono text-aux">{profile?.yookassa_account_id}</span>
              </div>
            )}
            <Button onClick={startEdit} variant="secondary" fullWidth className="mt-2">
              {hasSubAccount ? 'Изменить' : 'Подключить свой магазин'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-micro font-medium text-tg-text mb-1 block">
                ID магазина ЮKassa
              </label>
              <input
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="Например, 123456"
                inputMode="numeric"
                className="input-field"
              />
              <p className="text-micro text-tg-hint mt-1">
                Укажите ID вашего магазина ЮKassa, чтобы получать оплату напрямую
                (раздельные платежи). Оставьте пустым — оплата пойдёт через сервис.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} loading={saving} fullWidth>Сохранить</Button>
              <Button onClick={() => setEditing(false)} variant="secondary" fullWidth>Отмена</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Подсказка про сплиты */}
      <Card>
        <h3 className="font-bold text-sm mb-1 flex items-center gap-1.5">💸 Раздельные платежи</h3>
        <p className="text-aux text-tg-hint">
          Чтобы подключить свой магазин ЮKassa: зарегистрируйтесь на yookassa.ru,
          получите ID магазина и вставьте его выше. После проверки оплата начнёт
          поступать напрямую на ваш счёт. Нужна помощь — напишите в поддержку.
        </p>
      </Card>
    </div>
  );
}

const NOTIFICATION_OPTIONS = [
  { key: 'notify_new_booking', label: 'Новая запись', description: 'Когда клиент записывается' },
  { key: 'notify_cancel', label: 'Отмена записи', description: 'Когда клиент отменяет запись' },
  { key: 'notify_reminder', label: 'Напоминания', description: 'Напоминание о предстоящей записи' },
  { key: 'notify_review', label: 'Новый отзыв', description: 'Когда клиент оставляет отзыв' },
  { key: 'notify_no_show', label: 'Неявка клиента', description: 'Когда клиент не пришёл' },
] as const;

function NotificationsSection() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: () => mastersApi.getNotificationSettings().then((r) => r.data),
  });

  if (isLoading) return <ListSkeleton count={5} />;

  const settings = (data || {}) as Record<string, boolean>;

  const handleToggle = async (key: string, value: boolean) => {
    setSaving(true);
    try {
      await mastersApi.updateNotificationSettings({ [key]: value });
      await queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
        <div className="animate-fade-in">
          <h2 className="text-h2 mb-1">Уведомления</h2>
      <p className="text-aux text-tg-hint mb-4">Настройте, какие уведомления вы хотите получать</p>

      <div className="flex flex-col gap-card-gap">
        {NOTIFICATION_OPTIONS.map((opt) => (
          <Card key={opt.key} className="flex items-center justify-between">
            <div>
              <div className="font-medium text-body">{opt.label}</div>
              <div className="text-aux text-tg-hint mt-0.5">{opt.description}</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings[opt.key] !== false}
                onChange={(e) => handleToggle(opt.key, e.target.checked)}
                disabled={saving}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-tg-secondary rounded-full peer peer-checked:bg-brand-500 peer-disabled:opacity-40 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SupportSection() {
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('technical');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
        <div className="animate-fade-in">
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
              <Card key={t.id} onClick={() => navigate(`/support/ticket/${t.id}`)}>
                <div className="flex justify-between text-body">
                  <span className="font-medium">{t.subject}</span>
                  <span className={`text-micro px-2 py-0.5 rounded-badge ${
                    t.status === 'resolved' || t.status === 'closed'
                      ? 'bg-status-success/15 text-status-success'
                      : t.status === 'in_progress'
                        ? 'bg-status-info/15 text-status-info'
                        : 'bg-status-warning/15 text-status-warning'
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
