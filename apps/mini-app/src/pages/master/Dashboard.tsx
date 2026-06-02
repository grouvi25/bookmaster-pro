import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bookingApi, mastersApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { PageSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import StatCard from '@/shared/ui/StatCard';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import { toast } from '@/shared/ui/Toast';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Booking, MasterProfile } from '@/shared/types/api';
import { Plus } from 'lucide-react';
import NewBookingModal from '@/components/master/NewBookingModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [newBookingOpen, setNewBookingOpen] = useState(false);

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
  const active = bookings.filter(
    (b) => ['confirmed', 'paid', 'pending'].includes(b.status)
  );

  const handleQuickAction = async (id: number, action: 'confirm' | 'complete') => {
    setLoadingId(id);
    try {
      if (action === 'confirm') {
        await bookingApi.confirm(id);
        toast.success('Запись подтверждена');
      } else {
        await bookingApi.complete(id);
        toast.success('Визит завершён');
      }
      await queryClient.invalidateQueries({ queryKey: ['master-bookings-today', today] });
    } catch {
      toast.error('Ошибка обновления');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="px-screen-x pt-section-y pb-24">
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
          value={active.length}
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

      <div className="flex items-center justify-between mb-3">
        <div className="section-title mb-0">Расписание на сегодня</div>
        <button
          onClick={() => navigate('/master/schedule')}
          className="text-tg-link text-sm font-medium"
        >
          Всё расписание
        </button>
      </div>

      {active.length === 0 ? (
        <Card>
          <EmptyState
            emoji={'📅'}
            title="Записей на сегодня нет"
            description="Свободный день!"
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-card-gap">
          {active.map((appt) => (
            <Card key={appt.id}>
              <div className="flex items-center gap-3.5">
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

                <div className="flex flex-col items-end gap-1">
                  <StatusBadge
                    label={appt.status === 'pending' ? 'Ожидает' : 'Подтверждена'}
                    variant={appt.status === 'pending' ? 'warning' : 'success'}
                  />
                  {appt.price_final ? (
                    <span className="text-micro font-bold text-tg-text">
                      {Number(appt.price_final).toLocaleString('ru')} ₽
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Quick action buttons */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-tg-secondary">
                {appt.status === 'pending' && (
                  <Button
                    onClick={() => handleQuickAction(appt.id, 'confirm')}
                    loading={loadingId === appt.id}
                    size="sm"
                    className="flex-1"
                  >
                    Подтвердить
                  </Button>
                )}
                {['confirmed', 'paid'].includes(appt.status) && (
                  <Button
                    onClick={() => handleQuickAction(appt.id, 'complete')}
                    loading={loadingId === appt.id}
                    size="sm"
                    className="flex-1"
                  >
                    Завершить
                  </Button>
                )}
                <Button
                  onClick={() => navigate('/master/schedule')}
                  variant="secondary"
                  size="sm"
                >
                  Подробнее
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Большая кнопка создания записи над таб-баром */}
      <div className="fixed left-0 right-0 bottom-[84px] px-screen-x z-40 pointer-events-none">
        <Button
          fullWidth
          size="lg"
          onClick={() => setNewBookingOpen(true)}
          className="shadow-button pointer-events-auto"
        >
          <Plus className="w-5 h-5" /> Новая запись
        </Button>
      </div>

      <NewBookingModal isOpen={newBookingOpen} onClose={() => setNewBookingOpen(false)} />
    </div>
  );
}
