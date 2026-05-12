import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { PlatformAdapter } from '@/platform/platform-adapter';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { authApi } from '@/api/endpoints';
import { ShieldAlert, CalendarDays } from 'lucide-react';

// Клиентские экраны
import MasterProfile from '@/pages/client/MasterProfile';
import SelectService from '@/pages/client/SelectService';
import SelectDate from '@/pages/client/SelectDate';
import SelectTime from '@/pages/client/SelectTime';
import PromoCode from '@/pages/client/PromoCode';
import Confirm from '@/pages/client/Confirm';
import BookingSuccess from '@/pages/client/BookingSuccess';
import MyBookings from '@/pages/client/MyBookings';

// Мастерские экраны
import Dashboard from '@/pages/master/Dashboard';
import Schedule from '@/pages/master/Schedule';
import Clients from '@/pages/master/Clients';
import Tools from '@/pages/master/Tools';
import AIAssistant from '@/pages/master/AI';
import Settings from '@/pages/master/Settings';
import Consultations from '@/pages/master/Consultations';
import TabBar from '@/components/common/TabBar';

// Специальные страницы
import LinkPage from '@/pages/LinkPage';
import SuperadminPanel from '@/pages/superadmin/SuperadminPanel';

import Loading from '@/components/common/Loading';
import Register from '@/pages/Register';


function RequireAuth({ children, allowedRoles }: { children: ReactNode; allowedRoles: string[] }) {
  const { role, token } = useAuthStore();
  if (!token || !role) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-tg-bg text-tg-text p-6">
        <ShieldAlert className="w-12 h-12 text-tg-hint mb-4" strokeWidth={1.5} />
        <h2 className="text-xl font-bold mb-2">Доступ запрещён</h2>
        <p className="text-tg-hint text-center text-sm">
          Откройте приложение через Telegram для авторизации
        </p>
      </div>
    );
  }
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}


function AppRouter() {
  const navigate = useNavigate();
  const { role, setUser, setAuth } = useAuthStore();
  useBookingStore.getState();
  const [initializing, setInitializing] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [hasTelegramContext, setHasTelegramContext] = useState(false);

  useEffect(() => {
    const init = async () => {
      PlatformAdapter.detectPlatform();
      const user = await PlatformAdapter.getUser();
      if (user) setUser(user);

      let authRole: string | null = null;

      const initData = PlatformAdapter.getInitData();
      if (initData) {
        setHasTelegramContext(true);
        try {
          const resp = await authApi.identify(initData);
          const data = resp.data;
          if (data.access_token) {
            setAuth(data.access_token, data.role, data.master_id);
            authRole = data.role;
          } else if (data.role === 'new') {
            setIsNewUser(true);
          }
        } catch {
          // не авторизован
        }
      }

      // Deep link навигация
      const startParam = PlatformAdapter.getStartParam();
      if (startParam) {
        if (startParam.startsWith('m_')) {
          const slug = startParam.slice(2);
          navigate(`/m/${slug}`);
        } else if (startParam === 'superadmin' && authRole === 'superadmin') {
          navigate('/superadmin');
        } else if (startParam === 'dashboard') {
          navigate('/master');
        } else if (startParam.startsWith('review_')) {
          navigate(`/review/${startParam.slice(7)}`);
        } else if (startParam === 'billing') {
          navigate('/billing');
        } else if (startParam.startsWith('ref_')) {
          navigate(`/?ref=${startParam.slice(4)}`);
        }
      } else if (authRole === 'superadmin') {
        navigate('/superadmin');
      }

      setInitializing(false);
    };
    init();
  }, []);

  if (initializing) return <Loading text="Загрузка BookMaster Pro..." />;

  const isMaster = role === 'master' || role === 'superadmin';

  return (
    <>
      <Routes>
        {/* Регистрация для новых пользователей */}
        <Route path="/register" element={<Register />} />

        {/* Главная */}
        <Route
          path="/"
          element={
            isNewUser ? (
              <Navigate to="/register" replace />
            ) : role === 'superadmin' ? (
              <Navigate to="/superadmin" replace />
            ) : isMaster ? (
              <Navigate to="/master" replace />
            ) : hasTelegramContext && !role ? (
              <Navigate to="/register" replace />
            ) : (
              <HomePage />
            )
          }
        />

        {/* Клиентские роуты — запись к мастеру (публичные, не требуют auth) */}
        <Route path="/m/:slug" element={<MasterProfileRoute />} />
        <Route path="/book/service" element={<SelectService />} />
        <Route path="/book/date" element={<SelectDate />} />
        <Route path="/book/time" element={<SelectTime />} />
        <Route path="/book/promo" element={<PromoCode />} />
        <Route path="/book/confirm" element={<Confirm />} />
        <Route path="/book/success" element={<BookingSuccess />} />
        <Route path="/bookings" element={<MyBookings />} />

        {/* Мастерские роуты — только для master и superadmin */}
        <Route path="/master" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Dashboard /></RequireAuth>} />
        <Route path="/master/schedule" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Schedule /></RequireAuth>} />
        <Route path="/master/clients" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Clients /></RequireAuth>} />
        <Route path="/master/tools" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Tools /></RequireAuth>} />
        <Route path="/master/ai" element={<RequireAuth allowedRoles={['master', 'superadmin']}><AIAssistant /></RequireAuth>} />
        <Route path="/master/settings" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Settings /></RequireAuth>} />
        <Route path="/master/consultations" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Consultations /></RequireAuth>} />

        {/* Публичная страница-линк (TapLink) */}
        <Route path="/p/:slug" element={<LinkPage />} />

        {/* Суперадмин — только superadmin */}
        <Route path="/superadmin" element={<RequireAuth allowedRoles={['superadmin']}><SuperadminPanel /></RequireAuth>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* TabBar для мастеров */}
      {isMaster && <TabBar />}
    </>
  );
}

function MasterProfileRoute() {
  const slug = window.location.pathname.split('/m/')[1]?.split('/')[0] || '';
  return <MasterProfile slug={slug} />;
}

function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-tg-bg text-tg-text p-6 animate-fade-in">
      <CalendarDays className="w-12 h-12 text-brand-500 mb-4" strokeWidth={1.5} />
      <h1 className="text-2xl font-bold mb-2">BookMaster Pro</h1>
      <p className="text-tg-hint text-center mb-6">
        Платформа онлайн-записи к мастерам
      </p>
      <p className="text-tg-hint text-sm text-center">
        Откройте ссылку от мастера для записи
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
