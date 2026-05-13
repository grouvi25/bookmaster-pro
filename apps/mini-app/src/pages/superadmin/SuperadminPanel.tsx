import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { superadminApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import {
  BarChart3, Users, Activity, ScrollText,
  DollarSign, MessageSquare, Settings, TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Tab = 'dashboard' | 'masters' | 'health' | 'audit' | 'finance' | 'tickets' | 'settings' | 'growth';

export default function SuperadminPanel() {
  const [tab, setTab] = useState<Tab>('dashboard');

  const tabs: { key: Tab; label: string; Icon: LucideIcon }[] = [
    { key: 'dashboard', label: 'Обзор', Icon: BarChart3 },
    { key: 'masters', label: 'Мастера', Icon: Users },
    { key: 'finance', label: 'Финансы', Icon: DollarSign },
    { key: 'tickets', label: 'Тикеты', Icon: MessageSquare },
    { key: 'growth', label: 'Рост', Icon: TrendingUp },
    { key: 'settings', label: 'Настройки', Icon: Settings },
    { key: 'health', label: 'Здоровье', Icon: Activity },
    { key: 'audit', label: 'Аудит', Icon: ScrollText },
  ];

  return (
    <div className="p-5 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight mb-4">Суперадмин</h1>

      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`chip whitespace-nowrap ${
              tab === key ? 'chip-active' : 'chip-inactive'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
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

function DashboardTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-dashboard'],
    queryFn: () => superadminApi.dashboard().then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  const stats = data || {};

  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: 'Всего мастеров', value: stats.total_masters ?? 0 },
        { label: 'Активных', value: stats.active_masters ?? 0 },
        { label: 'Записей сегодня', value: stats.today_bookings ?? 0 },
        { label: 'Выручка (мес)', value: `${(stats.month_revenue ?? 0).toLocaleString('ru')} \u20bd` },
        { label: 'Новых за неделю', value: stats.new_masters_week ?? 0 },
        { label: 'Тикетов открыто', value: stats.open_tickets ?? 0 },
      ].map((item) => (
        <div key={item.label} className="bg-surface-elevated shadow-card rounded-2xl p-3.5">
          <div className="text-xl font-bold">{item.value}</div>
          <div className="text-2xs text-tg-hint mt-0.5">{item.label}</div>
        </div>
      ))}
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

  const masters = data?.items || [];

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск мастеров..."
        className="input-field mb-3"
      />

      <div className="flex flex-col gap-2">
        {masters.map((m: Record<string, unknown>) => (
          <div
            key={m.id as number}
            className="bg-surface-elevated shadow-card rounded-2xl p-3.5 flex justify-between items-center"
          >
            <div>
              <div className="font-medium text-sm">{m.name as string}</div>
              <div className="text-xs text-tg-hint">
                {m.specialization as string} &middot; {m.tariff_plan as string}
              </div>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-lg ${
                m.is_active ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-500'
              }`}
            >
              {m.is_active ? 'Активен' : 'Неактивен'}
            </span>
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
                <span
                  className={`text-sm ${
                    status === 'ok' ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {status as string}
                </span>
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

  const logs = data?.items || [];

  return (
    <div className="flex flex-col gap-2">
      {logs.length === 0 ? (
        <p className="text-tg-hint text-center py-4">Нет записей</p>
      ) : (
        logs.map((log: Record<string, unknown>, i: number) => (
          <div key={i} className="bg-surface-elevated shadow-card rounded-2xl p-3.5">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{log.action as string}</span>
              <span className="text-xs text-tg-hint">{log.created_at as string}</span>
            </div>
            <div className="text-xs text-tg-hint mt-0.5">
              {log.user_name as string} &middot; {log.details as string}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function FinanceTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-finance'],
    queryFn: () => superadminApi.finance().then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  const f = data || {};

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: 'MRR', value: `${(f.mrr ?? 0).toLocaleString('ru')} \u20bd` },
          { label: 'ARR', value: `${(f.arr ?? 0).toLocaleString('ru')} \u20bd` },
          { label: 'Выручка (период)', value: `${(f.period_revenue ?? 0).toLocaleString('ru')} \u20bd` },
          { label: 'Возвраты', value: `${(f.total_refunds ?? 0).toLocaleString('ru')} \u20bd` },
          { label: 'Транзакций', value: f.transaction_count ?? 0 },
          { label: 'Прогноз 3м', value: `${(f.mrr_forecast_3m ?? 0).toLocaleString('ru')} \u20bd` },
        ].map((item) => (
          <div key={item.label} className="bg-surface-elevated shadow-card rounded-2xl p-3.5">
            <div className="text-lg font-bold">{item.value}</div>
            <div className="text-2xs text-tg-hint mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      {f.revenue_by_day && f.revenue_by_day.length > 0 && (
        <div className="bg-surface-elevated shadow-card rounded-2xl p-3.5">
          <h3 className="text-sm font-medium mb-2">Выручка по дням</h3>
          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {(f.revenue_by_day as Array<{date: string; revenue: number; count: number}>).map(
              (d: {date: string; revenue: number; count: number}) => (
                <div key={d.date} className="flex justify-between text-xs">
                  <span className="text-tg-hint">{d.date}</span>
                  <span>{d.revenue.toLocaleString('ru')} \u20bd ({d.count})</span>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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

  const tickets = data?.tickets || [];
  const openCount = data?.open_count ?? 0;

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {['', 'open', 'in_progress', 'resolved', 'escalated'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`chip ${
              statusFilter === s ? 'chip-active' : 'chip-inactive'
            }`}
          >
            {s || 'Все'}
          </button>
        ))}
      </div>

      <p className="text-xs text-tg-hint mb-3">Открытых: {openCount}</p>

      <div className="flex flex-col gap-2">
        {tickets.length === 0 ? (
          <p className="text-tg-hint text-center py-4">Нет тикетов</p>
        ) : (
          tickets.map((t: Record<string, unknown>) => (
            <div key={t.id as number} className="bg-surface-elevated shadow-card rounded-2xl p-3.5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-medium">#{t.id as number}: {t.subject as string}</div>
                  <div className="text-xs text-tg-hint mt-0.5">
                    Мастер #{t.master_id as number} &middot; {t.created_at as string}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-lg ${
                    t.status === 'open' ? 'bg-yellow-500/15 text-yellow-600' :
                    t.status === 'escalated' ? 'bg-red-500/15 text-red-500' :
                    t.status === 'resolved' ? 'bg-green-500/15 text-green-600' :
                    'bg-tg-secondary text-tg-hint'
                  }`}>
                    {t.status as string}
                  </span>
                  {t.status !== 'escalated' && t.status !== 'resolved' && (
                    <button
                      onClick={() => escalateMutation.mutate(t.id as number)}
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
              <span className="font-medium">{(price as number).toLocaleString('ru')} \u20bd/мес</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-elevated shadow-card rounded-2xl p-4 mb-3">
        <h3 className="text-sm font-semibold mb-2">Система</h3>
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex justify-between">
            <span className="text-tg-hint">AI-провайдер</span>
            <span>{s.ai_provider}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tg-hint">Таймзона</span>
            <span>{s.timezone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tg-hint">Окружение</span>
            <span>{s.environment}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tg-hint">Активных подписок</span>
            <span>{s.active_subscriptions}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GrowthTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-growth'],
    queryFn: () => superadminApi.growth().then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  const g = data || {};

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: 'Регистрации', value: g.total_identities ?? 0 },
          { label: 'Новых мастеров', value: g.total_new_masters ?? 0 },
          { label: 'Конверсия', value: `${g.conversion_rate ?? 0}%` },
        ].map((item) => (
          <div key={item.label} className="bg-surface-elevated shadow-card rounded-2xl p-3.5">
            <div className="text-lg font-bold">{item.value}</div>
            <div className="text-2xs text-tg-hint mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      {g.masters_by_week && g.masters_by_week.length > 0 && (
        <div className="bg-surface-elevated shadow-card rounded-2xl p-3.5 mb-3">
          <h3 className="text-sm font-medium mb-2">Мастера по неделям</h3>
          <div className="flex flex-col gap-1">
            {(g.masters_by_week as Array<{week: string; count: number}>).map(
              (w: {week: string; count: number}) => (
                <div key={w.week} className="flex justify-between text-xs">
                  <span className="text-tg-hint">{w.week}</span>
                  <span className="font-medium">+{w.count}</span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {g.retention_cohorts && (
        <div className="bg-surface-elevated shadow-card rounded-2xl p-3.5 mb-3">
          <h3 className="text-sm font-semibold mb-2">Retention (активные мастера)</h3>
          <div className="flex flex-col gap-1">
            {(g.retention_cohorts as Array<{month_offset: number; active_masters: number}>).map(
              (c: {month_offset: number; active_masters: number}) => (
                <div key={c.month_offset} className="flex justify-between text-xs">
                  <span className="text-tg-hint">{c.month_offset === 0 ? 'Этот месяц' : `-${c.month_offset} мес`}</span>
                  <span className="font-medium">{c.active_masters}</span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {g.revenue_by_plan && Object.keys(g.revenue_by_plan).length > 0 && (
        <div className="bg-surface-elevated shadow-card rounded-2xl p-3.5">
          <h3 className="text-sm font-semibold mb-2">Revenue по тарифам</h3>
          <div className="flex flex-col gap-1">
            {Object.entries(g.revenue_by_plan as Record<string, number>).map(([plan, rev]) => (
              <div key={plan} className="flex justify-between text-xs">
                <span className="capitalize">{plan}</span>
                <span className="font-medium">{rev.toLocaleString('ru')} \u20bd</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
