import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import clsx from 'clsx';
import { mastersApi, clientsApi } from '@/api/endpoints';

interface Tab {
  path: string;
  label: string;
  emoji: string;
}

const MASTER_TABS: Tab[] = [
  { path: '/master',          label: 'Главная',       emoji: '\uD83C\uDFE0' },
  { path: '/master/schedule', label: 'Расписание',    emoji: '\uD83D\uDCC5' },
  { path: '/master/services', label: 'Услуги',        emoji: '\u2702\uFE0F' },
  { path: '/master/clients',  label: 'Клиенты',       emoji: '\uD83D\uDC65' },
  { path: '/master/tools',    label: 'Инструменты',   emoji: '\uD83C\uDFAB' },
  { path: '/master/ai',       label: 'AI',             emoji: '\u2728' },
  { path: '/master/settings', label: 'Настройки',     emoji: '\u2699\uFE0F' },
];

const PREFETCH_MAP: Record<string, { key: string[]; fn: () => Promise<unknown> }[]> = {
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

export default function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const handlePrefetch = useCallback((path: string) => {
    const queries = PREFETCH_MAP[path];
    if (!queries) return;
    queries.forEach(({ key, fn }) => {
      queryClient.prefetchQuery({ queryKey: key, queryFn: fn });
    });
  }, [queryClient]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom"
      style={{
        height: '56px',
        background: 'var(--tg-theme-bg-color, #ffffff)',
        borderTop: '1px solid rgba(0,0,0,0.1)',
      }}
    >
      <div className="flex justify-around items-center h-full">
        {MASTER_TABS.map((tab) => {
          const active =
            tab.path === '/master'
              ? location.pathname === '/master'
              : location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              onTouchStart={() => handlePrefetch(tab.path)}
              onMouseEnter={() => handlePrefetch(tab.path)}
              className="flex flex-col items-center justify-center flex-1 h-full min-w-0 px-0.5"
            >
              <span className="text-[20px] leading-none mb-0.5">{tab.emoji}</span>
              <span
                className={clsx(
                  'text-[9px] font-medium leading-tight truncate max-w-full',
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
    </nav>
  );
}
