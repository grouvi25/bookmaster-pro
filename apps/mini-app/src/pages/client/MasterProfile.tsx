import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { mastersApi, servicesApi, reviewsApi, loyaltyApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import Loading from '@/components/common/Loading';
import { User, Star } from 'lucide-react';

interface MasterProfileProps {
  slug: string;
}

export default function MasterProfile({ slug }: MasterProfileProps) {
  const navigate = useNavigate();
  const setMaster = useBookingStore((s) => s.setMaster);

  const { data: master, isLoading } = useQuery({
    queryKey: ['master', slug],
    queryFn: () => mastersApi.getPublic(slug).then((r) => r.data),
  });

  const { data: services } = useQuery({
    queryKey: ['services', master?.id],
    queryFn: () => servicesApi.list(master.id).then((r) => r.data),
    enabled: !!master?.id,
  });

  const { data: reviews } = useQuery({
    queryKey: ['reviews', master?.id],
    queryFn: () => reviewsApi.getByMaster(master.id).then((r) => r.data),
    enabled: !!master?.id,
  });

  const { data: loyalty } = useQuery({
    queryKey: ['loyalty', master?.id],
    queryFn: () => loyaltyApi.getBalance(master.id).then((r) => r.data),
    enabled: !!master?.id,
  });

  if (isLoading) return <Loading />;
  if (!master) return <div className="p-4 text-center text-tg-hint">Мастер не найден</div>;

  const handleBook = () => {
    setMaster(slug, master.id, master.name);
    navigate('/book/service');
  };

  return (
    <div className="pb-24 animate-fade-in">
      {/* Header */}
      <div className="bg-brand-50 p-6 text-center">
        <div className="w-24 h-24 rounded-3xl bg-white shadow-card-lg mx-auto mb-3 flex items-center justify-center overflow-hidden">
          {master.avatar_url ? (
            <img src={master.avatar_url} alt={master.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-10 h-10 text-brand-300" strokeWidth={1.5} />
          )}
        </div>
        <h1 className="text-xl font-bold text-tg-text">{master.name}</h1>
        <p className="text-tg-hint text-sm mt-1">
          {master.specialization}
          {master.city && ` \u00b7 ${master.city}`}
        </p>
        {master.rating_count > 0 && (
          <div className="flex items-center justify-center gap-1 mt-2">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="font-semibold">{master.rating_avg?.toFixed(1)}</span>
            <span className="text-tg-hint text-xs">({master.rating_count} отзывов)</span>
          </div>
        )}
      </div>

      {/* Loyalty points */}
      {loyalty?.balance > 0 && (
        <div className="mx-4 mt-4 p-3.5 bg-brand-50 rounded-2xl flex items-center justify-between">
          <span className="text-sm text-brand-700">Баллы лояльности</span>
          <span className="font-bold text-brand-600">{loyalty.balance} баллов</span>
        </div>
      )}

      {/* Bio */}
      {master.bio && (
        <div className="px-4 mt-4">
          <p className="text-sm text-tg-text leading-relaxed">{master.bio}</p>
        </div>
      )}

      {/* Services */}
      {services?.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="font-bold text-lg mb-3">Услуги</h2>
          <div className="flex flex-col gap-2">
            {services.map((svc: Record<string, unknown>) => (
              <div
                key={svc.id as number}
                className="flex justify-between items-center p-3.5 bg-surface-elevated shadow-card rounded-2xl"
              >
                <div>
                  <div className="font-medium text-sm">{String(svc.name)}</div>
                  <div className="text-xs text-tg-hint">{Number(svc.duration_min)} мин</div>
                </div>
                <div className="font-semibold text-brand-600 text-sm">
                  {svc.price
                    ? `${Number(svc.price).toLocaleString('ru')} \u20bd`
                    : svc.price_from
                      ? `от ${Number(svc.price_from).toLocaleString('ru')} \u20bd`
                      : 'Дог.'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {reviews?.reviews?.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="font-bold text-lg mb-3">Отзывы</h2>
          <div className="flex flex-col gap-3">
            {reviews.reviews.slice(0, 3).map((r: Record<string, unknown>) => (
              <div key={r.id as number} className="bg-surface-elevated shadow-card rounded-2xl p-3.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{r.client_name as string}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: r.rating as number }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                </div>
                {r.text ? (
                  <p className="text-xs text-tg-hint leading-relaxed">{String(r.text)}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-tg-bg border-t border-gray-100">
        <button
          onClick={handleBook}
          className="w-full bg-tg-button text-tg-button-text py-3.5 rounded-xl font-bold text-base"
        >
          Записаться
        </button>
      </div>
    </div>
  );
}
