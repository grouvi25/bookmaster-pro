import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reviewsApi, loyaltyApi, bookingApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import EmptyState from '@/shared/ui/EmptyState';


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

  // Referral link sharing
  const [copiedRef, setCopiedRef] = useState(false);
  const { data: bookingsData } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => bookingApi.myBookings().then((r: { data: unknown }) => r.data),
  });
  const bookings = toArray<{ master_id: number; master_name?: string }>(bookingsData);
  const masterIds = [...new Set(bookings.map((b) => b.master_id))];
  const firstMasterId = masterIds[0];

  const { data: refLink } = useQuery({
    queryKey: ['referral-link', firstMasterId],
    queryFn: () => loyaltyApi.getReferralLink(firstMasterId!).then((r: { data: { referral_code: string; master_name: string } }) => r.data),
    enabled: !!firstMasterId,
  });

  const copyReferralLink = () => {
    if (!refLink) return;
    const botUrl = `https://t.me/profibook_bot?startapp=ref_${refLink.referral_code}`;
    navigator.clipboard.writeText(botUrl).then(() => {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    });
  };

  return (
    <div className="px-screen-x py-section-y animate-fade-in">
      <h1 className="text-h1 mb-section-y">Мой профиль</h1>

      {/* Referral link */}
      {refLink && (
        <div className="mb-section-y">
          <h2 className="text-h2 mb-3">🎁 Пригласить друга</h2>
          <div className="bg-tg-secondary rounded-2xl p-4">
            <p className="text-sm text-tg-hint mb-3">
              Пригласи друга к мастеру <strong className="text-tg-text">{refLink.master_name}</strong> и получи бонусные баллы!
            </p>
            <button
              onClick={copyReferralLink}
              className="w-full py-2.5 px-4 rounded-xl bg-brand-500 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              {copiedRef ? '✅ Ссылка скопирована!' : '📋 Скопировать ссылку'}
            </button>
          </div>
        </div>
      )}

      <h2 className="text-h2 mb-3">Мои отзывы</h2>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : !data || data.length === 0 ? (
        <EmptyState emoji="💬" title="Нет отзывов" description="После визита вы сможете оставить отзыв мастеру" />
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((review) => (
            <Card key={review.id}>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className="text-[14px]">
                      {i < review.rating ? '⭐' : '☆'}
                    </span>
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