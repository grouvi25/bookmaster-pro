import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { superadminApi, authApi } from '@/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import { useAuthStore } from '@/stores/auth';
import { toArray } from '@/shared/lib/normalize';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import PageHeader from '@/shared/ui/PageHeader';
import ChipTabs from '@/shared/ui/ChipTabs';
import StatCard from '@/shared/ui/StatCard';
import StatusBadge from '@/shared/ui/StatusBadge';
import EmptyState from '@/shared/ui/EmptyState';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import SearchInput from '@/shared/ui/SearchInput';
import {
  BarChart3, Users, Activity, ScrollText,
  DollarSign, MessageSquare, Settings, TrendingUp,
  UserCircle, Wrench, ArrowRightLeft,
} from 'lucide-react';
import type { MasterProfile, AuditLogEntry, SupportTicket } from '@/shared/types/api';

type Tab = 'dashboard' | 'masters' | 'promo' | 'health' | 'audit' | 'finance' | 'tickets' | 'settings' | 'growth';

const TABS: { key: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { key: 'dashboard', label: 'Обзор', Icon: BarChart3 },
  { key: 'masters', label: 'Мастера', Icon: Users },
  { key: 'promo', label: 'Промо', Icon: Settings },
  { key: 'finance', label: 'Финансы', Icon: DollarSign },
  { key: 'tickets', label: 'Тикеты', Icon: MessageSquare },
  { key: 'growth', label: 'Рост', Icon: TrendingUp },
  { key: 'settings', label: 'Настройки', Icon: Settings },
  { key: 'health', label: 'Здоровье', Icon: Activity },
  { key: 'audit', label: 'Аудит', Icon: ScrollText },
];

export default function SuperadminPanel() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
  const { setAuth, token } = useAuthStore();

  const switchToRole = async (targetRole: 'master' | 'client') => {
    if (!token || switching) return;
    setSwitching(true);
    try {
      const { data } = await authApi.switchRole(targetRole);
      const newToken = data.access_token;
      localStorage.setItem('sa_original_token', token);
      setAuth(newToken, targetRole, data.master_id ?? null);
      navigate(targetRole === 'master' ? '/master' : '/client');
    } catch {
      toast.error('Не удалось переключить роль');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="px-screen-x pt-section-y pb-24 animate-fade-in">
      <PageHeader title="Суперадмин" />

      {/* Role switcher */}
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
          className="flex-1 flex items-center justify-center gap-2 p-3 bg-blue-500/10 text-blue-600 rounded-btn text-sm font-medium active:scale-[0.97] transition-all disabled:opacity-50"
        >
          <UserCircle className="w-4 h-4" />
          {switching ? '...' : 'Режим клиента'}
        </button>
      </div>

      <div className="mb-5">
        <ChipTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'masters' && <MastersTab />}
      {tab === 'promo' && <PromoCodesTab />}
      {tab === 'health' && <HealthTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'finance' && <FinanceTab />}
      {tab === 'tickets' && <TicketsTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'growth' && <GrowthTab />}
    </div>
  );
}

/** Floating button to return to superadmin from master/client view */
export function SuperadminReturnButton() {
  const navigate = useNavigate();
  const { role, setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const originalToken = localStorage.getItem('sa_original_token');
  if (role === 'superadmin' || !originalToken) return null;

  const handleReturn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      setAuth(originalToken, 'superadmin');
      const { data } = await authApi.switchRole('superadmin');
      localStorage.removeItem('sa_original_token');
      setAuth(data.access_token, 'superadmin');
      navigate('/superadmin');
    } catch {
      localStorage.removeItem('sa_original_token');
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
      className="fixed top-4 right-4 z-[100] flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-full text-xs font-semibold shadow-lg active:scale-95 transition-all disabled:opacity-50"
    >
      <ArrowRightLeft className="w-3.5 h-3.5" />
      {loading ? '...' : 'Суперадмин'}
    </button>
  );
}

function DashboardTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-dashboard'],
    queryFn: () => superadminApi.dashboard().then((r) => r.data),
  });

  if (isLoading) return <ListSkeleton count={4} />;

  const stats = data || {};

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Всего мастеров" value={stats.total_masters ?? 0} />
      <StatCard label="Активных" value={stats.active_masters ?? 0} />
      <StatCard label="Записей сегодня" value={stats.today_bookings ?? 0} />
      <StatCard label="Выручка (мес)" value={`${(stats.month_revenue ?? 0).toLocaleString('ru')} ₽`} />
      <StatCard label="Новых за неделю" value={stats.new_masters_week ?? 0} />
      <StatCard label="Тикетов открыто" value={stats.open_tickets ?? 0} />
    </div>
  );
}

function MastersTab() {
  const [search, setSearch] = useState('');
  const [grantMasterId, setGrantMasterId] = useState<number | null>(null);
  const [grantPlan, setGrantPlan] = useState('pro');
  const [grantDays, setGrantDays] = useState('30');
  const [grantNote, setGrantNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-masters', search],
    queryFn: () => superadminApi.masters({ q: search }).then((r) => r.data),
  });

  const grantMutation = useMutation({
    mutationFn: ({ masterId, plan, days, note }: { masterId: number; plan: string; days: number; note: string }) =>
      superadminApi.grantAccess(masterId, { plan, duration_days: days, note: note || undefined }),
    onSuccess: () => {
      toast.success('Доступ выдан');
      setGrantMasterId(null);
      setGrantNote('');
    },
    onError: () => toast.error('Ошибка выдачи доступа'),
  });

  if (isLoading) return <ListSkeleton count={4} />;

  const masters = toArray<MasterProfile>(data);

  return (
    <div>
      <div className="mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Поиск мастеров..." />
      </div>

      <div className="flex flex-col gap-2">
        {masters.map((m) => (
          <Card key={m.id}>
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-sm">{m.display_name}</div>
                <div className="text-xs text-tg-hint">
                  {m.specialization} &middot; {m.current_plan}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge
                  label={m.is_verified ? 'Активен' : 'Неактивен'}
                  variant={m.is_verified ? 'success' : 'danger'}
                />
                <button
                  onClick={() => setGrantMasterId(grantMasterId === m.id ? null : m.id)}
                  className="text-xs bg-tg-button text-tg-button-text px-2.5 py-1.5 rounded-lg"
                >
                  Выдать доступ
                </button>
              </div>
            </div>

            {grantMasterId === m.id && (
              <div className="mt-3 pt-3 border-t border-tg-secondary/50 flex flex-col gap-2">
                <div className="flex gap-2">
                  <select
                    value={grantPlan}
                    onChange={(e) => setGrantPlan(e.target.value)}
                    className="flex-1 input-field !h-auto !py-2"
                  >
                    <option value="start">Start</option>
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                  </select>
                  <input
                    type="number"
                    value={grantDays}
                    onChange={(e) => setGrantDays(e.target.value)}
                    placeholder="Дней"
                    className="w-20 input-field !h-auto !py-2"
                  />
                </div>
                <input
                  type="text"
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                  placeholder="Комментарий (необязательно)"
                  className="input-field !h-auto !py-2"
                />
                <Button
                  onClick={() => grantMutation.mutate({
                    masterId: m.id,
                    plan: grantPlan,
                    days: parseInt(grantDays) || 30,
                    note: grantNote,
                  })}
                  loading={grantMutation.isPending}
                  fullWidth
                  size="sm"
                >
                  Подтвердить выдачу
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function HealthTab() {
  const mutation = useMutation({
    mutationFn: () => superadminApi.healthChecks(),
  });

  return (
    <div>
      <Button
        onClick={() => mutation.mutate()}
        loading={mutation.isPending}
        fullWidth
        className="mb-4"
      >
        Запустить проверку здоровья
      </Button>

      {mutation.data && (
        <div className="flex flex-col gap-2">
          {Object.entries(mutation.data.data || {}).map(
            ([service, status]) => (
              <Card
                key={service}
                className="flex justify-between"
              >
                <span className="text-sm font-medium">{service}</span>
                <StatusBadge
                  label={status as string}
                  variant={status === 'ok' ? 'success' : 'danger'}
                />
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}

function AuditTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-audit'],
    queryFn: () => superadminApi.auditLog().then((r) => r.data),
  });

  if (isLoading) return <ListSkeleton count={4} />;

  const logs = toArray<AuditLogEntry>(data);

  return (
    <div className="flex flex-col gap-2">
      {logs.length === 0 ? (
        <EmptyState emoji="📜" title="Нет записей" />
      ) : (
        logs.map((log, i) => (
          <Card key={i}>
            <div className="flex justify-between text-sm">
              <span className="font-medium">{log.action}</span>
              <span className="text-xs text-tg-hint">{log.created_at}</span>
            </div>
            <div className="text-xs text-tg-hint mt-0.5">
              {log.user_name} &middot; {log.details}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

interface FinanceData {
  mrr?: number;
  arr?: number;
  period_revenue?: number;
  total_refunds?: number;
  transaction_count?: number;
  mrr_forecast_3m?: number;
  revenue_by_day?: { date: string; revenue: number; count: number }[];
}

function FinanceTab() {
  const { data, isLoading } = useQuery<FinanceData>({
    queryKey: ['superadmin-finance'],
    queryFn: () => superadminApi.finance().then((r) => r.data),
  });

  if (isLoading) return <ListSkeleton count={4} />;

  const f = data || {};

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="MRR" value={`${(f.mrr ?? 0).toLocaleString('ru')} ₽`} />
        <StatCard label="ARR" value={`${(f.arr ?? 0).toLocaleString('ru')} ₽`} />
        <StatCard label="Выручка (период)" value={`${(f.period_revenue ?? 0).toLocaleString('ru')} ₽`} />
        <StatCard label="Возвраты" value={`${(f.total_refunds ?? 0).toLocaleString('ru')} ₽`} />
        <StatCard label="Транзакций" value={f.transaction_count ?? 0} />
        <StatCard label="Прогноз 3м" value={`${(f.mrr_forecast_3m ?? 0).toLocaleString('ru')} ₽`} />
      </div>

      {f.revenue_by_day && f.revenue_by_day.length > 0 && (
        <Card>
          <h3 className="text-sm font-medium mb-2">Выручка по дням</h3>
          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {f.revenue_by_day.map((d) => (
              <div key={d.date} className="flex justify-between text-xs">
                <span className="text-tg-hint">{d.date}</span>
                <span>{d.revenue.toLocaleString('ru')} ₽ ({d.count})</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

const TICKET_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  open: 'warning',
  in_progress: 'neutral',
  resolved: 'success',
  escalated: 'danger',
};

const TICKET_FILTER_OPTIONS = ['', 'open', 'in_progress', 'resolved', 'escalated'] as const;

function TicketsTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-tickets', statusFilter],
    queryFn: () => superadminApi.tickets({ status: statusFilter || undefined }).then((r) => r.data),
  });

  const escalateMutation = useMutation({
    mutationFn: (ticketId: number) => superadminApi.escalateTicket(ticketId),
  });

  if (isLoading) return <ListSkeleton count={4} />;

  const tickets: SupportTicket[] = data?.tickets || [];
  const openCount: number = data?.open_count ?? 0;

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {TICKET_FILTER_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`chip ${statusFilter === s ? 'chip-active' : 'chip-inactive'}`}
          >
            {s || 'Все'}
          </button>
        ))}
      </div>

      <p className="text-xs text-tg-hint mb-3">Открытых: {openCount}</p>

      <div className="flex flex-col gap-2">
        {tickets.length === 0 ? (
          <EmptyState emoji="📨" title="Нет тикетов" />
        ) : (
          tickets.map((t) => (
            <Card key={t.id}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-medium">#{t.id}: {t.subject}</div>
                  <div className="text-xs text-tg-hint mt-0.5">
                    {t.initiator_role} #{t.initiator_id} &middot; {t.created_at}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    label={t.status}
                    variant={TICKET_STATUS_VARIANT[t.status] || 'neutral'}
                  />
                  {t.status !== 'escalated' && t.status !== 'resolved' && (
                    <button
                      onClick={() => escalateMutation.mutate(t.id)}
                      className="text-xs text-red-500 underline"
                    >
                      Эскалировать
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function SettingsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-settings'],
    queryFn: () => superadminApi.settings().then((r) => r.data),
  });

  if (isLoading) return <ListSkeleton count={2} />;

  const s = data || {};

  return (
    <div>
      <Card className="mb-3">
        <h3 className="text-sm font-semibold mb-2">Тарифы</h3>
        <div className="flex flex-col gap-1">
          {Object.entries(s.plan_prices || {}).map(([plan, price]) => (
            <div key={plan} className="flex justify-between text-xs">
              <span className="capitalize">{plan}</span>
              <span className="font-medium">{(price as number).toLocaleString('ru')} ₽/мес</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-3">
        <h3 className="text-sm font-semibold mb-2">Система</h3>
        <div className="flex flex-col gap-1 text-xs">
          {[
            { label: 'AI-провайдер', value: s.ai_provider },
            { label: 'Таймзона', value: s.timezone },
            { label: 'Окружение', value: s.environment },
            { label: 'Активных подписок', value: s.active_subscriptions },
          ].map((item) => (
            <div key={item.label} className="flex justify-between">
              <span className="text-tg-hint">{item.label}</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

interface PromoCode {
  id: number;
  code: string;
  plan: string;
  duration_days: number;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
}

function PromoCodesTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [plan, setPlan] = useState('pro');
  const [days, setDays] = useState('30');
  const [maxUses, setMaxUses] = useState('');
  const [note, setNote] = useState('');

  const { data, isLoading, refetch } = useQuery<PromoCode[]>({
    queryKey: ['superadmin-promo-codes'],
    queryFn: () => superadminApi.promoCodes().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      superadminApi.createPromoCode({
        code,
        plan,
        duration_days: parseInt(days) || 30,
        max_uses: maxUses ? parseInt(maxUses) : null,
        note: note || null,
      }),
    onSuccess: () => {
      toast.success('Промо-код создан');
      setShowCreate(false);
      setCode('');
      setNote('');
      setMaxUses('');
      refetch();
    },
    onError: () => toast.error('Ошибка создания промо-кода'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => superadminApi.deactivatePromoCode(id),
    onSuccess: () => {
      toast.success('Промо-код деактивирован');
      refetch();
    },
  });

  if (isLoading) return <ListSkeleton count={3} />;

  const codes = data || [];

  return (
    <div>
      <Button
        onClick={() => setShowCreate(!showCreate)}
        fullWidth
        variant={showCreate ? 'secondary' : 'primary'}
        className="mb-4"
      >
        {showCreate ? 'Отмена' : '+ Создать промо-код'}
      </Button>

      {showCreate && (
        <Card className="mb-4 flex flex-col gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Код (напр. PARTNER30)"
            className="input-field !h-auto !py-2.5"
          />
          <div className="flex gap-2">
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="flex-1 input-field !h-auto !py-2.5"
            >
              <option value="start">Start</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
            </select>
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="Дней"
              className="w-20 input-field !h-auto !py-2.5"
            />
          </div>
          <input
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Макс. использований (пусто = без лимита)"
            className="input-field !h-auto !py-2.5"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Заметка (для кого/зачем)"
            className="input-field !h-auto !py-2.5"
          />
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!code}
            loading={createMutation.isPending}
            fullWidth
            size="sm"
          >
            Создать
          </Button>
        </Card>
      )}

      {codes.length === 0 ? (
        <EmptyState emoji={'🎫'} title="Нет промо-кодов" description="Создайте первый промо-код" />
      ) : (
        <div className="flex flex-col gap-2">
          {codes.map((c) => (
            <Card key={c.id}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-sm font-mono">{c.code}</div>
                  <div className="text-xs text-tg-hint mt-0.5">
                    {c.plan} &middot; {c.duration_days} дней
                    {c.max_uses ? ` &middot; ${c.used_count}/${c.max_uses}` : ` &middot; ${c.used_count} исп.`}
                  </div>
                  {c.note && <div className="text-xs text-tg-hint mt-0.5">{c.note}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    label={c.is_active ? 'Активен' : 'Выкл'}
                    variant={c.is_active ? 'success' : 'neutral'}
                  />
                  {c.is_active && (
                    <button
                      onClick={() => deactivateMutation.mutate(c.id)}
                      className="text-xs text-red-500 underline"
                    >
                      Выкл
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface GrowthData {
  total_identities?: number;
  total_new_masters?: number;
  conversion_rate?: number;
  masters_by_week?: { week: string; count: number }[];
  retention_cohorts?: { month_offset: number; active_masters: number }[];
  revenue_by_plan?: Record<string, number>;
}

function GrowthTab() {
  const { data, isLoading } = useQuery<GrowthData>({
    queryKey: ['superadmin-growth'],
    queryFn: () => superadminApi.growth().then((r) => r.data),
  });

  if (isLoading) return <ListSkeleton count={3} />;

  const g = data || {};

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Регистрации" value={g.total_identities ?? 0} />
        <StatCard label="Новых мастеров" value={g.total_new_masters ?? 0} />
        <StatCard label="Конверсия" value={`${g.conversion_rate ?? 0}%`} />
      </div>

      {g.masters_by_week && g.masters_by_week.length > 0 && (
        <Card className="mb-3">
          <h3 className="text-sm font-medium mb-2">Мастера по неделям</h3>
          <div className="flex flex-col gap-1">
            {g.masters_by_week.map((w) => (
              <div key={w.week} className="flex justify-between text-xs">
                <span className="text-tg-hint">{w.week}</span>
                <span className="font-medium">+{w.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {g.retention_cohorts && (
        <Card className="mb-3">
          <h3 className="text-sm font-semibold mb-2">Retention (активные мастера)</h3>
          <div className="flex flex-col gap-1">
            {g.retention_cohorts.map((c) => (
              <div key={c.month_offset} className="flex justify-between text-xs">
                <span className="text-tg-hint">{c.month_offset === 0 ? 'Этот месяц' : `-${c.month_offset} мес`}</span>
                <span className="font-medium">{c.active_masters}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {g.revenue_by_plan && Object.keys(g.revenue_by_plan).length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold mb-2">Revenue по тарифам</h3>
          <div className="flex flex-col gap-1">
            {Object.entries(g.revenue_by_plan).map(([plan, rev]) => (
              <div key={plan} className="flex justify-between text-xs">
                <span className="capitalize">{plan}</span>
                <span className="font-medium">{rev.toLocaleString('ru')} ₽</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
