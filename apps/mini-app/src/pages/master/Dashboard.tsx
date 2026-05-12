import { useQuery } from '@tanstack/react-query';
import { bookingApi, mastersApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import Card from '@/shared/ui/Card';
import { CalendarDays, Banknote, Star, Clock, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function Dashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: masterData } = useQuery({
    queryKey: ['master-profile'],
    queryFn: () => mastersApi.getProfile().then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['master-bookings-today', today],
    queryFn: () => bookingApi.masterBookings({ date: today }).then((r) => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['master-stats'],
    queryFn: () => mastersApi.getStats().then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  const bookings = data?.items || [];
  const confirmed = bookings.filter(
    (b: Record<string, unknown>) => ['confirmed', 'paid'].includes(b.status as string)
  );

  const statCards: { label: string; value: string | number; Icon: LucideIcon; color: string }[] = [
    {
      label: 'Сегодня',
      value: confirmed.length,
      Icon: CalendarDays,
      color: 'text-blue-500',
    },
    {
      label: 'Рейтинг',
      value: masterData?.rating_avg?.toFixed(1) || '\u2014',
      Icon: Star,
      color: 'text-yellow-500',
    },
    {
      label: 'Выручка',
      value: `${(stats?.today_revenue ?? 0).toLocaleString('ru')} \u20bd`,
      Icon: Banknote,
      color: 'text-green-500',
    },
  ];

  return (
    <div className="p-5 pb-20 animate-fade-in">
      {/* Greeting */}
      <div className="mb-5">
        <h1 className="text-xl font-bold">
          Привет, {masterData?.name?.split(' ')[0] || 'Мастер'}
        </h1>
        <p className="text-tg-hint text-sm capitalize mt-0.5">
          {format(new Date(), 'EEEE, d MMMM', { locale: ru })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {statCards.map((item) => (
          <Card key={item.label} className="text-center">
            <item.Icon className={`w-5 h-5 mx-auto mb-1 ${item.color}`} strokeWidth={1.8} />
            <div className="text-xl font-bold">{item.value}</div>
            <div className="text-xs text-tg-hint">{item.label}</div>
          </Card>
        ))}
      </div>

      {/* Today's schedule */}
      <h2 className="text-base font-semibold mb-3">Сегодня</h2>

      {confirmed.length === 0 ? (
        <Card className="text-center py-6">
          <CalendarDays className="w-8 h-8 text-tg-hint mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm text-tg-hint">Записей на сегодня нет</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {confirmed.map((appt: Record<string, unknown>) => (
            <Card key={appt.id as number} className="flex items-center gap-3">
              <div className="text-center min-w-[50px]">
                <div className="text-base font-bold text-brand-600">
                  {appt.time as string}
                </div>
                <div className="text-[10px] text-tg-hint flex items-center justify-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {appt.duration_min as number} мин
                </div>
              </div>

              <div className="w-px h-8 bg-gray-200" />

              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {appt.service_name as string}
                </div>
                <div className="text-xs text-tg-hint flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {appt.client_name as string}
                </div>
              </div>

              {appt.price ? (
                <div className="text-sm font-semibold text-brand-600 whitespace-nowrap">
                  {Number(appt.price).toLocaleString('ru')} \u20bd
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
