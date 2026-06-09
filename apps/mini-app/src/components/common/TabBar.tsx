import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import clsx from 'clsx';
import { mastersApi, clientsApi, bookingApi } from '@/api/endpoints';

interface Tab {
  path: string;
  label: string;
  emoji: string;
}

type PrefetchMap = Record<string, { key: string[]; fn: () => Promise<unknown> }[]>;

const MASTER_TABS: Tab[] = [
  { path: '/master',           label: 'Главная',     emoji: '🏠' },
  { path: '/master/schedule',  label: 'Расписание',  emoji: '📅' },
  { path: '/master/clients',   label: 'Клиенты',     emoji: '👥' },
  { path: '/master/messages',  label: 'Чаты',        emoji: '💬' },
  { path: '/master/ai',        label: 'AI',           emoji: '✨' },
  { path: '/master/settings',  label: 'Ещё',         emoji: '⚙️' },
];

const MASTER_PREFETCH: PrefetchMap = {
  '/master': [
    { key: ['master-stats'], fn: () => mastersApi.getStats().then((r) => r.data) },
  ],
  '/master/schedule': [
    { key: ['master-schedule'], fn: () => mastersApi.getSchedule().then((r) => r.data) },
  ],
  '/master/clients': [
    { key: ['clients'], fn: () => clientsApi.list().then((r) => r.data) },
  ],
  '/master/services': [
    { key: ['services'], fn: () => mastersApi.getProfile().then((r) => r.data) },
  ],
  '/master/settings': [
    { key: ['master-profile'], fn: () => mastersApi.getProfile().then((r) => r.data) },
  ],
};

const CLIENT_TABS: Tab[] = [
  { path: '/client',         label: 'Записи',  emoji: '📅' },
  { path: '/client/nearby',  label: 'Поиск',   emoji: '📍' },
  { path: '/client/messages', label: 'Чаты',    emoji: '💬' },
  { path: '/client/loyalty', label: 'Баллы',   emoji: '⭐' },
  { path: '/client/profile', label: 'Профиль', emoji: '👤' },
];

const CLIENT_PREFETCH: PrefetchMap = {
  '/client': [
    { key: ['my-bookings'], fn: () => bookingApi.myBookings().then((r) => r.data) },
  ],
};

// ── Generic TabBar ──────────────────────────────────────────
function BaseTabBar({ tabs, prefetchMap }: { tabs: Tab[]; prefetchMap: PrefetchMap }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const rootPath = tabs[0]?.path ?? '';

  const handlePrefetch = useCallback((path: string) => {
    const queries = prefetchMap[path];
    if (!queries) return;
    queries.forEach(({ key, fn }) => {
      queryClient.prefetchQuery({ queryKey: key, queryFn: fn });
    });
  }, [queryClient, prefetchMap]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom px-4 pb-2">
      <div className="bg-tg-bg/95 backdrop-blur-lg shadow-tab-bar rounded-card">
        <div className="flex justify-around items-center h-[56px]">
          {tabs.map((tab) => {
            const active =
              tab.path === rootPath
                ? location.pathname === rootPath
                : location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                onTouchStart={() => handlePrefetch(tab.path)}
                onMouseEnter={() => handlePrefetch(tab.path)}
                className="flex flex-col items-center justify-center flex-1 h-full min-w-0 px-0.5"
              >
                <span className="text-[24px] leading-none mb-0.5">{tab.emoji}</span>
                <span
                  className={clsx(
                    'text-[10px] font-medium leading-tight truncate max-w-full',
                    active
                      ? 'text-tg-button'
                      : 'text-tg-hint'
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// ── Exports ─────────────────────────────────────────────────
export default function TabBar() {
  return <BaseTabBar tabs={MASTER_TABS} prefetchMap={MASTER_PREFETCH} />;
}

export function ClientTabBar() {
  return <BaseTabBar tabs={CLIENT_TABS} prefetchMap={CLIENT_PREFETCH} />;
}
