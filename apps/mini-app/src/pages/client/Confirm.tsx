import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi, paymentsApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

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

      navigate('/book/success');
    } catch (e) {
      console.error('Booking error:', e);
    } finally {
      setLoading(false);
    }
  };

  const dateStr = store.selectedDate
    ? format(parseISO(store.selectedDate), 'd MMMM, EEEE', { locale: ru })
    : '';

  return (
    <div className="p-4 animate-slide-up">
      <BackButton to="/book/promo" />
      <h1 className="text-xl font-bold mb-1">Подтверждение</h1>
      <p className="text-tg-hint text-sm mb-4">Шаг 5 из 5</p>

      {/* Итог */}
      <div className="bg-tg-secondary rounded-2xl p-4 mb-4">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-tg-hint">Мастер</span>
            <span className="font-medium">{store.masterName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tg-hint">Услуга</span>
            <span className="font-medium">{store.serviceName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tg-hint">Дата</span>
            <span className="font-medium">{dateStr}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tg-hint">Время</span>
            <span className="font-medium">{store.selectedTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tg-hint">Длительность</span>
            <span className="font-medium">{store.serviceDuration} мин</span>
          </div>
          {store.promoCode && (
            <div className="flex justify-between text-green-600">
              <span>Промокод {store.promoCode}</span>
              <span>-{store.discount}{store.discount < 100 ? '%' : ' \u20bd'}</span>
            </div>
          )}
          <div className="border-t border-gray-200 pt-2 flex justify-between">
            <span className="font-bold">Итого</span>
            <span className="font-bold text-brand-600">
              {finalPrice.toLocaleString('ru')} \u20bd
            </span>
          </div>
        </div>
      </div>

      {/* Способ оплаты */}
      {finalPrice > 0 && (
        <div className="mb-4">
          <h3 className="font-medium text-sm mb-2">Оплата</h3>
          <div className="flex flex-col gap-2">
            {[
              { type: 'full' as const, label: `Полная оплата ${finalPrice.toLocaleString('ru')} \u20bd` },
              { type: 'prepay' as const, label: `Предоплата 20% — ${Math.round(finalPrice * 0.2).toLocaleString('ru')} \u20bd` },
              { type: 'none' as const, label: 'Без предоплаты' },
            ].map(({ type, label }) => (
              <button
                key={type}
                onClick={() => setPaymentType(type)}
                className={`p-3 rounded-xl text-sm text-left transition-all ${
                  paymentType === type
                    ? 'bg-brand-50 border-2 border-brand-500 text-brand-700'
                    : 'bg-tg-secondary border-2 border-transparent text-tg-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={loading}
        className="w-full bg-tg-button text-tg-button-text py-3.5 rounded-xl font-bold text-base disabled:opacity-50"
      >
        {loading ? 'Оформление...' : 'Подтвердить запись'}
      </button>
    </div>
  );
}
