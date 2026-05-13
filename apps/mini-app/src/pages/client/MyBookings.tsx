import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import BackButton from '@/components/common/BackButton';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import { toast } from '@/shared/ui/Toast';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarDays, Clock, User, XCircle } from 'lucide-react';
import type { Booking } from '@/shared/types/api';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  confirmed: 'success',
  paid: 'success',
  pending: 'warning',
  completed: 'neutral',
  cancelled: 'danger',
  cancelled_by_client: 'danger',
  cancelled_by_master: 'danger',
  no_show: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Подтверждена',
  paid: 'Оплачена',
  pending: 'Ожидает',
  completed: 'Завершена',
  cancelled: 'Отменена',
  cancelled_by_client: 'Отменена',
  cancelled_by_master: 'Отменена',
  no_show: 'Не пришёл',
};

const TABS = [
  { key: 'upcoming', label: 'Предстоящие' },
  { key: 'past', label: 'Прошедшие' },
] as const;

const UPCOMING_STATUSES = ['confirmed', 'paid', 'pending'];

export default function MyBookings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => bookingApi.myBookings().then((r) => r.data),
  });

  if (isLoading) return <div className="p-5"><ListSkeleton count={4} /></div>;

  const bookings = toArray<Booking>(data);
  const filtered = activeTab === 'upcoming'
    ? bookings.filter((b) => UPCOMING_STATUSES.includes(b.status))
    : bookings.filter((b) => !UPCOMING_STATUSES.includes(b.status));

  const handleCancel = async (id: number) => {
    const prev = queryClient.getQueryData(['my-bookings']);
    queryClient.setQueryData(['my-bookings'], (old: unknown) => {
      if (Array.isArray(old)) return old.map((b: Booking) => b.id === id ? { ...b, status: 'cancelled_by_client' } : b);
      return old;
    });
    try {
      await bookingApi.cancel(id);
      await queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      toast.success('Запись отменена');
    } catch {
      queryClient.setQueryData(['my-bookings'], prev);
      toast.error('Не удалось отменить');
    }
  };

  return (
    <div className="p-5 pb-24 animate-fade-in">
      <BackButton to="/" />
      <h1 className="text-2xl font-bold tracking-tight mb-5">Мои записи</h1>

      <div className="flex gap-2 mb-5">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`chip ${activeTab === tab.key ? 'chip-active' : 'chip-inactive'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          Icon={CalendarDays}
          title={activeTab === 'upcoming' ? 'Нет предстоящих записей' : 'Нет прошедших записей'}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((b) => {
            const canCancel = UPCOMING_STATUSES.includes(b.status);
            return (
              <Card key={b.id}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-sm">{b.service_name}</div>
                    <div className="text-xs text-tg-hint mt-0.5 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {b.client_name}
                    </div>
                  </div>
                  <StatusBadge
                    label={STATUS_LABEL[b.status] || b.status}
                    variant={STATUS_VARIANT[b.status] || 'neutral'}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-tg-hint">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {b.date ? format(parseISO(b.date), 'd MMM, EEE', { locale: ru }) : ''}
                  <Clock className="w-3.5 h-3.5 ml-1" />
                  {b.time} &middot; {b.duration_min} мин
                </div>
                {canCancel && (
                  <button
                    onClick={() => handleCancel(b.id)}
                    className="flex items-center gap-1 mt-2 text-xs text-red-500"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Отменить
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
