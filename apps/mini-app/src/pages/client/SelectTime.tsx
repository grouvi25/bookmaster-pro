import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import Loading from '@/components/common/Loading';
import clsx from 'clsx';

export default function SelectTime() {
  const navigate = useNavigate();
  const { masterId, selectedDate, selectedTime, setTime } = useBookingStore();

  const { data: slotsData, isLoading } = useQuery({
    queryKey: ['slots', masterId, selectedDate],
    queryFn: () =>
      bookingApi.getSlots(masterId!, selectedDate).then((r) => r.data),
    enabled: !!masterId && !!selectedDate,
  });

  if (isLoading) return <Loading />;

  const slots: string[] = slotsData?.slots || [];

  const handleSelect = (time: string) => {
    setTime(time);
    navigate('/book/promo');
  };

  return (
    <div className="p-4 animate-slide-up">
      <BackButton to="/book/date" />
      <h1 className="text-xl font-bold mb-1">Выберите время</h1>
      <p className="text-tg-hint text-sm mb-4">Шаг 3 из 5</p>

      {slots.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-tg-hint">Нет доступных слотов на эту дату</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {slots.map((time) => (
            <button
              key={time}
              onClick={() => handleSelect(time)}
              className={clsx(
                'py-3 rounded-xl font-medium text-sm transition-all active:scale-95',
                selectedTime === time
                  ? 'bg-tg-button text-tg-button-text'
                  : 'bg-tg-secondary text-tg-text'
              )}
            >
              {time}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
