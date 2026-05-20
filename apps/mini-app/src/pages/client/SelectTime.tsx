import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import EmptyState from '@/shared/ui/EmptyState';
import clsx from 'clsx';
import { Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

export default function SelectTime() {
  const navigate = useNavigate();
  const { masterId, serviceId, selectedDate, selectedTime, setTime, serviceDuration } = useBookingStore();

  const { data: slotsData, isLoading } = useQuery({
    queryKey: ['slots', masterId, selectedDate, serviceId],
    queryFn: () =>
      bookingApi.getSlots(masterId!, selectedDate!, serviceId!).then((r) => r.data),
    enabled: !!masterId && !!selectedDate && !!serviceId,
  });

  useEffect(() => {
    if (!masterId || !serviceId || !selectedDate) {
      navigate('/', { replace: true });
    }
  }, [masterId, serviceId, selectedDate, navigate]);

  if (!masterId || !serviceId || !selectedDate) return null;
  if (isLoading) return <div className="px-screen-x py-section-y"><ListSkeleton count={4} /></div>;

  const rawSlots: TimeSlot[] = slotsData?.slots || [];
  const slots = rawSlots.filter((s) => s.available);

  const handleSelect = (slot: TimeSlot) => {
    setTime(slot.start);
    navigate('/book/promo');
  };

  const morningSlots = slots.filter((s) => parseInt(s.start) < 12);
  const daySlots = slots.filter((s) => parseInt(s.start) >= 12 && parseInt(s.start) < 17);
  const eveningSlots = slots.filter((s) => parseInt(s.start) >= 17);

  const renderGroup = (title: string, groupSlots: TimeSlot[]) => {
    if (groupSlots.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="text-xs text-tg-hint mb-2 font-medium">{title}</p>
        <div className="grid grid-cols-4 gap-2">
          {groupSlots.map((slot) => (
            <button
              key={slot.start}
              onClick={() => handleSelect(slot)}
              className={clsx(
                'py-2.5 rounded-xl font-medium text-sm transition-all active:scale-95',
                selectedTime === slot.start
                  ? 'bg-brand-500 text-white shadow-button'
                  : 'bg-surface-elevated text-tg-text'
              )}
            >
              {slot.start}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="px-screen-x pt-section-y pb-24 animate-slide-up">
      <BackButton to="/book/date" />
      <h1 className="text-2xl font-bold tracking-tight mb-1">Выберите время</h1>
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
        <EmptyState
          emoji="⏰"
          title="Нет доступных слотов"
          description="Нет доступных слотов на эту дату"
          action={
            <button
              onClick={() => navigate('/book/waitlist')}
              className="text-tg-link text-sm interactive"
            >
              Встать в лист ожидания
            </button>
          }
        />
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
