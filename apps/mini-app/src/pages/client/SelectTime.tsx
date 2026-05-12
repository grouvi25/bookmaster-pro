import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import Loading from '@/components/common/Loading';
import clsx from 'clsx';
import { Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function SelectTime() {
  const navigate = useNavigate();
  const { masterId, selectedDate, selectedTime, setTime, serviceDuration } = useBookingStore();

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

  const morningSlots = slots.filter((t) => parseInt(t) < 12);
  const daySlots = slots.filter((t) => parseInt(t) >= 12 && parseInt(t) < 17);
  const eveningSlots = slots.filter((t) => parseInt(t) >= 17);

  const renderGroup = (title: string, groupSlots: string[]) => {
    if (groupSlots.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="text-xs text-tg-hint mb-2 font-medium">{title}</p>
        <div className="grid grid-cols-4 gap-2">
          {groupSlots.map((time) => (
            <button
              key={time}
              onClick={() => handleSelect(time)}
              className={clsx(
                'py-2.5 rounded-xl font-medium text-sm transition-all active:scale-95',
                selectedTime === time
                  ? 'bg-tg-button text-tg-button-text shadow-sm'
                  : 'bg-tg-secondary text-tg-text'
              )}
            >
              {time}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 pb-20 animate-slide-up">
      <BackButton to="/book/date" />
      <h1 className="text-xl font-bold mb-1">Выберите время</h1>
      <div className="flex items-center gap-2 text-tg-hint text-sm mb-4">
        <span>Шаг 3 из 5</span>
        {selectedDate && (
          <>
            <span>&middot;</span>
            <span className="capitalize">
              {format(parseISO(selectedDate), 'd MMMM, EEEE', { locale: ru })}
            </span>
          </>
        )}
      </div>

      {slots.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-10 h-10 text-tg-hint mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-tg-hint text-sm">Нет доступных слотов на эту дату</p>
        </div>
      ) : (
        <>
          {renderGroup('Утро', morningSlots)}
          {renderGroup('День', daySlots)}
          {renderGroup('Вечер', eveningSlots)}
        </>
      )}

      {serviceDuration && (
        <p className="text-xs text-tg-hint text-center mt-4 flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" />
          Длительность: {serviceDuration} мин
        </p>
      )}
    </div>
  );
}
