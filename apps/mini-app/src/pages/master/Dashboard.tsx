import { useQuery } from '@tanstack/react-query';
import { bookingApi, mastersApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { PageSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import StatCard from '@/shared/ui/StatCard';
import EmptyState from '@/shared/ui/EmptyState';
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
    <div className="px-screen-x py-section-y pb-24 screen-enter">
      <div className="mb-section-y">
        <p className="text-tg-hint text-aux capitalize">
          {format(new Date(), 'EEEE, d MMMM', { locale: ru })}
        </p>
        <h1 className="text-h1 mt-1">
          Привет, {masterData?.display_name?.split(' ')[0] || 'Мастер'}
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-card-gap mb-section-y">
        <StatCard
          label="Сегодня"
          value={confirmed.length}
          emoji={'📅'}
        />
        <StatCard
          label="Рейтинг"
          value={masterData?.rating_avg?.toFixed(1) || '—'}
          emoji={'⭐'}
        />
        <StatCard
          label="Выручка"
          value={`${(stats?.today_revenue ?? 0).toLocaleString('ru')} ₽`}
          emoji={'💰'}
        />
      </div>

      <div className="section-title">Расписание на сегодня</div>

      {confirmed.length === 0 ? (
        <Card>
          <EmptyState
            emoji={'📅'}
            title="Записей на сегодня нет"
            description="Свободный день!"
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-card-gap">
          {confirmed.map((appt) => (
            <Card key={appt.id} className="flex items-center gap-3.5">
              <div className="flex flex-col items-center min-w-[48px]">
                <div className="text-body font-bold text-tg-link">
                  {appt.time}
                </div>
                <div className="text-micro text-tg-hint flex items-center gap-0.5 mt-0.5">
                  {'⏰'} {appt.duration_min}м
                </div>
              </div>

              <div className="w-[3px] h-9 rounded-full bg-tg-link/20" />

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-body truncate">
                  {appt.service_name}
                </div>
                <div className="text-aux text-tg-hint flex items-center gap-1.5 mt-0.5">
                  {'👤'} {appt.client_name}
                </div>
              </div>

              {appt.price ? (
                <div className="text-body font-bold text-tg-text whitespace-nowrap">
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
