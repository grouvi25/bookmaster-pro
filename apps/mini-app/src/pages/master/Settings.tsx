import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { mastersApi, analyticsApi, supportApi, servicesApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import Loading from '@/components/common/Loading';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import StatCard from '@/shared/ui/StatCard';
import SectionBack from '@/shared/ui/SectionBack';
import MenuItem from '@/shared/ui/MenuItem';
import { toast } from '@/shared/ui/Toast';
import {
  BarChart3, ClipboardList, User, MessageCircle,
  Link2, CreditCard, Star, Plus, Trash2, Send,
  MapPin, Megaphone,
} from 'lucide-react';
import type { Service, SupportTicket, MasterProfile } from '@/shared/types/api';

type SettingsTab = 'main' | 'analytics' | 'services' | 'profile' | 'support';

export default function Settings() {
  const [tab, setTab] = useState<SettingsTab>('main');

  return (
    <div className="p-5 pb-24 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight mb-5">Настройки</h1>

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

  return (
    <div className="flex flex-col gap-2">
      <MenuItem
        Icon={BarChart3}
        label="Аналитика"
        description="Статистика и отчёты"
        onClick={() => onNavigate('analytics')}
      />
      <MenuItem
        Icon={ClipboardList}
        label="Мои услуги"
        description="Управление услугами"
        onClick={() => onNavigate('services')}
      />
      <MenuItem
        Icon={User}
        label="Профиль"
        description="Настройки профиля"
        onClick={() => onNavigate('profile')}
      />
      <MenuItem
        Icon={MessageCircle}
        label="Поддержка"
        description="Помощь и обратная связь"
        onClick={() => onNavigate('support')}
      />
      <MenuItem
        Icon={Link2}
        label="Моя страница-визитка"
        description="TapLink-аналог"
        onClick={() => navigate('/link-page/edit')}
        iconBg="bg-tg-bg"
        iconColor="text-brand-500"
        className="!bg-brand-500/10"
      />
      <MenuItem
        Icon={CreditCard}
        label="Тарифы и подписка"
        description="Управление подпиской"
        onClick={() => navigate('/billing')}
        iconBg="bg-amber-500/10"
        iconColor="text-accent-orange"
      />
      <MenuItem
        Icon={Megaphone}
        label="Рассылки"
        description="Рассылки по сегментам"
        onClick={() => navigate('/master/broadcast')}
        iconBg="bg-accent-purple/10"
        iconColor="text-accent-purple"
      />
      <MenuItem
        Icon={MapPin}
        label="Локации"
        description="Управление адресами"
        onClick={() => navigate('/master/locations')}
        iconBg="bg-accent-emerald/10"
        iconColor="text-accent-emerald"
      />
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
      <SectionBack onBack={onBack} />
      <h2 className="font-bold text-lg mb-3">Аналитика за 30 дней</h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Выручка" value={`${(data?.total_revenue ?? 0).toLocaleString('ru')} ₽`} />
        <StatCard label="Записей" value={data?.total_bookings ?? 0} />
        <StatCard label="Клиентов" value={data?.unique_clients ?? 0} />
        <StatCard label="Средний чек" value={`${(data?.avg_check ?? 0).toLocaleString('ru')} ₽`} />
      </div>
    </div>
  );
}

function ServicesSection({ onBack }: { onBack: () => void }) {
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

  if (isLoading) return <Loading />;

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
    <div className="animate-slide-up">
      <SectionBack onBack={onBack} />
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-lg">Мои услуги</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-tg-link text-sm">
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      {showForm && (
        <Card className="mb-3">
          <div className="flex flex-col gap-3">
            <input value={formName} onChange={e => setFormName(e.target.value)}
              placeholder="Название услуги" className="w-full p-3 rounded-xl text-sm outline-none bg-tg-bg" />
            <div className="flex gap-2">
              <input value={formPrice} onChange={e => setFormPrice(e.target.value)}
                placeholder="Цена, ₽" type="number" className="flex-1 p-3 rounded-xl text-sm outline-none bg-tg-bg" />
              <input value={formDuration} onChange={e => setFormDuration(e.target.value)}
                placeholder="Мин" type="number" className="w-20 p-3 rounded-xl text-sm outline-none bg-tg-bg" />
            </div>
            <Button onClick={handleCreate} loading={formLoading} fullWidth size="sm">Создать</Button>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {services.map((svc) => (
          <Card key={svc.id} className="flex justify-between items-center">
            <div>
              <div className="font-medium text-sm">{svc.name}</div>
              <div className="text-xs text-tg-hint">{svc.duration_min} мин</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm text-brand-600">
                {svc.price ? `${Number(svc.price).toLocaleString('ru')} ₽` : 'Дог.'}
              </span>
              <button onClick={() => handleDelete(svc.id)} className="text-red-400 active:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProfileSection({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery<MasterProfile>({
    queryKey: ['master-profile'],
    queryFn: () => mastersApi.getProfile().then((r) => r.data),
  });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  if (isLoading) return <Loading />;

  const startEdit = () => {
    setName(profile?.name || '');
    setBio(profile?.bio || '');
    setCity(profile?.city || '');
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await mastersApi.updateProfile({ name, bio, city });
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
    <div className="animate-slide-up">
      <SectionBack onBack={onBack} />
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-lg">Профиль</h2>
        {!editing && (
          <button onClick={startEdit} className="flex items-center gap-1 text-tg-link text-sm">
            Редактировать
          </button>
        )}
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-brand-400" strokeWidth={1.5} />
            )}
          </div>
          <div>
            <div className="font-bold">{profile?.name}</div>
            <div className="text-sm text-tg-hint">{profile?.specialization}</div>
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-tg-hint mb-1 block">Имя</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full p-3 rounded-xl text-sm outline-none bg-tg-bg border border-transparent focus:border-brand-500" />
            </div>
            <div>
              <label className="text-xs text-tg-hint mb-1 block">О себе</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                className="w-full p-3 rounded-xl text-sm outline-none bg-tg-bg border border-transparent focus:border-brand-500 resize-none" />
            </div>
            <div>
              <label className="text-xs text-tg-hint mb-1 block">Город</label>
              <input value={city} onChange={e => setCity(e.target.value)}
                className="w-full p-3 rounded-xl text-sm outline-none bg-tg-bg border border-transparent focus:border-brand-500" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} loading={saving} fullWidth>Сохранить</Button>
              <Button onClick={() => setEditing(false)} variant="secondary" fullWidth>Отмена</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            {profile?.bio && (
              <p className="text-tg-text text-sm mb-2">{profile.bio}</p>
            )}
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
                {profile?.rating_avg?.toFixed(1) || '—'} ({profile?.rating_count || 0})
              </span>
            </div>
          </div>
        )}
      </Card>
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
      toast.success('Сообщение отправлено');
    } catch {
      toast.error('Ошибка отправки');
    }
  };

  if (isLoading) return <Loading />;

  const tickets = toArray<SupportTicket>(data);

  return (
    <div className="animate-slide-up">
      <SectionBack onBack={onBack} />
      <h2 className="font-bold text-lg mb-3">Поддержка</h2>

      <div className="mb-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Опишите вашу проблему..."
          className="input-field resize-none h-24"
        />
        <Button onClick={handleSubmit} disabled={!message.trim()} fullWidth size="sm">
          <Send className="w-4 h-4" /> Отправить
        </Button>
      </div>

      {tickets.length > 0 && (
        <>
          <h3 className="font-medium text-sm mb-2">Ваши обращения</h3>
          <div className="flex flex-col gap-2">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="bg-surface-elevated shadow-card rounded-2xl p-3.5"
              >
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{t.subject}</span>
                  <span className="text-xs text-tg-hint">{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
