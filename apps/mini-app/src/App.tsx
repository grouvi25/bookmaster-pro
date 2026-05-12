import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { PlatformAdapter } from '@/platform/platform-adapter';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { authApi } from '@/api/endpoints';

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
import TabBar from '@/components/common/TabBar';

// Специальные страницы
import LinkPage from '@/pages/LinkPage';
import SuperadminPanel from '@/pages/superadmin/SuperadminPanel';

import Loading from '@/components/common/Loading';

function AppRouter() {
  const navigate = useNavigate();
  const { role, setUser, setAuth } = useAuthStore();
  useBookingStore.getState(); // ensure store is initialized
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      PlatformAdapter.detectPlatform();
      const user = await PlatformAdapter.getUser();
      if (user) setUser(user);

      const initData = PlatformAdapter.getInitData();
      if (initData) {
        try {
          const resp = await authApi.identify(initData);
          const data = resp.data;
          if (data.access_token) {
            setAuth(data.access_token, data.role, data.master_id);
          }
          // role='new' without token — user needs to register
        } catch {
          // не авторизован — покажем лендинг
        }
      }

      // Deep link навигация
      const startParam = PlatformAdapter.getStartParam();
      if (startParam) {
        if (startParam.startsWith('m_')) {
          const slug = startParam.slice(2);
          navigate(`/m/${slug}`);
        } else if (startParam === 'dashboard') {
          navigate('/master');
        } else if (startParam.startsWith('review_')) {
          navigate(`/review/${startParam.slice(7)}`);
        } else if (startParam === 'billing') {
          navigate('/billing');
        }
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
        {/* Главная */}
        <Route
          path="/"
          element={
            isMaster ? <Navigate to="/master" replace /> : <HomePage />
          }
        />

        {/* Клиентские роуты — запись к мастеру */}
        <Route path="/m/:slug" element={<MasterProfileRoute />} />
        <Route path="/book/service" element={<SelectService />} />
        <Route path="/book/date" element={<SelectDate />} />
        <Route path="/book/time" element={<SelectTime />} />
        <Route path="/book/promo" element={<PromoCode />} />
        <Route path="/book/confirm" element={<Confirm />} />
        <Route path="/book/success" element={<BookingSuccess />} />
        <Route path="/bookings" element={<MyBookings />} />

        {/* Мастерские роуты (с TabBar) */}
        <Route path="/master" element={<Dashboard />} />
        <Route path="/master/schedule" element={<Schedule />} />
        <Route path="/master/clients" element={<Clients />} />
        <Route path="/master/tools" element={<Tools />} />
        <Route path="/master/ai" element={<AIAssistant />} />
        <Route path="/master/settings" element={<Settings />} />

        {/* Публичная страница-линк (TapLink) */}
        <Route path="/p/:slug" element={<LinkPage />} />

        {/* Суперадмин */}
        <Route path="/superadmin" element={<SuperadminPanel />} />

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
      <div className="text-5xl mb-4">{'\ud83d\udcc5'}</div>
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
