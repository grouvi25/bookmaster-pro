import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '@/api/endpoints';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import EmptyState from '@/shared/ui/EmptyState';
import { Star, ChevronRight } from 'lucide-react';
import type { Booking } from '@/shared/types/api';
import { toArray } from '@/shared/lib/normalize';

export default function ClientLoyalty() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => bookingApi.myBookings().then((r) => r.data),
  });

  if (isLoading) return <div className="p-5"><ListSkeleton count={3} /></div>;

  const bookings = toArray<Booking>(data);
  const masterIds = [...new Set(bookings.map((b) => b.master_id))];

  return (
    <div className="p-5 pb-24 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight mb-2">Баллы лояльности</h1>
      <p className="text-sm text-tg-hint mb-5">Копите баллы за каждый визит к мастеру</p>

      {masterIds.length === 0 ? (
        <EmptyState
          Icon={Star}
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
                    <Star className="w-4 h-4 text-yellow-500" />
                    <ChevronRight className="w-4 h-4" />
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
