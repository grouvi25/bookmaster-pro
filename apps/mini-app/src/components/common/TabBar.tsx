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
    <nav className="fixed bottom-0 left-0 right-0 bg-tg-bg border-t border-gray-200/60 z-50 safe-area-bottom">
      <div className="flex justify-around items-center h-14">
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
                'flex flex-col items-center justify-center flex-1 h-full text-xs transition-colors',
                active ? 'text-brand-600' : 'text-tg-hint'
              )}
            >
              <tab.Icon className="w-5 h-5 mb-0.5" strokeWidth={active ? 2.2 : 1.8} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
