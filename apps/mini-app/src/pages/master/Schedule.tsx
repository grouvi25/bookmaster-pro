import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bookingApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import { format, addDays, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';

export default function Schedule() {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data, isLoading } = useQuery({
    queryKey: ['master-schedule', selectedDate],
    queryFn: () =>
      bookingApi.masterBookings({ date: selectedDate }).then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  const bookings = data?.items || [];
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="p-4 pb-20 animate-fade-in">
      {/* Переключатель */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Расписание</h1>
        <div className="flex bg-tg-secondary rounded-lg p-0.5">
          {(['week', 'month'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewMode === mode
                  ? 'bg-tg-button text-tg-button-text'
                  : 'text-tg-hint'
              )}
            >
              {mode === 'week' ? 'Неделя' : 'Месяц'}
            </button>
          ))}
        </div>
      </div>

      {/* Навигация по неделям */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="text-tg-link text-sm px-2"
        >
          &larr;
        </button>
        <span className="font-medium text-sm">
          {format(weekStart, 'd MMM', { locale: ru })} &mdash;{' '}
          {format(addDays(weekStart, 6), 'd MMM', { locale: ru })}
        </span>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="text-tg-link text-sm px-2"
        >
          &rarr;
        </button>
      </div>

      {/* Дни недели */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {weekDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const isSelected = key === selectedDate;
          const isToday = key === format(new Date(), 'yyyy-MM-dd');
          return (
            <button
              key={key}
              onClick={() => setSelectedDate(key)}
              className={clsx(
                'flex flex-col items-center min-w-[48px] py-2 px-1 rounded-xl transition-all',
                isSelected
                  ? 'bg-tg-button text-tg-button-text'
                  : isToday
                    ? 'bg-brand-50 text-brand-600'
                    : 'bg-tg-secondary text-tg-text'
              )}
            >
              <span className="text-xs">
                {format(day, 'EEE', { locale: ru })}
              </span>
              <span className="text-lg font-bold">{format(day, 'd')}</span>
            </button>
          );
        })}
      </div>

      {/* Записи на выбранный день */}
      <h2 className="font-medium text-sm text-tg-hint mb-2">
        {format(new Date(selectedDate + 'T00:00:00'), 'd MMMM, EEEE', { locale: ru })}
      </h2>

      {bookings.length === 0 ? (
        <div className="bg-tg-secondary rounded-xl p-6 text-center">
          <p className="text-tg-hint text-sm">Нет записей</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map((b: Record<string, unknown>) => (
            <div
              key={b.id as number}
              className="bg-tg-secondary rounded-xl p-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-sm">
                    {b.time as string} &mdash; {b.client_name as string}
                  </div>
                  <div className="text-xs text-tg-hint mt-0.5">
                    {b.service_name as string} &middot; {b.duration_min as number} мин
                  </div>
                </div>
                <span className="text-xs text-tg-hint">
                  {b.price ? `${Number(b.price).toLocaleString('ru')} \u20bd` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
