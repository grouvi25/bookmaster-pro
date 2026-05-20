import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { mastersApi, servicesApi, reviewsApi, loyaltyApi, subscriptionsApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import { MasterProfileSkeleton } from '@/shared/ui/Skeleton';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import { fmtRub } from '@/shared/lib/format';
import { User, Star, Package } from 'lucide-react';
import { toast } from '@/shared/ui/Toast';
import type { Service } from '@/shared/types/api';

interface Review {
  id: number;
  client_name: string;
  rating: number;
  text: string | null;
}

interface SubPackage {
  id: number;
  service_id: number | null;
  total_visits: number;
  price: number;
  is_active: boolean;
}

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

  const { data: packages } = useQuery<SubPackage[]>({
    queryKey: ['subscription-packages', master?.id],
    queryFn: () => subscriptionsApi.packages(master.id).then((r) => r.data),
    enabled: !!master?.id,
  });

  const handleBuyPackage = async (pkg: SubPackage) => {
    try {
      const resp = await subscriptionsApi.create({
        master_id: master.id,
        service_id: pkg.service_id ?? undefined,
        total_visits: pkg.total_visits,
        price: pkg.price,
      });
      if (resp.data?.confirmation_url) {
        window.location.href = resp.data.confirmation_url;
      } else {
        toast.success('Абонемент оформлен');
      }
    } catch {
      toast.error('Ошибка оформления абонемента');
    }
  };

  if (isLoading) return <MasterProfileSkeleton />;
  if (!master) return <div className="p-4 text-center text-tg-hint">Мастер не найден</div>;

  const handleBook = () => {
    setMaster(slug, master.id, master.display_name);
    navigate('/book/service');
  };

  return (
    <div className="pb-24 animate-fade-in">
      {/* Header */}
      <div className="bg-brand-500/10 p-6 text-center">
        <div className="w-24 h-24 rounded-3xl bg-tg-bg mx-auto mb-3 flex items-center justify-center overflow-hidden">
          {master.avatar_url ? (
            <img src={master.avatar_url} alt={master.display_name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-10 h-10 text-brand-300" strokeWidth={1.5} />
          )}
        </div>
        <h1 className="text-xl font-bold text-tg-text">{master.display_name}</h1>
        <p className="text-tg-hint text-sm mt-1">
          {master.specialization}
          {master.city && ` \· ${master.city}`}
        </p>
        {master.rating_count > 0 && (
          <div className="flex items-center justify-center gap-1 mt-2">
            <Star className="w-4 h-4 text-status-warning fill-yellow-400" />
            <span className="font-semibold">{master.rating_avg?.toFixed(1)}</span>
            <span className="text-tg-hint text-xs">({master.rating_count} отзывов)</span>
          </div>
        )}
      </div>

      {/* Loyalty points */}
      {loyalty?.balance > 0 && (
        <div className="mx-4 mt-4 p-card-inner bg-brand-500/10 rounded-card flex items-center justify-between">
          <span className="text-sm text-brand-700">Баллы лояльности</span>
          <span className="font-bold text-brand-600">{loyalty.balance} баллов</span>
        </div>
      )}

      {/* Bio */}
      {master.description && (
        <div className="px-4 mt-4">
          <p className="text-sm text-tg-text leading-relaxed">{master.description}</p>
        </div>
      )}

      {/* Services */}
      {services?.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="font-bold text-lg mb-3">Услуги</h2>
          <div className="flex flex-col gap-2">
            {(services as Service[]).map((svc) => (
              <div
                key={svc.id}
                className="flex justify-between items-center p-3.5 bg-surface-elevated rounded-card"
              >
                <div>
                  <div className="font-medium text-sm">{svc.name}</div>
                  <div className="text-xs text-tg-hint">{svc.duration_min} мин</div>
                </div>
                <div className="font-semibold text-brand-600 text-sm">
                  {svc.price
                    ? fmtRub(svc.price)
                    : svc.price_max
                      ? `от ${fmtRub(svc.price_max)}`
                      : 'Дог.'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscription Packages */}
      {packages && packages.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-1.5">
            <Package className="w-5 h-5 text-brand-500" />
            Абонементы
          </h2>
          <div className="flex flex-col gap-2">
            {packages.filter(p => p.is_active).map((pkg) => {
              const svc = (services as Service[])?.find(s => s.id === pkg.service_id);
              return (
                <div
                  key={pkg.id}
                  className="flex items-center justify-between p-3.5 bg-brand-500/5 border border-brand-500/20 rounded-card"
                >
                  <div>
                    <div className="font-medium text-sm">{svc?.name || 'Любая услуга'}</div>
                    <div className="text-xs text-tg-hint">{pkg.total_visits} визитов</div>
                  </div>
                  <button
                    onClick={() => handleBuyPackage(pkg)}
                    className="bg-brand-500 text-white text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-transform"
                  >
                    {fmtRub(pkg.price)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reviews */}
      {reviews?.reviews?.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="font-bold text-lg mb-3">Отзывы</h2>
          <div className="flex flex-col gap-3">
            {(reviews.reviews as Review[]).slice(0, 3).map((r) => (
              <Card key={r.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{r.client_name}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 text-status-warning fill-status-warning" />
                    ))}
                  </div>
                </div>
                {r.text ? (
                  <p className="text-xs text-tg-hint leading-relaxed">{r.text}</p>
                ) : null}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-tg-bg border-t border-tg-secondary">
        <Button onClick={handleBook} fullWidth size="lg">
          Записаться
        </Button>
      </div>
    </div>
  );
}
