import { useNavigate } from 'react-router-dom';
import { useBookingStore } from '@/stores/booking';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CircleCheck } from 'lucide-react';

export default function BookingSuccess() {
  const navigate = useNavigate();
  const store = useBookingStore();

  const dateStr = store.selectedDate
    ? format(parseISO(store.selectedDate), 'd MMMM, EEEE', { locale: ru })
    : '';

  const handleDone = () => {
    store.reset();
    navigate('/');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 animate-bounce-in">
      <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-5 shadow-card-lg">
        <CircleCheck className="w-10 h-10 text-accent-emerald" strokeWidth={1.8} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2 text-tg-text">Вы записаны!</h1>
      <p className="text-tg-hint text-center mb-6">
        Напоминание придёт автоматически
      </p>

      <div className="w-full bg-surface-elevated shadow-card-lg rounded-2xl p-4 mb-6">
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
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={() => navigate('/bookings')}
          className="w-full bg-brand-500 text-white py-3.5 rounded-2xl font-bold shadow-button active:scale-[0.97] transition-all"
        >
          Мои записи
        </button>
        <button
          onClick={handleDone}
          className="w-full text-tg-link py-2 text-sm"
        >
          На главную
        </button>
      </div>
    </div>
  );
}
