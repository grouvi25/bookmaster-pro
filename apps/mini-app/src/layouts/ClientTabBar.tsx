import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import clsx from 'clsx';
import { bookingApi } from '@/api/endpoints';

interface Tab {
  path: string;
  label: string;
  emoji: string;
}

const CLIENT_TABS: Tab[] = [
  { path: '/client',         label: 'Записи',  emoji: '\uD83D\uDCC5' },
  { path: '/client/nearby',  label: 'Поиск',   emoji: '\uD83D\uDCCD' },
  { path: '/client/loyalty', label: 'Баллы',   emoji: '\u2B50' },
  { path: '/client/profile', label: 'Профиль', emoji: '\uD83D\uDC64' },
];

const PREFETCH_MAP: Record<string, { key: string[]; fn: () => Promise<unknown> }[]> = {
  '/client': [
    { key: ['my-bookings'], fn: () => bookingApi.myBookings().then((r) => r.data) },
  ],
};

export default function ClientTabBar() {
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom px-4 pb-2">
      <div className="bg-tg-bg/95 backdrop-blur-lg shadow-tab-bar rounded-card">
        <div className="flex justify-around items-center h-[56px]">
          {CLIENT_TABS.map((tab) => {
            const active =
              tab.path === '/client'
                ? location.pathname === '/client'
                : location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                onTouchStart={() => handlePrefetch(tab.path)}
                onMouseEnter={() => handlePrefetch(tab.path)}
                className="flex flex-col items-center justify-center flex-1 h-full"
              >
                <span className="text-[24px] leading-none mb-0.5">{tab.emoji}</span>
                <span
                  className={clsx(
                    'text-[10px] font-medium',
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
