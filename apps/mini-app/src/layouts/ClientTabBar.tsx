import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import clsx from 'clsx';
import { CalendarDays, Star, MapPin, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { bookingApi } from '@/api/endpoints';

interface Tab {
  path: string;
  label: string;
  Icon: LucideIcon;
}

const CLIENT_TABS: Tab[] = [
  { path: '/client', label: 'Записи', Icon: CalendarDays },
  { path: '/client/nearby', label: 'Поиск', Icon: MapPin },
  { path: '/client/loyalty', label: 'Баллы', Icon: Star },
  { path: '/client/profile', label: 'Профиль', Icon: User },
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
      <div className="bg-tg-bg/95 backdrop-blur-lg shadow-tab-bar rounded-2xl">
        <div className="flex justify-around items-center h-[60px]">
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
                className={clsx(
                  'flex flex-col items-center justify-center flex-1 h-full transition-all duration-200',
                  active ? 'text-brand-500' : 'text-tg-hint'
                )}
              >
                <div className={clsx(
                  'flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 mb-0.5',
                  active && 'bg-brand-500/10'
                )}>
                  <tab.Icon className="w-[20px] h-[20px]" strokeWidth={active ? 2.2 : 1.6} />
                </div>
                <span className={clsx(
                  'text-2xs transition-all',
                  active ? 'font-semibold' : 'font-medium'
                )}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
