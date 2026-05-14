import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { superadminApi, authApi } from '@/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import { useAuthStore } from '@/stores/auth';
import { toArray } from '@/shared/lib/normalize';
import Loading from '@/components/common/Loading';
import PageHeader from '@/shared/ui/PageHeader';
import ChipTabs from '@/shared/ui/ChipTabs';
import StatCard from '@/shared/ui/StatCard';
import StatusBadge from '@/shared/ui/StatusBadge';
import EmptyState from '@/shared/ui/EmptyState';
import SearchInput from '@/shared/ui/SearchInput';
import {
  BarChart3, Users, Activity, ScrollText,
  DollarSign, MessageSquare, Settings, TrendingUp,
  UserCircle, Wrench, ArrowRightLeft,
} from 'lucide-react';
import type { MasterProfile, AuditLogEntry, SupportTicket } from '@/shared/types/api';

type Tab = 'dashboard' | 'masters' | 'health' | 'audit' | 'finance' | 'tickets' | 'settings' | 'growth';

const TABS: { key: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { key: 'dashboard', label: 'Обзор', Icon: BarChart3 },
  { key: 'masters', label: 'Мастера', Icon: Users },
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
    <div className="p-5 pb-24 animate-fade-in">
      <PageHeader title="Суперадмин" />

      {/* Role switcher */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => switchToRole('master')}
          disabled={switching}
          className="flex-1 flex items-center justify-center gap-2 p-3 bg-brand-500/10 text-brand-600 rounded-2xl text-sm font-medium active:scale-[0.97] transition-all disabled:opacity-50"
        >
          <Wrench className="w-4 h-4" />
          {switching ? '...' : 'Режим мастера'}
        </button>
        <button
          onClick={() => switchToRole('client')}
          disabled={switching}
          className="flex-1 flex items-center justify-center gap-2 p-3 bg-blue-500/10 text-blue-600 rounded-2xl text-sm font-medium active:scale-[0.97] transition-all disabled:opacity-50"
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

  if (isLoading) return <Loading />;

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

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-masters', search],
    queryFn: () => superadminApi.masters({ q: search }).then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  const masters = toArray<MasterProfile>(data);

  return (
    <div>
      <div className="mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Поиск мастеров..." />
      </div>

      <div className="flex flex-col gap-2">
        {masters.map((m) => (
          <div
            key={m.id}
            className="bg-surface-elevated shadow-card rounded-2xl p-3.5 flex justify-between items-center"
          >
            <div>
              <div className="font-medium text-sm">{m.display_name}</div>
              <div className="text-xs text-tg-hint">
                {m.specialization} &middot; {m.current_plan}
              </div>
            </div>
            <StatusBadge
              label={m.is_verified ? 'Активен' : 'Неактивен'}
              variant={m.is_verified ? 'success' : 'danger'}
            />
          </div>
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
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full bg-brand-500 text-white py-3 rounded-2xl font-semibold shadow-button mb-4 disabled:opacity-40 active:scale-[0.97] transition-all"
      >
        {mutation.isPending ? 'Проверка...' : 'Запустить проверку здоровья'}
      </button>

      {mutation.data && (
        <div className="flex flex-col gap-2">
          {Object.entries(mutation.data.data || {}).map(
            ([service, status]) => (
              <div
                key={service}
                className="bg-surface-elevated shadow-card rounded-2xl p-3.5 flex justify-between"
              >
                <span className="text-sm font-medium">{service}</span>
                <StatusBadge
                  label={status as string}
                  variant={status === 'ok' ? 'success' : 'danger'}
                />
              </div>
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

  if (isLoading) return <Loading />;

  const logs = toArray<AuditLogEntry>(data);

  return (
    <div className="flex flex-col gap-2">
      {logs.length === 0 ? (
        <EmptyState Icon={ScrollText} title="Нет записей" />
      ) : (
        logs.map((log, i) => (
          <div key={i} className="bg-surface-elevated shadow-card rounded-2xl p-3.5">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{log.action}</span>
              <span className="text-xs text-tg-hint">{log.created_at}</span>
            </div>
            <div className="text-xs text-tg-hint mt-0.5">
              {log.user_name} &middot; {log.details}
            </div>
          </div>
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

  if (isLoading) return <Loading />;

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
        <div className="bg-surface-elevated shadow-card rounded-2xl p-3.5">
          <h3 className="text-sm font-medium mb-2">Выручка по дням</h3>
          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {f.revenue_by_day.map((d) => (
              <div key={d.date} className="flex justify-between text-xs">
                <span className="text-tg-hint">{d.date}</span>
                <span>{d.revenue.toLocaleString('ru')} ₽ ({d.count})</span>
              </div>
            ))}
          </div>
        </div>
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

  if (isLoading) return <Loading />;

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
          <EmptyState Icon={MessageSquare} title="Нет тикетов" />
        ) : (
          tickets.map((t) => (
            <div key={t.id} className="bg-surface-elevated shadow-card rounded-2xl p-3.5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-medium">#{t.id}: {t.subject}</div>
                  <div className="text-xs text-tg-hint mt-0.5">
                    Мастер #{t.master_id} &middot; {t.created_at}
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
            </div>
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

  if (isLoading) return <Loading />;

  const s = data || {};

  return (
    <div>
      <div className="bg-surface-elevated shadow-card rounded-2xl p-4 mb-3">
        <h3 className="text-sm font-semibold mb-2">Тарифы</h3>
        <div className="flex flex-col gap-1">
          {Object.entries(s.plan_prices || {}).map(([plan, price]) => (
            <div key={plan} className="flex justify-between text-xs">
              <span className="capitalize">{plan}</span>
              <span className="font-medium">{(price as number).toLocaleString('ru')} ₽/мес</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-elevated shadow-card rounded-2xl p-4 mb-3">
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
      </div>
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

  if (isLoading) return <Loading />;

  const g = data || {};

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Регистрации" value={g.total_identities ?? 0} />
        <StatCard label="Новых мастеров" value={g.total_new_masters ?? 0} />
        <StatCard label="Конверсия" value={`${g.conversion_rate ?? 0}%`} />
      </div>

      {g.masters_by_week && g.masters_by_week.length > 0 && (
        <div className="bg-surface-elevated shadow-card rounded-2xl p-3.5 mb-3">
          <h3 className="text-sm font-medium mb-2">Мастера по неделям</h3>
          <div className="flex flex-col gap-1">
            {g.masters_by_week.map((w) => (
              <div key={w.week} className="flex justify-between text-xs">
                <span className="text-tg-hint">{w.week}</span>
                <span className="font-medium">+{w.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {g.retention_cohorts && (
        <div className="bg-surface-elevated shadow-card rounded-2xl p-3.5 mb-3">
          <h3 className="text-sm font-semibold mb-2">Retention (активные мастера)</h3>
          <div className="flex flex-col gap-1">
            {g.retention_cohorts.map((c) => (
              <div key={c.month_offset} className="flex justify-between text-xs">
                <span className="text-tg-hint">{c.month_offset === 0 ? 'Этот месяц' : `-${c.month_offset} мес`}</span>
                <span className="font-medium">{c.active_masters}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {g.revenue_by_plan && Object.keys(g.revenue_by_plan).length > 0 && (
        <div className="bg-surface-elevated shadow-card rounded-2xl p-3.5">
          <h3 className="text-sm font-semibold mb-2">Revenue по тарифам</h3>
          <div className="flex flex-col gap-1">
            {Object.entries(g.revenue_by_plan).map(([plan, rev]) => (
              <div key={plan} className="flex justify-between text-xs">
                <span className="capitalize">{plan}</span>
                <span className="font-medium">{rev.toLocaleString('ru')} ₽</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
