import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Home, CalendarDays, Users, Wrench, Sparkles, Menu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Tab {
  path: string;
  label: string;
  Icon: LucideIcon;
}

const MASTER_TABS: Tab[] = [
  { path: '/master', label: 'Главная', Icon: Home },
  { path: '/master/schedule', label: 'Расписание', Icon: CalendarDays },
  { path: '/master/clients', label: 'Клиенты', Icon: Users },
  { path: '/master/tools', label: 'Инструменты', Icon: Wrench },
  { path: '/master/ai', label: 'AI', Icon: Sparkles },
  { path: '/master/settings', label: 'Ещё', Icon: Menu },
];

export default function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom px-4 pb-2">
      <div className="bg-tg-bg/95 backdrop-blur-lg shadow-tab-bar rounded-2xl">
        <div className="flex justify-around items-center h-[60px]">
          {MASTER_TABS.map((tab) => {
            const active =
              tab.path === '/master'
                ? location.pathname === '/master'
                : location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
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
