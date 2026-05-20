import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { fmtRub } from '@/shared/lib/format';
import {
  bookingStatusLabel,
  bookingStatusVariant,
} from '@/shared/lib/bookingStatus';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import { toast } from '@/shared/ui/Toast';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

import type { Booking } from '@/shared/types/api';

const TABS = [
  { key: 'upcoming', label: 'Предстоящие' },
  { key: 'past', label: 'Прошедшие' },
] as const;

const UPCOMING_STATUSES = ['confirmed', 'paid', 'pending'];

export default function MyBookings({ hideBack }: { hideBack?: boolean } = {}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const bookingStore = useBookingStore();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => bookingApi.myBookings().then((r) => r.data),
  });

  if (isLoading) return <div className="px-screen-x py-section-y"><ListSkeleton count={4} /></div>;

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
    <div className="px-screen-x pt-section-y animate-fade-in">
      {!hideBack && <BackButton to="/" />}
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
          emoji="📅"
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
                    <div className="font-medium text-sm">{b.service_name || 'Услуга'}</div>
                    <div className="text-aux text-tg-hint mt-0.5 flex items-center gap-1">
                      {'👤'}
                      {b.master_name || b.client_name || 'Мастер'}
                    </div>
                  </div>
                  <StatusBadge
                    label={bookingStatusLabel(b.status)}
                    variant={bookingStatusVariant(b.status)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-aux text-tg-hint">
                    {'📅'} {b.date ? format(parseISO(b.date), 'd MMM, EEE', { locale: ru }) : ''}
                    <span className="ml-1">{'⏰'}</span>
                    {b.time || (b.time_start ? b.time_start.slice(11, 16) : '')}
                    {b.duration_min ? ` · ${b.duration_min} мин` : ''}
                  </div>
                  {b.price_final != null && (
                    <span className="text-sm font-bold text-tg-text">
                      {fmtRub(b.price_final)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-tg-secondary/50">
                  {canCancel && (
                    <button
                      onClick={() => handleCancel(b.id)}
                      className="flex items-center gap-1 text-aux text-status-danger interactive"
                    >
                      {'❌'} Отменить
                    </button>
                  )}
                  {b.status === 'completed' && (
                    <button
                      onClick={() => navigate(`/review/${b.id}`)}
                      className="flex items-center gap-1 text-aux text-tg-link interactive"
                    >
                      {'⭐'} Оставить отзыв
                    </button>
                  )}
                  {!canCancel && b.master_id && (
                    <button
                      onClick={() => {
                        bookingStore.setMaster('', b.master_id, b.master_name || '');
                        navigate('/book/service');
                      }}
                      className="flex items-center gap-1 text-aux text-tg-link interactive"
                    >
                      {'🔄'} Записаться снова
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
