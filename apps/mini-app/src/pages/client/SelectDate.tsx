import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import Loading from '@/components/common/Loading';
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, isSameDay, isBefore, startOfDay,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export default function SelectDate() {
  const navigate = useNavigate();
  const { masterId, serviceId, selectedDate, setDate } = useBookingStore();
  const [viewMonth, setViewMonth] = useState(new Date());

  const { data: availableDates, isLoading } = useQuery({
    queryKey: ['available-dates', masterId, serviceId],
    queryFn: () =>
      bookingApi.getAvailableDates(masterId!, serviceId!).then((r) => r.data),
    enabled: !!masterId && !!serviceId,
  });

  const availableSet = useMemo(
    () =>
      new Set(
        (availableDates?.dates || []).map((d: string) =>
          format(parseISO(d), 'yyyy-MM-dd')
        )
      ),
    [availableDates]
  );

  const calendarDays = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const days = eachDayOfInterval({ start, end });
    const startPad = (getDay(start) + 6) % 7;
    return { days, startPad };
  }, [viewMonth]);

  if (isLoading) return <Loading />;

  const handleSelectDate = (date: Date) => {
    const formatted = format(date, 'yyyy-MM-dd');
    if (!availableSet.has(formatted)) return;
    setDate(formatted);
    navigate('/book/time');
  };

  const today = startOfDay(new Date());

  return (
    <div className="px-screen-x pt-section-y pb-24 animate-slide-up">
      <BackButton to="/book/service" />
      <h1 className="text-2xl font-bold tracking-tight mb-1">Выберите дату</h1>
      <p className="text-tg-hint text-sm mb-5">Шаг 2 из 5</p>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          className="w-8 h-8 rounded-xl bg-tg-secondary flex items-center justify-center active:scale-90 transition-transform"
        >
          <ChevronLeft className="w-4 h-4 text-tg-hint" />
        </button>
        <h2 className="text-base font-semibold capitalize">
          {format(viewMonth, 'LLLL yyyy', { locale: ru })}
        </h2>
        <button
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="w-8 h-8 rounded-xl bg-tg-secondary flex items-center justify-center active:scale-90 transition-transform"
        >
          <ChevronRight className="w-4 h-4 text-tg-hint" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs text-tg-hint font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: calendarDays.startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {calendarDays.days.map((date) => {
          const key = format(date, 'yyyy-MM-dd');
          const available = availableSet.has(key);
          const selected = selectedDate === key;
          const past = isBefore(date, today) && !isSameDay(date, today);

          return (
            <button
              key={key}
              onClick={() => handleSelectDate(date)}
              disabled={!available || past}
              className={clsx(
                'aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all',
                selected
                  ? 'bg-brand-500 text-white shadow-button'
                  : available && !past
                    ? 'text-tg-text active:scale-90 hover:bg-tg-secondary'
                    : 'text-gray-300'
              )}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>

      {!availableDates?.dates?.length && (
        <div className="text-center py-8 mt-4">
          <CalendarDays className="w-10 h-10 text-tg-hint mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-tg-hint text-sm">Нет доступных дат</p>
          <button
            onClick={() => navigate('/book/waitlist')}
            className="mt-3 text-tg-link text-sm"
          >
            Встать в лист ожидания
          </button>
        </div>
      )}
    </div>
  );
}
