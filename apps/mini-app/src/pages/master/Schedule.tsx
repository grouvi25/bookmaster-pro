import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bookingApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import { format, addDays, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
    <div className="p-5 pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Расписание</h1>
        <div className="flex bg-tg-secondary rounded-2xl p-1">
          {(['week', 'month'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={clsx(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                viewMode === mode
                  ? 'bg-surface-elevated text-tg-text shadow-card'
                  : 'text-tg-hint'
              )}
            >
              {mode === 'week' ? 'Неделя' : 'Месяц'}
            </button>
          ))}
        </div>
      </div>

      {/* Week nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="w-8 h-8 rounded-xl bg-tg-secondary flex items-center justify-center active:scale-90 transition-transform"
        >
          <ChevronLeft className="w-4 h-4 text-tg-hint" />
        </button>
        <span className="font-semibold text-sm">
          {format(weekStart, 'd MMM', { locale: ru })} &mdash;{' '}
          {format(addDays(weekStart, 6), 'd MMM', { locale: ru })}
        </span>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="w-8 h-8 rounded-xl bg-tg-secondary flex items-center justify-center active:scale-90 transition-transform"
        >
          <ChevronRight className="w-4 h-4 text-tg-hint" />
        </button>
      </div>

      {/* Week days */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto">
        {weekDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const isSelected = key === selectedDate;
          const isToday = key === format(new Date(), 'yyyy-MM-dd');
          return (
            <button
              key={key}
              onClick={() => setSelectedDate(key)}
              className={clsx(
                'flex flex-col items-center min-w-[46px] py-2 px-1.5 rounded-2xl transition-all duration-200',
                isSelected
                  ? 'bg-brand-500 text-white shadow-button'
                  : isToday
                    ? 'bg-brand-50 text-brand-600'
                    : 'bg-surface-elevated shadow-card text-tg-text'
              )}
            >
              <span className="text-2xs font-medium uppercase">
                {format(day, 'EEE', { locale: ru })}
              </span>
              <span className="text-lg font-bold mt-0.5">{format(day, 'd')}</span>
            </button>
          );
        })}
      </div>

      {/* Day header */}
      <div className="section-title">
        {format(new Date(selectedDate + 'T00:00:00'), 'd MMMM, EEEE', { locale: ru })}
      </div>

      {bookings.length === 0 ? (
        <div className="bg-surface-elevated shadow-card rounded-2xl p-8 text-center">
          <p className="text-sm text-tg-hint">Нет записей</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {bookings.map((b: Record<string, unknown>) => (
            <div
              key={b.id as number}
              className="bg-surface-elevated shadow-card rounded-2xl p-3.5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className="w-1 h-10 rounded-full bg-brand-400 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">
                      {b.time as string} — {b.client_name as string}
                    </div>
                    <div className="text-xs text-tg-hint mt-1">
                      {b.service_name as string} · {b.duration_min as number} мин
                    </div>
                  </div>
                </div>
                <span className="text-sm font-bold text-tg-text">
                  {b.price ? `${Number(b.price).toLocaleString('ru')} ₽` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
