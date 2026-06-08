import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rentalsApi } from '@/api/endpoints';
import PageHeader from '@/shared/ui/PageHeader';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import EmptyState from '@/shared/ui/EmptyState';
import ConfirmDialog from '@/shared/ui/ConfirmDialog';
import { toast } from '@/shared/ui/Toast';
import { ServiceCardSkeleton } from '@/shared/ui/Skeleton';
import { HeaderBackButton } from '@/components/common/BackButton';
import { Plus, Trash2, Pencil, X, Check, Users, MapPin, Pause, Play } from 'lucide-react';

const LISTING_TYPES: Record<string, { label: string; emoji: string }> = {
  chair: { label: 'Кресло', emoji: '💈' },
  room: { label: 'Кабинет', emoji: '🚪' },
  cabinet: { label: 'Кабинет', emoji: '🏥' },
  studio: { label: 'Студия', emoji: '🏢' },
};

const AMENITIES: Record<string, string> = {
  wifi: '📶 Wi-Fi',
  tools: '🔧 Инструменты',
  parking: '🅿️ Парковка',
  mirror: '🪞 Зеркала',
  sink: '🚰 Раковина',
  storage: '🗄 Хранение',
  ac: '❄️ Кондиционер',
  kitchen: '🍳 Кухня',
  shower: '🚿 Душ',
  reception: '🛎 Ресепшн',
};

interface Listing {
  id: number;
  owner_id: number;
  owner_name?: string;
  title: string;
  description?: string;
  listing_type: string;
  address?: string;
  city?: string;
  price_monthly: number;
  price_daily?: number;
  deposit?: number;
  amenities: string[];
  photo_urls: string[];
  status: string;
  available_from?: string;
  max_tenants: number;
  current_tenants: number;
  created_at: string;
}

type TabType = 'browse' | 'my' | 'requests';

export default function Rentals() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabType>('browse');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('chair');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formPriceMonthly, setFormPriceMonthly] = useState('');
  const [formPriceDaily, setFormPriceDaily] = useState('');
  const [formDeposit, setFormDeposit] = useState('');
  const [formAmenities, setFormAmenities] = useState<string[]>([]);
  const [formMaxTenants, setFormMaxTenants] = useState('1');

  const { data: listings, isLoading: loadingBrowse } = useQuery<Listing[]>({
    queryKey: ['rentals-browse'],
    queryFn: () => rentalsApi.listActive().then(r => r.data),
    enabled: tab === 'browse',
  });

  const { data: myListings, isLoading: loadingMy } = useQuery<Listing[]>({
    queryKey: ['rentals-my'],
    queryFn: () => rentalsApi.my().then(r => r.data),
    enabled: tab === 'my',
  });

  const { data: incoming } = useQuery({
    queryKey: ['rentals-incoming'],
    queryFn: () => rentalsApi.incomingRequests().then(r => r.data),
    enabled: tab === 'requests',
  });

  const resetForm = () => {
    setFormTitle(''); setFormDesc(''); setFormType('chair');
    setFormAddress(''); setFormCity('');
    setFormPriceMonthly(''); setFormPriceDaily(''); setFormDeposit('');
    setFormAmenities([]); setFormMaxTenants('1');
    setEditingId(null); setShowForm(false);
  };

  const startEdit = (l: Listing) => {
    setEditingId(l.id);
    setFormTitle(l.title);
    setFormDesc(l.description || '');
    setFormType(l.listing_type);
    setFormAddress(l.address || '');
    setFormCity(l.city || '');
    setFormPriceMonthly(String(Number(l.price_monthly)));
    setFormPriceDaily(l.price_daily ? String(Number(l.price_daily)) : '');
    setFormDeposit(l.deposit ? String(Number(l.deposit)) : '');
    setFormAmenities(l.amenities || []);
    setFormMaxTenants(String(l.max_tenants));
    setShowForm(true);
    setTab('my');
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) { toast.error('Введите название'); return; }
    if (!formPriceMonthly || Number(formPriceMonthly) <= 0) { toast.error('Введите цену'); return; }
    setFormLoading(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        listing_type: formType,
        address: formAddress.trim() || undefined,
        city: formCity.trim() || undefined,
        price_monthly: Number(formPriceMonthly),
        price_daily: formPriceDaily ? Number(formPriceDaily) : undefined,
        deposit: formDeposit ? Number(formDeposit) : undefined,
        amenities: formAmenities,
        max_tenants: Number(formMaxTenants) || 1,
      };
      if (editingId) {
        await rentalsApi.update(editingId, payload);
        toast.success('Объявление обновлено');
      } else {
        await rentalsApi.create(payload);
        toast.success('Объявление создано');
      }
      queryClient.invalidateQueries({ queryKey: ['rentals-my'] });
      queryClient.invalidateQueries({ queryKey: ['rentals-browse'] });
      resetForm();
    } catch {
      toast.error('Ошибка сохранения');
    } finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await rentalsApi.delete(deleteConfirmId);
      queryClient.invalidateQueries({ queryKey: ['rentals-my'] });
      queryClient.invalidateQueries({ queryKey: ['rentals-browse'] });
      toast.success('Объявление удалено');
    } catch { toast.error('Ошибка удаления'); }
    setDeleteConfirmId(null);
  };

  const handleToggleStatus = async (l: Listing) => {
    const newStatus = l.status === 'active' ? 'paused' : 'active';
    try {
      await rentalsApi.update(l.id, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['rentals-my'] });
      queryClient.invalidateQueries({ queryKey: ['rentals-browse'] });
      toast.success(newStatus === 'active' ? 'Объявление активировано' : 'Объявление приостановлено');
    } catch { toast.error('Ошибка'); }
  };

  const handleApply = async (listingId: number) => {
    try {
      await rentalsApi.request(listingId, {});
      toast.success('Заявка отправлена');
    } catch { toast.error('Не удалось отправить заявку'); }
  };

  const handleRespond = async (requestId: number, approve: boolean) => {
    try {
      await rentalsApi.respond(requestId, approve);
      queryClient.invalidateQueries({ queryKey: ['rentals-incoming'] });
      toast.success(approve ? 'Заявка одобрена' : 'Заявка отклонена');
    } catch { toast.error('Ошибка'); }
  };

  const toggleAmenity = (a: string) => {
    setFormAmenities(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  };

  const tabs: { key: TabType; label: string; emoji: string }[] = [
    { key: 'browse', label: 'Каталог', emoji: '🔍' },
    { key: 'my', label: 'Мои', emoji: '📋' },
    { key: 'requests', label: 'Заявки', emoji: '📨' },
  ];

  return (
    <div className="px-screen-x pb-24">
      <HeaderBackButton />
      <PageHeader title="Аренда рабочих мест" />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-tg-secondary rounded-lg p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-center py-2 rounded-md text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-tg-bg text-tg-text shadow-sm'
                : 'text-tg-hint'
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* ── Browse Tab ── */}
      {tab === 'browse' && (
        loadingBrowse ? <ServiceCardSkeleton count={4} /> :
        !listings || listings.length === 0 ? (
          <EmptyState emoji="🏠" title="Нет объявлений" description="Пока никто не сдаёт рабочие места" />
        ) : (
          <div className="flex flex-col gap-3">
            {listings.map(l => {
              const lt = LISTING_TYPES[l.listing_type] || LISTING_TYPES.chair;
              return (
                <Card key={l.id}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xl">{lt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{l.title}</div>
                      <div className="text-xs text-tg-hint">{lt.label}</div>
                    </div>
                    <span className="font-bold text-sm text-tg-link whitespace-nowrap">
                      {Number(l.price_monthly).toLocaleString('ru')} ₽/мес
                    </span>
                  </div>
                  {l.address && (
                    <div className="flex items-center gap-1 text-xs text-tg-hint mb-1">
                      <MapPin className="w-3 h-3" /> {l.city ? `${l.city}, ` : ''}{l.address}
                    </div>
                  )}
                  {l.description && (
                    <p className="text-xs text-tg-hint mb-2 line-clamp-2">{l.description}</p>
                  )}
                  {l.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {l.amenities.slice(0, 5).map(a => (
                        <span key={a} className="text-[10px] bg-tg-secondary px-1.5 py-0.5 rounded">
                          {AMENITIES[a] || a}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-tg-hint">
                      <Users className="w-3 h-3 inline mr-1" />
                      {l.current_tenants}/{l.max_tenants} мест
                    </span>
                    <Button size="sm" onClick={() => handleApply(l.id)}>
                      Откликнуться
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* ── My Tab ── */}
      {tab === 'my' && (
        <>
          <button
            onClick={() => { if (showForm && !editingId) resetForm(); else { resetForm(); setShowForm(true); } }}
            className="flex items-center gap-1 text-tg-link text-sm mb-3"
          >
            {showForm && !editingId ? <><X className="w-4 h-4" /> Отмена</> : <><Plus className="w-4 h-4" /> Создать объявление</>}
          </button>

          {showForm && (
            <Card className="mb-4 animate-slide-up">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm">{editingId ? 'Редактирование' : 'Новое объявление'}</span>
                <button onClick={resetForm} className="text-tg-hint p-1"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-col gap-3">
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Название (напр. Кресло парикмахера)" className="input-field" />
                <select value={formType} onChange={e => setFormType(e.target.value)} className="input-field">
                  {Object.entries(LISTING_TYPES).map(([k, { label, emoji }]) => (
                    <option key={k} value={k}>{emoji} {label}</option>
                  ))}
                </select>
                <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Описание" className="input-field min-h-[60px]" />
                <input value={formCity} onChange={e => setFormCity(e.target.value)} placeholder="Город" className="input-field" />
                <input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Адрес" className="input-field" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={formPriceMonthly} onChange={e => setFormPriceMonthly(e.target.value)} placeholder="₽/мес *" type="number" inputMode="decimal" className="input-field" />
                  <input value={formPriceDaily} onChange={e => setFormPriceDaily(e.target.value)} placeholder="₽/день" type="number" inputMode="decimal" className="input-field" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={formDeposit} onChange={e => setFormDeposit(e.target.value)} placeholder="Залог ₽" type="number" inputMode="decimal" className="input-field" />
                  <input value={formMaxTenants} onChange={e => setFormMaxTenants(e.target.value)} placeholder="Мест" type="number" inputMode="numeric" className="input-field" />
                </div>
                <div>
                  <div className="text-xs text-tg-hint mb-1">Удобства:</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(AMENITIES).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => toggleAmenity(k)}
                        className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                          formAmenities.includes(k)
                            ? 'bg-tg-button text-tg-button-text border-tg-button'
                            : 'bg-tg-secondary text-tg-hint border-tg-secondary'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={handleSubmit} loading={formLoading} fullWidth size="sm">
                  <Check className="w-4 h-4 mr-1" />
                  {editingId ? 'Сохранить' : 'Опубликовать'}
                </Button>
              </div>
            </Card>
          )}

          {loadingMy ? <ServiceCardSkeleton count={3} /> :
          !myListings || myListings.length === 0 ? (
            <EmptyState emoji="📋" title="Нет объявлений" description="Создайте первое объявление" />
          ) : (
            <div className="flex flex-col gap-2">
              {myListings.map(l => {
                const lt = LISTING_TYPES[l.listing_type] || LISTING_TYPES.chair;
                const statusLabel = l.status === 'active' ? '🟢 Активно' : l.status === 'paused' ? '⏸ Пауза' : '🔴 Сдано';
                return (
                  <Card key={l.id} className="flex items-center gap-2">
                    <span className="text-lg">{lt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{l.title}</div>
                      <div className="text-xs text-tg-hint">
                        {statusLabel} · {Number(l.price_monthly).toLocaleString('ru')} ₽/мес · {l.current_tenants}/{l.max_tenants}
                      </div>
                    </div>
                    <button onClick={() => handleToggleStatus(l)} className="text-tg-hint p-1">
                      {l.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button onClick={() => startEdit(l)} className="text-tg-hint p-1">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteConfirmId(l.id)} className="text-status-danger p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Requests Tab ── */}
      {tab === 'requests' && (
        !incoming || (incoming as Array<Record<string, unknown>>).length === 0 ? (
          <EmptyState emoji="📨" title="Нет заявок" description="Входящие заявки на ваши объявления" />
        ) : (
          <div className="flex flex-col gap-2">
            {(incoming as Array<{
              id: number; listing_title?: string;
              tenant_name?: string; tenant_avatar?: string;
              message?: string; status: string; created_at: string;
            }>).map(req => (
              <Card key={req.id}>
                <div className="flex items-center gap-2 mb-2">
                  {req.tenant_avatar ? (
                    <img src={req.tenant_avatar} className="w-8 h-8 rounded-full" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-tg-secondary flex items-center justify-center text-sm">👤</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{req.tenant_name || 'Мастер'}</div>
                    <div className="text-xs text-tg-hint">→ {req.listing_title}</div>
                  </div>
                </div>
                {req.message && <p className="text-xs text-tg-hint mb-2">{req.message}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleRespond(req.id, true)} fullWidth>
                    ✅ Одобрить
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleRespond(req.id, false)} fullWidth>
                    ❌ Отклонить
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Удалить объявление?"
        description="Объявление и все заявки будут удалены."
        confirmLabel="Удалить"
        variant="danger"
      />
    </div>
  );
}
