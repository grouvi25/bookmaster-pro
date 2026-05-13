import { useEffect, useState, Component, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { PlatformAdapter } from '@/platform/platform-adapter';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { authApi } from '@/api/endpoints';
import { ShieldAlert, CalendarDays } from 'lucide-react';
import { ToastContainer } from '@/shared/ui/Toast';

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
import ClientDetail from '@/pages/master/ClientDetail';
import Services from '@/pages/master/Services';
import Tools from '@/pages/master/Tools';
import AIAssistant from '@/pages/master/AI';
import Settings from '@/pages/master/Settings';
import Consultations from '@/pages/master/Consultations';
import LoyaltySettings from '@/pages/master/LoyaltySettings';
import Broadcast from '@/pages/master/Broadcast';
import Locations from '@/pages/master/Locations';
import Billing from '@/pages/master/Billing';
import LinkPageEditor from '@/pages/master/LinkPageEditor';
import BlockedSlots from '@/pages/master/BlockedSlots';
import AIContentTools from '@/pages/master/AIContentTools';
import VoiceDiary from '@/pages/master/VoiceDiary';
import WidgetSettings from '@/pages/master/WidgetSettings';
import SubscriptionPackages from '@/pages/master/SubscriptionPackages';
import TabBar from '@/components/common/TabBar';

// Клиентские дополнительные экраны
import LoyaltyHistory from '@/pages/client/LoyaltyHistory';
import ClientSubscriptions from '@/pages/client/Subscriptions';
import WaitlistJoin from '@/pages/client/WaitlistJoin';
import ReviewForm from '@/pages/client/ReviewForm';
import NearbyMasters from '@/pages/client/NearbyMasters';

// Специальные страницы
import LinkPage from '@/pages/LinkPage';
import EmbedPage from '@/pages/EmbedPage';
import NpsPopup from '@/components/NpsPopup';
import ModeratorPanel from '@/pages/moderator/ModeratorPanel';
import SuperadminPanel from '@/pages/superadmin/SuperadminPanel';
import { SuperadminReturnButton } from '@/pages/superadmin/SuperadminPanel';

import Loading from '@/components/common/Loading';
import Register from '@/pages/Register';


class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] bg-tg-bg text-tg-text p-6">
          <ShieldAlert className="w-12 h-12 text-red-400 mb-4" strokeWidth={1.5} />
          <h2 className="text-xl font-bold mb-2">Ошибка загрузки</h2>
          <p className="text-tg-hint text-center text-sm mb-4">
            Произошла ошибка при загрузке страницы
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-6 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-semibold"
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
        } else if (startParam === 'waitlist') {
          navigate('/book/waitlist');
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
      <RouteErrorBoundary>
      <Routes>
        {/* Регистрация для новых пользователей */}
        <Route path="/register" element={<Register />} />

        {/* Главная */}
        <Route
          path="/"
          element={
            role === 'superadmin' ? (
              <Navigate to="/superadmin" replace />
            ) : isMaster ? (
              <Navigate to="/master" replace />
            ) : role === 'client' ? (
              <HomePage />
            ) : isNewUser || (hasTelegramContext && !role) ? (
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
        <Route path="/book/waitlist" element={<WaitlistJoin />} />
        <Route path="/loyalty/:masterId" element={<LoyaltyHistory />} />
        <Route path="/subscriptions" element={<ClientSubscriptions />} />
        <Route path="/review/:appointmentId" element={<ReviewForm />} />
        <Route path="/nearby" element={<NearbyMasters />} />

        {/* Мастерские роуты — только для master и superadmin */}
        <Route path="/master" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Dashboard /></RequireAuth>} />
        <Route path="/master/schedule" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Schedule /></RequireAuth>} />
        <Route path="/master/clients" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Clients /></RequireAuth>} />
        <Route path="/master/tools" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Tools /></RequireAuth>} />
        <Route path="/master/ai" element={<RequireAuth allowedRoles={['master', 'superadmin']}><AIAssistant /></RequireAuth>} />
        <Route path="/master/settings" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Settings /></RequireAuth>} />
        <Route path="/master/services" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Services /></RequireAuth>} />
        <Route path="/master/clients/:clientId" element={<RequireAuth allowedRoles={['master', 'superadmin']}><ClientDetail /></RequireAuth>} />
        <Route path="/master/consultations" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Consultations /></RequireAuth>} />
        <Route path="/master/loyalty-settings" element={<RequireAuth allowedRoles={['master', 'superadmin']}><LoyaltySettings /></RequireAuth>} />
        <Route path="/master/broadcast" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Broadcast /></RequireAuth>} />
        <Route path="/master/locations" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Locations /></RequireAuth>} />
        <Route path="/billing" element={<RequireAuth allowedRoles={['master', 'superadmin']}><Billing /></RequireAuth>} />
        <Route path="/link-page/edit" element={<RequireAuth allowedRoles={['master', 'superadmin']}><LinkPageEditor /></RequireAuth>} />
        <Route path="/master/blocked-slots" element={<RequireAuth allowedRoles={['master', 'superadmin']}><BlockedSlots /></RequireAuth>} />
        <Route path="/master/ai/content" element={<RequireAuth allowedRoles={['master', 'superadmin']}><AIContentTools /></RequireAuth>} />
        <Route path="/master/ai/voice-diary" element={<RequireAuth allowedRoles={['master', 'superadmin']}><VoiceDiary /></RequireAuth>} />
        <Route path="/master/widget" element={<RequireAuth allowedRoles={['master', 'superadmin']}><WidgetSettings /></RequireAuth>} />
        <Route path="/master/subscription-packages" element={<RequireAuth allowedRoles={['master', 'superadmin']}><SubscriptionPackages /></RequireAuth>} />

        {/* Публичная страница-линк (TapLink) */}
        <Route path="/p/:slug" element={<LinkPage />} />

        {/* Embed для iframe виджета */}
        <Route path="/embed/:slug" element={<EmbedPage />} />

        {/* Модератор — только moderator и superadmin */}
        <Route path="/moderator" element={<RequireAuth allowedRoles={['moderator', 'superadmin']}><ModeratorPanel /></RequireAuth>} />

        {/* Суперадмин — только superadmin */}
        <Route path="/superadmin" element={<RequireAuth allowedRoles={['superadmin']}><SuperadminPanel /></RequireAuth>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </RouteErrorBoundary>

      {/* TabBar для мастеров */}
      {isMaster && <TabBar />}

      {/* Кнопка возврата в суперадминку */}
      <SuperadminReturnButton />

      {/* NPS опрос после визита */}
      <NpsPopup />
    </>
  );
}

function MasterProfileRoute() {
  const { slug = '' } = useParams<{ slug: string }>();
  return <MasterProfile slug={slug} />;
}

function HomePage() {
  const { role } = useAuthStore();
  if (role === 'client') {
    return <MyBookings hideBack />;
  }
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
      <ToastContainer />
      <AppRouter />
    </BrowserRouter>
  );
}
