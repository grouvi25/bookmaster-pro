import { useQuery } from '@tanstack/react-query';
import { bookingApi, analyticsApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function Dashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: todayBookings, isLoading: loadingBookings } = useQuery({
    queryKey: ['master-bookings-today'],
    queryFn: () =>
      bookingApi.masterBookings({ date: today }).then((r) => r.data),
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => analyticsApi.dashboard().then((r) => r.data),
  });

  if (loadingBookings || loadingStats) return <Loading />;

  const bookings = todayBookings?.items || [];

  return (
    <div className="p-4 pb-20 animate-fade-in">
      <h1 className="text-xl font-bold mb-1">
        {format(new Date(), 'd MMMM, EEEE', { locale: ru })}
      </h1>
      <p className="text-tg-hint text-sm mb-4">Ваш дашборд</p>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Записей сегодня', value: stats?.today_count ?? bookings.length, icon: '\ud83d\udcc5' },
          { label: 'Выручка сегодня', value: `${(stats?.today_revenue ?? 0).toLocaleString('ru')} \u20bd`, icon: '\ud83d\udcb0' },
          { label: 'Записей в неделю', value: stats?.week_count ?? 0, icon: '\ud83d\udcca' },
          { label: 'Средний чек', value: `${(stats?.avg_check ?? 0).toLocaleString('ru')} \u20bd`, icon: '\u2b50' },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-tg-secondary rounded-xl p-3"
          >
            <div className="text-lg mb-1">{item.icon}</div>
            <div className="text-xl font-bold text-tg-text">{item.value}</div>
            <div className="text-xs text-tg-hint">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Записи на сегодня */}
      <h2 className="font-bold text-lg mb-3">Записи на сегодня</h2>
      {bookings.length === 0 ? (
        <div className="bg-tg-secondary rounded-xl p-6 text-center">
          <p className="text-tg-hint">Нет записей на сегодня</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map((b: Record<string, unknown>) => (
            <div
              key={b.id as number}
              className="bg-tg-secondary rounded-xl p-3 flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center text-lg">
                {'\ud83d\udc64'}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {b.client_name as string}
                </div>
                <div className="text-xs text-tg-hint">
                  {b.service_name as string} &middot; {b.time as string}
                </div>
              </div>
              <div className="text-xs text-tg-hint">
                {b.duration_min as number} мин
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
