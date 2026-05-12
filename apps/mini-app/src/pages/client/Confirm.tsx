import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi, paymentsApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { User, Scissors, CalendarDays, Clock, CreditCard, Wallet, Banknote } from 'lucide-react';

export default function Confirm() {
  const navigate = useNavigate();
  const store = useBookingStore();
  const [loading, setLoading] = useState(false);
  const [paymentType, setPaymentType] = useState<'full' | 'prepay' | 'none'>('none');

  const finalPrice = Math.max(
    0,
    store.servicePrice -
      (store.discount < 100
        ? store.servicePrice * store.discount / 100
        : store.discount) -
      (store.usePoints ? store.loyaltyPoints : 0)
  );

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const bookingData = {
        master_id: store.masterId,
        service_id: store.serviceId,
        date: store.selectedDate,
        time: store.selectedTime,
        promo_code: store.promoCode || undefined,
        use_loyalty_points: store.usePoints,
      };

      const bookingResp = await bookingApi.create(bookingData);
      const appointmentId = bookingResp.data.id;

      if (paymentType !== 'none' && finalPrice > 0) {
        const paymentResp = await paymentsApi.create({
          appointment_id: appointmentId,
          amount: paymentType === 'prepay' ? finalPrice * 0.2 : finalPrice,
          type: paymentType,
        });
        if (paymentResp.data.payment_url) {
          window.location.href = paymentResp.data.payment_url;
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

  return (
    <div className="p-4 pb-20 animate-slide-up">
      <BackButton to="/book/promo" />
      <h1 className="text-xl font-bold mb-1">Подтверждение</h1>
      <p className="text-tg-hint text-sm mb-4">Шаг 5 из 5</p>

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
            <div className="flex items-center gap-3 text-green-600">
              <span className="w-4 h-4" />
              <span>Промокод {store.promoCode}</span>
              <span className="ml-auto">-{store.discount}{store.discount < 100 ? '%' : ' \u20bd'}</span>
            </div>
          )}

          <div className="border-t border-gray-200 pt-3 flex justify-between">
            <span className="font-bold">Итого</span>
            <span className="font-bold text-brand-600">
              {finalPrice.toLocaleString('ru')} \u20bd
            </span>
          </div>
        </div>
      </Card>

      {finalPrice > 0 && (
        <div className="mb-4">
          <h3 className="font-medium text-sm mb-2">Способ оплаты</h3>
          <div className="flex flex-col gap-2">
            {([
              { type: 'full' as const, label: `Полная оплата ${finalPrice.toLocaleString('ru')} \u20bd`, Icon: CreditCard },
              { type: 'prepay' as const, label: `Предоплата 20% \u2014 ${Math.round(finalPrice * 0.2).toLocaleString('ru')} \u20bd`, Icon: Banknote },
              { type: 'none' as const, label: 'Оплата на месте', Icon: Wallet },
            ]).map(({ type, label, Icon }) => (
              <button
                key={type}
                onClick={() => setPaymentType(type)}
                className={`flex items-center gap-3 p-3.5 rounded-xl text-sm text-left transition-all ${
                  paymentType === type
                    ? 'bg-brand-50 border-2 border-brand-500 text-brand-700'
                    : 'bg-tg-secondary border-2 border-transparent text-tg-text'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

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
