import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { mastersApi, servicesApi, reviewsApi, portfolioApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import { User, Star, ExternalLink } from 'lucide-react';

export default function LinkPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: master, isLoading } = useQuery({
    queryKey: ['link-page-master', slug],
    queryFn: () => mastersApi.getPublic(slug!).then((r) => r.data),
    enabled: !!slug,
  });

  const { data: services } = useQuery({
    queryKey: ['link-page-services', master?.id],
    queryFn: () => servicesApi.list(master.id).then((r) => r.data),
    enabled: !!master?.id,
  });

  const { data: reviews } = useQuery({
    queryKey: ['link-page-reviews', master?.id],
    queryFn: () =>
      reviewsApi.getByMaster(master.id, { limit: '3' }).then((r) => r.data),
    enabled: !!master?.id,
  });

  const { data: portfolio } = useQuery({
    queryKey: ['link-page-portfolio', master?.id],
    queryFn: () => portfolioApi.list(master.id).then((r) => r.data),
    enabled: !!master?.id && master?.is_portfolio,
  });

  if (isLoading) return <Loading />;
  if (!master) return <div className="p-8 text-center text-tg-hint">Мастер не найден</div>;

  const appUrl = `https://t.me/BookMasterProBot?start=m_${slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(appUrl)}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      {/* Header */}
      <div className="pt-10 pb-6 px-6 text-center">
        <div className="w-28 h-28 rounded-full bg-white shadow-lg mx-auto mb-4 flex items-center justify-center overflow-hidden">
          {master.avatar_url ? (
            <img src={master.avatar_url} alt={master.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-12 h-12 text-brand-300" strokeWidth={1.5} />
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{master.name}</h1>
        <p className="text-gray-500 mt-1">{master.specialization}</p>
        {master.bio && (
          <p className="text-gray-600 text-sm mt-2 max-w-md mx-auto leading-relaxed">
            {master.bio}
          </p>
        )}
        {master.rating_count > 0 && (
          <div className="flex items-center justify-center gap-1 mt-3">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="font-bold">{master.rating_avg?.toFixed(1)}</span>
            <span className="text-gray-400 text-sm">({master.rating_count} отзывов)</span>
          </div>
        )}
      </div>

      {/* Social links */}
      {master.social_links?.length > 0 && (
        <div className="flex justify-center gap-3 px-4 mb-6">
          {master.social_links.map((link: { url: string; icon?: string }, i: number) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 bg-white shadow rounded-full flex items-center justify-center hover:scale-110 transition-transform"
            >
              <ExternalLink className="w-4 h-4 text-gray-500" />
            </a>
          ))}
        </div>
      )}

      {/* Services */}
      {services?.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="font-bold text-lg mb-3 text-center">Мои услуги</h2>
          <div className="flex flex-col gap-2 max-w-md mx-auto">
            {services.map((svc: Record<string, unknown>) => (
              <div
                key={svc.id as number}
                className="flex justify-between items-center p-3 bg-white rounded-xl shadow-sm"
              >
                <div>
                  <div className="font-medium text-sm">{svc.name as string}</div>
                  <div className="text-xs text-gray-400">{svc.duration_min as number} мин</div>
                </div>
                <div className="font-bold text-brand-600 text-sm">
                  {svc.price
                    ? `${Number(svc.price).toLocaleString('ru')} \u20bd`
                    : 'Дог.'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio */}
      {portfolio?.items?.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="font-bold text-lg mb-3 text-center">Портфолио</h2>
          <div className="grid grid-cols-3 gap-1 max-w-md mx-auto rounded-xl overflow-hidden">
            {portfolio.items.map((item: Record<string, unknown>) => (
              <img
                key={item.id as number}
                src={item.url as string}
                alt=""
                className="w-full aspect-square object-cover"
              />
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {reviews?.reviews?.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="font-bold text-lg mb-3 text-center">Отзывы</h2>
          <div className="flex flex-col gap-2 max-w-md mx-auto">
            {reviews.reviews.map((r: Record<string, unknown>) => (
              <div key={r.id as number} className="bg-white rounded-xl shadow-sm p-3">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">{r.client_name as string}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: r.rating as number }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                </div>
                {r.text ? (
                  <p className="text-xs text-gray-500">{String(r.text)}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA + QR */}
      <div className="px-4 pb-8 text-center">
        <a
          href={appUrl}
          className="inline-block w-full max-w-md bg-brand-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-brand-700 transition-colors shadow-lg"
        >
          Записаться
        </a>

        <div className="mt-6">
          <img
            src={qrUrl}
            alt="QR Code"
            className="w-32 h-32 mx-auto rounded-lg"
          />
          <p className="text-xs text-gray-400 mt-2">
            Отсканируйте для записи
          </p>
          <a
            href={qrUrl}
            download={`qr-${slug}.png`}
            className="text-brand-600 text-xs mt-1 inline-block"
          >
            Скачать QR-код
          </a>
        </div>
      </div>
    </div>
  );
}
