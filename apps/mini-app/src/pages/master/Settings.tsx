import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { mastersApi, analyticsApi, supportApi, servicesApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { BarChart3, ClipboardList, User, MessageCircle, Link2, CreditCard, ChevronLeft, ChevronRight, Star, Plus, Pencil, Trash2, Send, MapPin, Megaphone } from 'lucide-react';
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

      <button
        onClick={() => navigate('/master/broadcast')}
        className="flex items-center gap-3 p-4 bg-tg-secondary rounded-xl text-left"
      >
        <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-brand-500" strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">Рассылки</div>
          <div className="text-xs text-tg-hint">Рассылки по сегментам клиентов</div>
        </div>
        <ChevronRight className="w-4 h-4 text-tg-hint" />
      </button>

      <button
        onClick={() => navigate('/master/locations')}
        className="flex items-center gap-3 p-4 bg-tg-secondary rounded-xl text-left"
      >
        <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
          <MapPin className="w-5 h-5 text-brand-500" strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">Локации</div>
          <div className="text-xs text-tg-hint">Управление адресами кабинетов</div>
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

  const services = Array.isArray(data) ? data : data?.items || [];

  const handleCreate = async () => {
    if (!formName.trim()) { toast.error('Введите название'); return; }
    setFormLoading(true);
    try {
      await servicesApi.create({
        name: formName.trim(),
        price: formPrice ? Number(formPrice) : null,
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
      <button onClick={onBack} className="flex items-center gap-0.5 text-tg-link text-sm mb-3">
        <ChevronLeft className="w-4 h-4" /> Назад
      </button>
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
                placeholder="Цена, \u20bd" type="number" className="flex-1 p-3 rounded-xl text-sm outline-none bg-tg-bg" />
              <input value={formDuration} onChange={e => setFormDuration(e.target.value)}
                placeholder="Мин" type="number" className="w-20 p-3 rounded-xl text-sm outline-none bg-tg-bg" />
            </div>
            <Button onClick={handleCreate} loading={formLoading} fullWidth size="sm">Создать</Button>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {services.map((svc: Record<string, unknown>) => (
          <Card key={svc.id as number} className="flex justify-between items-center">
            <div>
              <div className="font-medium text-sm">{svc.name as string}</div>
              <div className="text-xs text-tg-hint">{svc.duration_min as number} мин</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm text-brand-600">
                {svc.price ? `${Number(svc.price).toLocaleString('ru')} \u20bd` : 'Дог.'}
              </span>
              <button onClick={() => handleDelete(svc.id as number)} className="text-red-400 active:text-red-600">
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
  const { data: profile, isLoading } = useQuery({
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
      <button onClick={onBack} className="flex items-center gap-0.5 text-tg-link text-sm mb-3">
        <ChevronLeft className="w-4 h-4" /> Назад
      </button>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-lg">Профиль</h2>
        {!editing && (
          <button onClick={startEdit} className="flex items-center gap-1 text-tg-link text-sm">
            <Pencil className="w-3.5 h-3.5" /> Редактировать
          </button>
        )}
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center overflow-hidden">
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
                {profile?.rating_avg?.toFixed(1) || '\u2014'} ({profile?.rating_count || 0})
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
        <Button onClick={handleSubmit} disabled={!message.trim()} fullWidth size="sm">
          <Send className="w-4 h-4" /> Отправить
        </Button>
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
