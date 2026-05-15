import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '@/api/endpoints';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import EmptyState from '@/shared/ui/EmptyState';

import type { Booking } from '@/shared/types/api';
import { toArray } from '@/shared/lib/normalize';

export default function ClientLoyalty() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => bookingApi.myBookings().then((r) => r.data),
  });

  if (isLoading) return <div className="px-screen-x py-section-y"><ListSkeleton count={3} /></div>;

  const bookings = toArray<Booking>(data);
  const masterIds = [...new Set(bookings.map((b) => b.master_id))];

  return (
    <div className="px-screen-x py-section-y pb-24 screen-enter">
      <h1 className="text-h1 mb-2">Баллы лояльности</h1>
      <p className="text-aux text-tg-hint mb-section-y">Копите баллы за каждый визит к мастеру</p>

      {masterIds.length === 0 ? (
        <EmptyState
          emoji="⭐"
          title="Нет мастеров"
          description="После первого визита здесь появятся ваши баллы"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {masterIds.map((masterId) => {
            const masterBookings = bookings.filter((b) => b.master_id === masterId);
            const masterName = masterBookings[0]?.master_name || `Мастер #${masterId}`;
            const completedCount = masterBookings.filter((b) => b.status === 'completed').length;
            return (
              <Card
                key={masterId}
                className="cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/loyalty/${masterId}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{masterName}</div>
                    <div className="text-sm text-tg-hint mt-0.5">
                      {completedCount} визит{completedCount === 1 ? '' : completedCount < 5 ? 'а' : 'ов'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-tg-hint">
                    <span className="text-[16px]">⭐</span>
                    <span className="text-aux">›</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
