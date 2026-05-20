/**
 * Экран 3 booking flow: выбор даты.
 *
 * ТЗ 8.2:
 * - Горизонтальный календарь (мы делаем месячную сетку — лучше для обзора)
 * - Серые = нет слотов
 * - Синие (акцентные) = есть слоты
 * - Лист ожидания если всё занято
 *
 * Визуальные состояния ячейки даты:
 * - past (прошлая):         text-tg-hint/40, не кликабельна
 * - unavailable (нет слотов): text-tg-hint, не кликабельна
 * - available (есть слоты):  bg-tg-link/10 text-tg-link font-bold, кликабельна
 * - today (без слотов):      ring-1 ring-tg-hint/30
 * - today (со слотами):      ring-1 ring-tg-link + bg-tg-link/10
 * - selected:                bg-tg-button text-tg-button-text
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import EmptyState from '@/shared/ui/EmptyState';
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, isSameDay, isBefore, startOfDay,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

  if (isLoading) return <div className="px-screen-x py-section-y"><ListSkeleton count={4} /></div>;

  const handleSelectDate = (date: Date) => {
    const formatted = format(date, 'yyyy-MM-dd');
    if (!availableSet.has(formatted)) return;
    setDate(formatted);
    navigate('/book/time');
  };

  const today = startOfDay(new Date());
  const hasAnyDates = (availableDates?.dates?.length || 0) > 0;

  return (
    <div className="px-screen-x pt-section-y pb-24 animate-slide-up">
      <BackButton to="/book/service" />
      <h1 className="text-h1 mb-1">Выберите дату</h1>
      <p className="text-tg-hint text-aux mb-5">Шаг 2 из 5</p>

      {/* Легенда */}
      <div className="flex items-center gap-4 mb-4 text-aux text-tg-hint">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-tg-link/15 border border-tg-link/30" />
          Есть слоты
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-tg-secondary" />
          Нет слотов
        </span>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          className="w-9 h-9 rounded-xl bg-tg-secondary flex items-center justify-center interactive"
        >
          <ChevronLeft className="w-4 h-4 text-tg-hint" />
        </button>
        <h2 className="text-h2 capitalize">
          {format(viewMonth, 'LLLL yyyy', { locale: ru })}
        </h2>
        <button
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="w-9 h-9 rounded-xl bg-tg-secondary flex items-center justify-center interactive"
        >
          <ChevronRight className="w-4 h-4 text-tg-hint" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-micro text-tg-hint py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-1.5">
        {Array.from({ length: calendarDays.startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {calendarDays.days.map((date) => {
          const key = format(date, 'yyyy-MM-dd');
          const available = availableSet.has(key);
          const selected = selectedDate === key;
          const isToday = isSameDay(date, today);
          const past = isBefore(date, today) && !isToday;

          return (
            <button
              key={key}
              onClick={() => handleSelectDate(date)}
              disabled={!available || past}
              className={clsx(
                'aspect-square flex items-center justify-center rounded-xl',
                'text-sm transition-all duration-150',
                // Selected state
                selected && 'bg-tg-button text-tg-button-text font-bold shadow-button scale-105',
                // Available (не selected)
                !selected && available && !past && [
                  'bg-tg-link/10 text-tg-link font-semibold',
                  'active:scale-90 active:bg-tg-link/20',
                  isToday && 'ring-2 ring-tg-link/40',
                ],
                // Unavailable future (нет слотов, но не прошлое)
                !selected && !available && !past && [
                  'text-tg-hint',
                  isToday && 'ring-1 ring-tg-hint/30',
                ],
                // Past
                !selected && past && 'text-tg-hint/40',
              )}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>

      {/* Нет ни одной доступной даты */}
      {!hasAnyDates && (
        <div className="mt-8">
          <EmptyState
            emoji="📅"
            title="Нет доступных дат"
            description="Все слоты заняты в ближайшие 30 дней"
            action={
              <button
                onClick={() => navigate('/book/waitlist')}
                className="text-tg-link text-body font-medium interactive"
              >
                Встать в лист ожидания
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
