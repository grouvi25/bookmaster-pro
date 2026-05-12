import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { superadminApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';

type Tab = 'dashboard' | 'masters' | 'health' | 'audit';

export default function SuperadminPanel() {
  const [tab, setTab] = useState<Tab>('dashboard');

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Обзор', icon: '\ud83d\udcca' },
    { key: 'masters', label: 'Мастера', icon: '\ud83d\udc65' },
    { key: 'health', label: 'Здоровье', icon: '\ud83d\udfe2' },
    { key: 'audit', label: 'Аудит', icon: '\ud83d\udcdd' },
  ];

  return (
    <div className="p-4 animate-fade-in">
      <h1 className="text-xl font-bold mb-3">Суперадмин</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              tab === key
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-secondary text-tg-text'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'masters' && <MastersTab />}
      {tab === 'health' && <HealthTab />}
      {tab === 'audit' && <AuditTab />}
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
        <div key={item.label} className="bg-tg-secondary rounded-xl p-3">
          <div className="text-xl font-bold">{item.value}</div>
          <div className="text-xs text-tg-hint">{item.label}</div>
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
        className="w-full px-4 py-2.5 bg-tg-secondary rounded-xl text-sm outline-none mb-3"
      />

      <div className="flex flex-col gap-2">
        {masters.map((m: Record<string, unknown>) => (
          <div
            key={m.id as number}
            className="bg-tg-secondary rounded-xl p-3 flex justify-between items-center"
          >
            <div>
              <div className="font-medium text-sm">{m.name as string}</div>
              <div className="text-xs text-tg-hint">
                {m.specialization as string} &middot; {m.tariff_plan as string}
              </div>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-lg ${
                m.is_active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
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
        className="w-full bg-tg-button text-tg-button-text py-3 rounded-xl font-medium mb-4 disabled:opacity-50"
      >
        {mutation.isPending ? 'Проверка...' : 'Запустить проверку здоровья'}
      </button>

      {mutation.data && (
        <div className="flex flex-col gap-2">
          {Object.entries(mutation.data.data || {}).map(
            ([service, status]) => (
              <div
                key={service}
                className="bg-tg-secondary rounded-xl p-3 flex justify-between"
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
          <div key={i} className="bg-tg-secondary rounded-xl p-3">
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
