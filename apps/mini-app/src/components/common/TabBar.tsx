import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';

interface Tab {
  path: string;
  label: string;
  icon: string;
}

const MASTER_TABS: Tab[] = [
  { path: '/master', label: 'Главная', icon: '\ud83c\udfe0' },
  { path: '/master/schedule', label: 'Расписание', icon: '\ud83d\udcc5' },
  { path: '/master/clients', label: 'Клиенты', icon: '\ud83d\udc65' },
  { path: '/master/tools', label: 'Инструменты', icon: '\ud83c\udf81' },
  { path: '/master/ai', label: 'AI', icon: '\u2728' },
  { path: '/master/settings', label: 'Ещё', icon: '\u2699\ufe0f' },
];

export default function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-tg-bg border-t border-gray-200 z-50 safe-area-bottom">
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
              <span className="text-lg mb-0.5">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
