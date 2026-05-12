import { useQuery } from '@tanstack/react-query';
import { bookingApi } from '@/api/endpoints';
import BackButton from '@/components/common/BackButton';
import Loading from '@/components/common/Loading';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';
import { CalendarDays } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Подтверждена', color: 'text-green-600 bg-green-50' },
  pending: { label: 'Ожидает', color: 'text-yellow-600 bg-yellow-50' },
  completed: { label: 'Завершена', color: 'text-gray-500 bg-gray-100' },
  cancelled: { label: 'Отменена', color: 'text-red-500 bg-red-50' },
  no_show: { label: 'Не пришёл', color: 'text-red-600 bg-red-50' },
};

export default function MyBookings() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => bookingApi.myBookings().then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  const bookings = data?.items || [];

  return (
    <div className="p-4 animate-fade-in">
      <BackButton to="/" />
      <h1 className="text-xl font-bold mb-4">Мои записи</h1>

      {bookings.length === 0 ? (
        <div className="text-center py-12">
          <CalendarDays className="w-10 h-10 text-tg-hint mb-3" strokeWidth={1.5} />
          <p className="text-tg-hint">У вас пока нет записей</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((b: Record<string, unknown>) => {
            const status = STATUS_MAP[b.status as string] || STATUS_MAP.pending;
            return (
              <div
                key={b.id as number}
                className="bg-tg-secondary rounded-xl p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium">{b.service_name as string}</div>
                    <div className="text-xs text-tg-hint mt-0.5">
                      {b.master_name as string}
                    </div>
                  </div>
                  <span
                    className={clsx(
                      'text-xs px-2 py-1 rounded-lg font-medium',
                      status.color
                    )}
                  >
                    {status.label}
                  </span>
                </div>
                <div className="text-sm text-tg-hint">
                  {b.date
                    ? format(parseISO(b.date as string), 'd MMM, EEE', {
                        locale: ru,
                      })
                    : ''}{' '}
                  {b.time as string} &middot; {b.duration_min as number} мин
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
