import { useQuery } from '@tanstack/react-query';
import { bookingApi, mastersApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { PageSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import StatCard from '@/shared/ui/StatCard';
import EmptyState from '@/shared/ui/EmptyState';
import { CalendarDays, Star, Clock, User, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Booking, MasterProfile } from '@/shared/types/api';

export default function Dashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: masterData } = useQuery<MasterProfile>({
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

  if (isLoading) return <PageSkeleton />;

  const bookings = toArray<Booking>(data);
  const confirmed = bookings.filter(
    (b) => ['confirmed', 'paid'].includes(b.status)
  );

  return (
    <div className="p-5 pb-24 animate-fade-in">
      <div className="mb-6">
        <p className="text-tg-hint text-sm capitalize">
          {format(new Date(), 'EEEE, d MMMM', { locale: ru })}
        </p>
        <h1 className="text-2xl font-bold mt-1 tracking-tight">
          Привет, {masterData?.display_name?.split(' ')[0] || 'Мастер'}
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard
          label="Сегодня"
          value={confirmed.length}
          Icon={CalendarDays}
          iconBg="bg-brand-500/10"
          iconColor="text-brand-500"
        />
        <StatCard
          label="Рейтинг"
          value={masterData?.rating_avg?.toFixed(1) || '—'}
          Icon={Star}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
        />
        <StatCard
          label="Выручка"
          value={`${(stats?.today_revenue ?? 0).toLocaleString('ru')} ₽`}
          Icon={TrendingUp}
          iconBg="bg-accent-emerald/10"
          iconColor="text-accent-emerald"
        />
      </div>

      <div className="section-title">Расписание на сегодня</div>

      {confirmed.length === 0 ? (
        <Card className="!py-10">
          <EmptyState
            Icon={CalendarDays}
            title="Записей на сегодня нет"
            description="Свободный день!"
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {confirmed.map((appt) => (
            <Card key={appt.id} className="flex items-center gap-3.5">
              <div className="flex flex-col items-center min-w-[48px]">
                <div className="text-[15px] font-bold text-brand-500">
                  {appt.time}
                </div>
                <div className="text-2xs text-tg-hint flex items-center gap-0.5 mt-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {appt.duration_min}м
                </div>
              </div>

              <div className="w-[3px] h-9 rounded-full bg-brand-100" />

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">
                  {appt.service_name}
                </div>
                <div className="text-xs text-tg-hint flex items-center gap-1.5 mt-0.5">
                  <User className="w-3 h-3" />
                  {appt.client_name}
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
