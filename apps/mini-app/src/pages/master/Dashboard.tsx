import { useQuery } from '@tanstack/react-query';
import { bookingApi, mastersApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import Card from '@/shared/ui/Card';
import { CalendarDays, Star, Clock, User, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';

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

  const statCards: { label: string; value: string | number; Icon: LucideIcon; iconBg: string; iconColor: string }[] = [
    {
      label: 'Сегодня',
      value: confirmed.length,
      Icon: CalendarDays,
      iconBg: 'bg-brand-50',
      iconColor: 'text-brand-500',
    },
    {
      label: 'Рейтинг',
      value: masterData?.rating_avg?.toFixed(1) || '\u2014',
      Icon: Star,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
    },
    {
      label: 'Выручка',
      value: `${(stats?.today_revenue ?? 0).toLocaleString('ru')} \u20bd`,
      Icon: TrendingUp,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-accent-emerald',
    },
  ];

  return (
    <div className="p-5 pb-24 animate-fade-in">
      {/* Greeting */}
      <div className="mb-6">
        <p className="text-tg-hint text-sm capitalize">
          {format(new Date(), 'EEEE, d MMMM', { locale: ru })}
        </p>
        <h1 className="text-2xl font-bold mt-1 tracking-tight">
          Привет, {masterData?.name?.split(' ')[0] || 'Мастер'}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {statCards.map((item) => (
          <Card key={item.label} className="text-center !p-3">
            <div className={clsx('w-9 h-9 rounded-xl mx-auto mb-2 flex items-center justify-center', item.iconBg)}>
              <item.Icon className={clsx('w-[18px] h-[18px]', item.iconColor)} strokeWidth={2} />
            </div>
            <div className="text-lg font-bold tracking-tight">{item.value}</div>
            <div className="text-2xs text-tg-hint font-medium mt-0.5">{item.label}</div>
          </Card>
        ))}
      </div>

      {/* Today's schedule */}
      <div className="section-title">Расписание на сегодня</div>

      {confirmed.length === 0 ? (
        <Card className="text-center !py-10">
          <div className="w-12 h-12 rounded-2xl bg-tg-secondary mx-auto mb-3 flex items-center justify-center">
            <CalendarDays className="w-6 h-6 text-tg-hint" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-tg-hint">Записей на сегодня нет</p>
          <p className="text-xs text-tg-hint/60 mt-1">Свободный день!</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {confirmed.map((appt: Record<string, unknown>) => (
            <Card key={appt.id as number} className="flex items-center gap-3.5">
              <div className="flex flex-col items-center min-w-[48px]">
                <div className="text-[15px] font-bold text-brand-500">
                  {appt.time as string}
                </div>
                <div className="text-2xs text-tg-hint flex items-center gap-0.5 mt-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {appt.duration_min as number}м
                </div>
              </div>

              <div className="w-[3px] h-9 rounded-full bg-brand-100" />

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">
                  {appt.service_name as string}
                </div>
                <div className="text-xs text-tg-hint flex items-center gap-1.5 mt-0.5">
                  <User className="w-3 h-3" />
                  {appt.client_name as string}
                </div>
              </div>

              {appt.price ? (
                <div className="text-sm font-bold text-tg-text whitespace-nowrap">
                  {Number(appt.price).toLocaleString('ru')} ₽
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
