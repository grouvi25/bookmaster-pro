import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import BackButton from '@/components/common/BackButton';
import Loading from '@/components/common/Loading';
import Card from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';
import { CalendarDays, Clock, User, XCircle } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Подтверждена', color: 'text-green-600 bg-green-500/15' },
  paid: { label: 'Оплачена', color: 'text-green-600 bg-green-500/15' },
  pending: { label: 'Ожидает', color: 'text-yellow-600 bg-yellow-500/15' },
  completed: { label: 'Завершена', color: 'text-tg-hint bg-tg-secondary' },
  cancelled: { label: 'Отменена', color: 'text-red-500 bg-red-500/15' },
  no_show: { label: 'Не пришёл', color: 'text-red-600 bg-red-500/15' },
};

const TABS = [
  { key: 'upcoming', label: 'Предстоящие' },
  { key: 'past', label: 'Прошедшие' },
];

export default function MyBookings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('upcoming');

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => bookingApi.myBookings().then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  const bookings = toArray(data);
  const upcomingStatuses = ['confirmed', 'paid', 'pending'];
  const filtered = activeTab === 'upcoming'
    ? bookings.filter((b: Record<string, unknown>) => upcomingStatuses.includes(b.status as string))
    : bookings.filter((b: Record<string, unknown>) => !upcomingStatuses.includes(b.status as string));

  const handleCancel = async (id: number) => {
    try {
      await bookingApi.cancel(id);
      await queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      toast.success('Запись отменена');
    } catch {
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
            className={clsx(
              'chip',
              activeTab === tab.key ? 'chip-active' : 'chip-inactive'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <CalendarDays className="w-10 h-10 text-tg-hint mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-tg-hint text-sm">
            {activeTab === 'upcoming' ? 'Нет предстоящих записей' : 'Нет прошедших записей'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((b: Record<string, unknown>) => {
            const status = STATUS_MAP[b.status as string] || STATUS_MAP.pending;
            const canCancel = ['confirmed', 'paid', 'pending'].includes(b.status as string);
            return (
              <Card key={b.id as number}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-sm">{b.service_name as string}</div>
                    <div className="text-xs text-tg-hint mt-0.5 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {b.master_name as string}
                    </div>
                  </div>
                  <span className={clsx('text-xs px-2 py-1 rounded-lg font-medium', status.color)}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-tg-hint">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {b.date ? format(parseISO(b.date as string), 'd MMM, EEE', { locale: ru }) : ''}
                  <Clock className="w-3.5 h-3.5 ml-1" />
                  {b.time as string} &middot; {b.duration_min as number} мин
                </div>
                {canCancel && (
                  <button
                    onClick={() => handleCancel(b.id as number)}
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
