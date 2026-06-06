import { useEffect, useState, Component, lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { PlatformAdapter } from '@/platform/platform-adapter';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { authApi } from '@/api/endpoints';
import { ShieldAlert, CalendarDays } from 'lucide-react';
import { ToastContainer } from '@/shared/ui/Toast';
import FullscreenLoader from '@/shared/ui/FullscreenLoader';

// Layouts (eager — нужны сразу)
import ClientLayout from '@/layouts/ClientLayout';
import MasterLayout from '@/layouts/MasterLayout';
import TabBar from '@/components/common/TabBar';

// Клиентские экраны (lazy — код-сплиттинг)
const MasterProfile = lazy(() => import('@/pages/client/MasterProfile'));
const SelectService = lazy(() => import('@/pages/client/SelectService'));
const SelectDate = lazy(() => import('@/pages/client/SelectDate'));
const SelectTime = lazy(() => import('@/pages/client/SelectTime'));
const PromoCode = lazy(() => import('@/pages/client/PromoCode'));
const Confirm = lazy(() => import('@/pages/client/Confirm'));
const BookingSuccess = lazy(() => import('@/pages/client/BookingSuccess'));
const MyBookings = lazy(() => import('@/pages/client/MyBookings'));
const ClientLoyalty = lazy(() => import('@/pages/client/ClientLoyalty'));
const ClientProfile = lazy(() => import('@/pages/client/ClientProfile'));

// Мастерские экраны (lazy)
const Dashboard = lazy(() => import('@/pages/master/Dashboard'));
const Schedule = lazy(() => import('@/pages/master/Schedule'));
const Clients = lazy(() => import('@/pages/master/Clients'));
const ClientDetail = lazy(() => import('@/pages/master/ClientDetail'));
const Services = lazy(() => import('@/pages/master/Services'));
const Tools = lazy(() => import('@/pages/master/Tools'));
const AIAssistant = lazy(() => import('@/pages/master/AI'));
const Settings = lazy(() => import('@/pages/master/Settings'));
const Consultations = lazy(() => import('@/pages/master/Consultations'));
const LoyaltySettings = lazy(() => import('@/pages/master/LoyaltySettings'));
const Broadcast = lazy(() => import('@/pages/master/Broadcast'));
const Locations = lazy(() => import('@/pages/master/Locations'));
const Billing = lazy(() => import('@/pages/master/Billing'));
const LinkPageEditor = lazy(() => import('@/pages/master/LinkPageEditor'));
const BlockedSlots = lazy(() => import('@/pages/master/BlockedSlots'));
const AIContentTools = lazy(() => import('@/pages/master/AIContentTools'));
const AIKnowledge = lazy(() => import('@/pages/master/AIKnowledge'));
const VoiceDiary = lazy(() => import('@/pages/master/VoiceDiary'));
const WidgetSettings = lazy(() => import('@/pages/master/WidgetSettings'));
const SubscriptionPackages = lazy(() => import('@/pages/master/SubscriptionPackages'));
const WorkSchedule = lazy(() => import('@/pages/master/WorkSchedule'));
const Messages = lazy(() => import('@/pages/master/Messages'));

// Клиентские дополнительные экраны (lazy)
const LoyaltyHistory = lazy(() => import('@/pages/client/LoyaltyHistory'));
const ClientSubscriptions = lazy(() => import('@/pages/client/Subscriptions'));
const WaitlistJoin = lazy(() => import('@/pages/client/WaitlistJoin'));
const ReviewForm = lazy(() => import('@/pages/client/ReviewForm'));
const NearbyMasters = lazy(() => import('@/pages/client/NearbyMasters'));

// Тикет поддержки (lazy)
const TicketDetail = lazy(() => import('@/pages/support/TicketDetail'));

// Специальные страницы (lazy)
const LinkPage = lazy(() => import('@/pages/LinkPage'));
const EmbedPage = lazy(() => import('@/pages/EmbedPage'));
const ModeratorPanel = lazy(() => import('@/pages/moderator/ModeratorPanel'));
const SuperadminPanel = lazy(() => import('@/pages/superadmin/SuperadminPanel'));
const Register = lazy(() => import('@/pages/Register'));

// NpsPopup и SuperadminReturnButton — мелкие, грузим eager
import NpsPopup from '@/components/NpsPopup';
import { SuperadminReturnButton } from '@/pages/superadmin/SuperadminPanel';

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
          <ShieldAlert className="w-12 h-12 text-status-danger mb-4" strokeWidth={1.5} />
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
  const location = useLocation();
  const { role, setUser, setAuth, logout } = useAuthStore();
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
          } else if (data.role === 'new' || data.role === 'banned') {
            // Сервер не выдал токен — чистим любые stale-данные и шлём в онбординг.
            logout();
            setIsNewUser(true);
          }
        } catch (err: any) {
          if (err?.response?.status === 401) {
            // Невалидный/просроченный токен — принудительный онбординг.
            logout();
            setIsNewUser(true);
          } else {
            // Сетевая ошибка / сервер недоступен — оффлайн-режим:
            // доверяем закэшированной роли (master/client) из localStorage.
            authRole = useAuthStore.getState().role;
          }
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
        } else if (startParam === 'moderator' && (authRole === 'moderator' || authRole === 'superadmin')) {
          navigate('/moderator');
        } else if (startParam === 'dashboard') {
          navigate('/master');
        } else if (startParam.startsWith('review_')) {
          navigate(`/review/${startParam.slice(7)}`);
        } else if (startParam === 'waitlist') {
          navigate('/book/waitlist');
        } else if (startParam === 'billing') {
          navigate('/billing');
        } else if (startParam.startsWith('ticket_')) {
          navigate(`/support/ticket/${startParam.slice(7)}`);
        } else if (startParam.startsWith('rate_ticket_')) {
          navigate(`/support/ticket/${startParam.slice(12)}?rate=1`);
        } else if (startParam.startsWith('chat-')) {
          const threadId = Number(startParam.slice(5));
          if (threadId) {
            const toMaster = authRole === 'master' || authRole === 'superadmin';
            navigate(toMaster ? '/master/messages' : '/client/messages', { state: { openThreadId: threadId } });
          }
        } else if (startParam.startsWith('ref_')) {
          navigate(`/?ref=${startParam.slice(4)}`);
        }
      } else if (authRole === 'superadmin') {
        navigate('/superadmin');
      } else if (authRole === 'moderator') {
        navigate('/moderator');
      }

      setInitializing(false);
    };
    init();
  }, []);

  if (initializing) return <FullscreenLoader text="Загрузка BookMaster Pro..." />;

  const isMaster = role === 'master' || role === 'superadmin';

  return (
    <>
      <RouteErrorBoundary>
      <Suspense fallback={<FullscreenLoader text="Загрузка…" />}>
      <Routes>
        {/* Регистрация для новых пользователей */}
        <Route path="/register" element={<Register />} />

        {/* Главная */}
        <Route
          path="/"
          element={
            role === 'superadmin' ? (
              <Navigate to="/superadmin" replace />
            ) : role === 'moderator' ? (
              <Navigate to="/moderator" replace />
            ) : isMaster ? (
              <Navigate to="/master" replace />
            ) : role === 'client' ? (
              <Navigate to="/client" replace />
            ) : isNewUser || (hasTelegramContext && (!role || role === ('new' as any))) ? (
              <Navigate to="/register" replace />
            ) : (
              <HomePage />
            )
          }
        />

        {/* Клиентский layout с tab bar */}
        <Route element={<ClientLayout />}>
          <Route path="/client" element={<MyBookings hideBack />} />
          <Route path="/client/nearby" element={<NearbyMasters />} />
          <Route path="/client/loyalty" element={<ClientLoyalty />} />
          <Route path="/client/profile" element={<ClientProfile />} />
          <Route path="/client/messages" element={<Messages />} />
        </Route>

        {/* Клиентские роуты — запись к мастеру (без tab bar) */}
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
        <Route path="/support/ticket/:ticketId" element={<TicketDetail />} />
        <Route path="/nearby" element={<NearbyMasters />} />

        {/* Мастерские роуты — обёрнуты в MasterLayout (pb-24, bg, animate) */}
        <Route element={<RequireAuth allowedRoles={['master', 'superadmin']}><MasterLayout /></RequireAuth>}>
          <Route path="/master" element={<Dashboard />} />
          <Route path="/master/schedule" element={<Schedule />} />
          <Route path="/master/clients" element={<Clients />} />
          <Route path="/master/tools" element={<Tools />} />
          <Route path="/master/ai" element={<AIAssistant />} />
          <Route path="/master/settings" element={<Settings />} />
          <Route path="/master/services" element={<Services />} />
          <Route path="/master/clients/:clientId" element={<ClientDetail />} />
          <Route path="/master/consultations" element={<Consultations />} />
          <Route path="/master/loyalty-settings" element={<LoyaltySettings />} />
          <Route path="/master/broadcast" element={<Broadcast />} />
          <Route path="/master/locations" element={<Locations />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/link-page/edit" element={<LinkPageEditor />} />
          <Route path="/master/blocked-slots" element={<BlockedSlots />} />
          <Route path="/master/ai/content" element={<AIContentTools />} />
          <Route path="/master/ai/knowledge" element={<AIKnowledge />} />
          <Route path="/master/ai/voice-diary" element={<VoiceDiary />} />
          <Route path="/master/widget" element={<WidgetSettings />} />
          <Route path="/master/subscription-packages" element={<SubscriptionPackages />} />
          <Route path="/master/work-schedule" element={<WorkSchedule />} />
          <Route path="/master/messages" element={<Messages />} />
        </Route>

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
      </Suspense>
      </RouteErrorBoundary>

      {/* TabBar для мастеров. Показываем ТОЛЬКО на мастерских экранах,
          чтобы он не перекрывал кнопки на клиентских страницах записи
          (/m/:slug, /book/*), когда мастер открывает ссылку для записи. */}
      {isMaster
        && (
          location.pathname.startsWith('/master')
          || location.pathname.startsWith('/billing')
          || location.pathname.startsWith('/link-page')
        )
        && !location.pathname.startsWith('/superadmin')
        && !location.pathname.startsWith('/moderator')
        && <TabBar />}

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
