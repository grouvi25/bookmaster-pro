import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bookingApi, paymentsApi, subscriptionsApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { User, Scissors, CalendarDays, Clock, CreditCard, Wallet, Banknote, Coins, Ticket, ShieldAlert } from 'lucide-react';

interface ClientSubscription {
  id: number;
  package_name: string;
  total_visits: number;
  used_visits: number;
  is_active: boolean;
}

type PaymentType = 'full' | 'prepay_30' | 'prepay_50' | 'points' | 'subscription' | 'none';

export default function Confirm() {
  const navigate = useNavigate();
  const store = useBookingStore();
  const [loading, setLoading] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>('none');

  const { data: clientSubs } = useQuery<ClientSubscription[]>({
    queryKey: ['client-subscriptions'],
    queryFn: () => subscriptionsApi.list().then((r) => r.data),
  });

  // NoShow risk check — AI scoring level 4
  const { data: noshowRisk } = useQuery({
    queryKey: ['noshow-risk', store.masterId],
    queryFn: () => bookingApi.noshowRisk(store.masterId!).then((r) => r.data),
    enabled: !!store.masterId,
    staleTime: 60_000,
  });

  const requirePrepay = noshowRisk?.require_prepay === true;

  // Auto-select payment when prepay required and current selection is 'none'
  useEffect(() => {
    if (requirePrepay && paymentType === 'none') {
      setPaymentType('full');
    }
  }, [requirePrepay, paymentType]);

  // Guard: redirect if no master/service (after all hooks — Rules of Hooks)
  if (!store.masterId || !store.serviceId || !store.selectedDate || !store.selectedTime) {
    navigate('/client/nearby', { replace: true });
    return null;
  }

  const activeSub = clientSubs?.find((s) => s.is_active && s.used_visits < s.total_visits);

  const discountAmount = store.discount < 100
    ? store.servicePrice * store.discount / 100
    : store.discount;

  const pointsDiscount = paymentType === 'points' ? store.loyaltyPoints : 0;

  const finalPrice = Math.max(0, store.servicePrice - discountAmount);

  const payableAmount = Math.max(0, finalPrice - pointsDiscount);

  const getPaymentAmount = (): number => {
    switch (paymentType) {
      case 'full':
        return payableAmount;
      case 'prepay_30':
        return Math.round(payableAmount * 0.3);
      case 'prepay_50':
        return Math.round(payableAmount * 0.5);
      case 'points':
        return Math.max(0, payableAmount);
      case 'none':
      default:
        return 0;
    }
  };

  const handleConfirm = async () => {
    // Server-side guard: block "none" if prepay required
    if (requirePrepay && paymentType === 'none') {
      toast.error('Необходимо выбрать способ оплаты');
      return;
    }

    setLoading(true);
    try {
      const bookingData = {
        master_id: store.masterId,
        service_id: store.serviceId,
        date: store.selectedDate,
        time_start: store.selectedTime,
        promo_code: store.promoCode || undefined,
        use_loyalty_points: paymentType === 'points',
        subscription_id: paymentType === 'subscription' ? activeSub?.id : undefined,
      };

      const bookingResp = await bookingApi.create(bookingData);
      const appointmentId = bookingResp.data.id;

      const amount = getPaymentAmount();
      if (paymentType !== 'none' && amount > 0) {
        const paymentResp = await paymentsApi.create({
          appointment_id: appointmentId,
          amount,
          type: paymentType === 'points' ? 'full' : paymentType.startsWith('prepay') ? 'prepay' : paymentType,
        });
        if (paymentResp.data.payment_url) {
          const w = window as unknown as Record<string, unknown>;
          if (w.WebApp && !(w as { Telegram?: unknown }).Telegram) {
            window.open(paymentResp.data.payment_url, '_blank');
          } else {
            window.location.href = paymentResp.data.payment_url;
          }
          return;
        }
      }

      toast.success('Запись подтверждена!');
      navigate('/book/success');
    } catch {
      toast.error('Ошибка при оформлении записи');
    } finally {
      setLoading(false);
    }
  };

  const dateStr = store.selectedDate
    ? format(parseISO(store.selectedDate), 'd MMMM, EEEE', { locale: ru })
    : '';

  const paymentOptions: { type: PaymentType; label: string; Icon: typeof CreditCard; show: boolean }[] = [
    {
      type: 'full',
      label: `Полная оплата ${payableAmount.toLocaleString('ru')} \₽`,
      Icon: CreditCard,
      show: payableAmount > 0,
    },
    {
      type: 'prepay_30',
      label: `Предоплата 30% \— ${Math.round(payableAmount * 0.3).toLocaleString('ru')} \₽`,
      Icon: Banknote,
      show: payableAmount > 0,
    },
    {
      type: 'prepay_50',
      label: `Предоплата 50% \— ${Math.round(payableAmount * 0.5).toLocaleString('ru')} \₽`,
      Icon: Banknote,
      show: payableAmount > 0,
    },
    {
      type: 'points',
      label: `Оплатить баллами ${store.loyaltyPoints} \₽`,
      Icon: Coins,
      show: store.loyaltyPoints > 0,
    },
    {
      type: 'subscription' as PaymentType,
      label: activeSub
        ? `Из абонемента (${activeSub.used_visits}/${activeSub.total_visits} визитов)`
        : 'Из абонемента',
      Icon: Ticket,
      show: !!activeSub,
    },
    {
      type: 'none',
      label: 'Оплата на месте',
      Icon: Wallet,
      show: !requirePrepay,
    },
  ];

  return (
    <div className="px-screen-x pt-section-y pb-24 animate-slide-up">
      <BackButton to="/book/promo" />
      <h1 className="text-2xl font-bold tracking-tight mb-1">Подтверждение</h1>
      <p className="text-tg-hint text-sm mb-5">Шаг 5 из 5</p>

      {requirePrepay && (
        <Card className="mb-4 border-status-warning/30 bg-status-warning/5">
          <div className="flex items-start gap-3 text-sm">
            <ShieldAlert className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-tg-text">Требуется предоплата</p>
              <p className="text-tg-hint mt-0.5">
                Для подтверждения записи необходимо выбрать один из способов оплаты
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-tg-hint flex-shrink-0" />
            <span className="text-tg-hint">Мастер</span>
            <span className="ml-auto font-medium">{store.masterName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Scissors className="w-4 h-4 text-tg-hint flex-shrink-0" />
            <span className="text-tg-hint">Услуга</span>
            <span className="ml-auto font-medium">{store.serviceName}</span>
          </div>
          <div className="flex items-center gap-3">
            <CalendarDays className="w-4 h-4 text-tg-hint flex-shrink-0" />
            <span className="text-tg-hint">Дата</span>
            <span className="ml-auto font-medium capitalize">{dateStr}</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-tg-hint flex-shrink-0" />
            <span className="text-tg-hint">Время</span>
            <span className="ml-auto font-medium">{store.selectedTime} &middot; {store.serviceDuration} мин</span>
          </div>

          {store.promoCode && (
            <div className="flex items-center gap-3 text-status-success">
              <span className="w-4 h-4" />
              <span>Промокод {store.promoCode}</span>
              <span className="ml-auto">-{store.discount}{store.discount < 100 ? '%' : ' \₽'}</span>
            </div>
          )}

          {paymentType === 'points' && store.loyaltyPoints > 0 && (
            <div className="flex items-center gap-3 text-status-info">
              <Coins className="w-4 h-4 flex-shrink-0" />
              <span>Баллы лояльности</span>
              <span className="ml-auto">-{Math.min(store.loyaltyPoints, finalPrice)} \₽</span>
            </div>
          )}

          <div className="border-t border-tg-secondary pt-3 flex justify-between">
            <span className="font-bold">Итого</span>
            <span className="font-bold text-brand-600">
              {finalPrice.toLocaleString('ru')} \₽
            </span>
          </div>

          {paymentType !== 'none' && paymentType !== 'points' && getPaymentAmount() < finalPrice && (
            <div className="flex justify-between text-sm text-tg-hint">
              <span>К оплате сейчас</span>
              <span>{getPaymentAmount().toLocaleString('ru')} \₽</span>
            </div>
          )}
        </div>
      </Card>

      {finalPrice > 0 && (
        <div className="mb-4">
          <h3 className="font-medium text-sm mb-2">Способ оплаты</h3>
          <div className="flex flex-col gap-2">
            {paymentOptions
              .filter(opt => opt.show)
              .map(({ type, label, Icon }) => (
                <button
                  key={type}
                  onClick={() => setPaymentType(type)}
                  className={`flex items-center gap-3 p-card-inner rounded-card text-sm text-left transition-all duration-200 ${
                    paymentType === type
                      ? 'bg-brand-500/10 border-2 border-brand-500 text-brand-700'
                      : 'bg-surface-elevated border-2 border-transparent text-tg-text'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-tg-hint text-center mb-3">
        Оплачивая, вы соглашаетесь с{' '}
        <Link to="/legal/terms" className="text-tg-link underline">
          условиями сервиса
        </Link>{' '}
        и{' '}
        <Link to="/legal/payment" className="text-tg-link underline">
          условиями оплаты и возврата
        </Link>
      </p>

      <Button
        onClick={handleConfirm}
        loading={loading}
        fullWidth
        size="lg"
      >
        Подтвердить запись
      </Button>
    </div>
  );
}
