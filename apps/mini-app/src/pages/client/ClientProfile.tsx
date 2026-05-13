import { useQuery } from '@tanstack/react-query';
import { reviewsApi } from '@/api/endpoints';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import EmptyState from '@/shared/ui/EmptyState';
import { Star, MessageSquare } from 'lucide-react';

interface Review {
  id: number;
  appointment_id: number;
  master_id: number;
  client_id: number;
  rating: number;
  text: string | null;
  master_reply: string | null;
  is_hidden: boolean;
}

export default function ClientProfile() {
  const { data, isLoading } = useQuery<Review[]>({
    queryKey: ['my-reviews'],
    queryFn: () => reviewsApi.myReviews().then((r) => r.data),
  });

  return (
    <div className="p-5 pb-24 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight mb-5">Мой профиль</h1>

      <h2 className="text-lg font-semibold mb-3">Мои отзывы</h2>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : !data || data.length === 0 ? (
        <EmptyState Icon={MessageSquare} title="Нет отзывов" description="После визита вы сможете оставить отзыв мастеру" />
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((review) => (
            <Card key={review.id}>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
              </div>
              {review.text && (
                <p className="text-sm text-tg-text mb-2">{review.text}</p>
              )}
              {review.master_reply && (
                <div className="bg-tg-secondary rounded-xl p-3 mt-2">
                  <div className="text-xs text-tg-hint mb-1">Ответ мастера:</div>
                  <p className="text-sm text-tg-text">{review.master_reply}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
