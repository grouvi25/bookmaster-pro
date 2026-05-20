import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Eye, EyeOff } from 'lucide-react';
import { reviewsApi, moderationApi } from '@/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import EmptyState from '@/shared/ui/EmptyState';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import ConfirmDialog from '@/shared/ui/ConfirmDialog';
import { ListSkeleton } from '@/shared/ui/Skeleton';

interface Review {
  id: number;
  master_id: number;
  rating: number;
  text?: string;
  master_reply?: string;
  is_hidden: boolean;
  hide_reason?: string;
}

export default function ReviewsTab() {
  const queryClient = useQueryClient();
  const [reviewMasterId, setReviewMasterId] = useState('');
  const [hidingReview, setHidingReview] = useState<number | null>(null);
  const [hideReason, setHideReason] = useState('');
  const [unhideTarget, setUnhideTarget] = useState<number | null>(null);

  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ['moderation-reviews', reviewMasterId],
    queryFn: () =>
      reviewMasterId
        ? reviewsApi.getByMaster(Number(reviewMasterId)).then((r) => r.data)
        : Promise.resolve([]),
    enabled: !!reviewMasterId,
  });

  const hideMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      moderationApi.reviewHide(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-reviews'] });
      setHidingReview(null);
      setHideReason('');
      toast.success('Отзыв скрыт');
    },
  });

  const unhideMutation = useMutation({
    mutationFn: (id: number) => moderationApi.reviewUnhide(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-reviews'] });
      setUnhideTarget(null);
      toast.success('Отзыв восстановлен');
    },
  });

  return (
    <div className="space-y-4">
      <input
        type="number"
        value={reviewMasterId}
        onChange={(e) => setReviewMasterId(e.target.value)}
        placeholder="ID мастера..."
        className="input-field"
      />

      {!reviewMasterId ? (
        <EmptyState
          emoji="⭐"
          title="Введите ID мастера"
          description="Для просмотра отзывов укажите ID мастера"
        />
      ) : isLoading ? (
        <ListSkeleton count={3} />
      ) : reviews.length === 0 ? (
        <EmptyState
          emoji="⭐"
          title="Нет отзывов"
          description="У этого мастера пока нет отзывов"
        />
      ) : (
        <div className="flex flex-col gap-card-gap">
          {reviews.map((review) => (
            <Card
              key={review.id}
              className={review.is_hidden ? 'opacity-60' : ''}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= review.rating
                          ? 'text-status-warning fill-status-warning'
                          : 'text-tg-hint/40'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-aux text-tg-hint">#{review.id}</span>
              </div>

              {review.text && (
                <p className="text-body text-tg-text mb-2">{review.text}</p>
              )}
              {review.master_reply && (
                <p className="text-aux text-tg-hint border-l-2 border-tg-link/30 pl-2 mb-2">
                  Ответ: {review.master_reply}
                </p>
              )}
              {review.is_hidden && review.hide_reason && (
                <p className="text-aux text-status-danger mb-2">
                  Скрыт: {review.hide_reason}
                </p>
              )}

              {review.is_hidden ? (
                <Button
                  onClick={() => setUnhideTarget(review.id)}
                  fullWidth
                  size="sm"
                >
                  <Eye className="w-4 h-4" />
                  Восстановить
                </Button>
              ) : hidingReview === review.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={hideReason}
                    onChange={(e) => setHideReason(e.target.value)}
                    placeholder="Причина скрытия..."
                    className="input-field text-body"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        hideMutation.mutate({
                          id: review.id,
                          reason: hideReason.trim(),
                        })
                      }
                      disabled={hideReason.trim().length < 5}
                      loading={hideMutation.isPending}
                      variant="danger"
                      fullWidth
                      size="sm"
                    >
                      Скрыть
                    </Button>
                    <Button
                      onClick={() => {
                        setHidingReview(null);
                        setHideReason('');
                      }}
                      variant="secondary"
                      size="sm"
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setHidingReview(review.id)}
                  variant="secondary"
                  fullWidth
                  size="sm"
                  className="!text-status-danger"
                >
                  <EyeOff className="w-4 h-4" />
                  Скрыть отзыв
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={unhideTarget != null}
        onClose={() => setUnhideTarget(null)}
        onConfirm={() => unhideTarget && unhideMutation.mutate(unhideTarget)}
        title="Восстановить отзыв?"
        description="Отзыв снова станет виден всем клиентам."
        confirmLabel="Восстановить"
        loading={unhideMutation.isPending}
      />
    </div>
  );
}
