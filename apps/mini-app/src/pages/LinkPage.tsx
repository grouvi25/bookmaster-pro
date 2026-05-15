import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { mastersApi, servicesApi, reviewsApi, portfolioApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import { User, Star, ExternalLink } from 'lucide-react';
import type { Service, PortfolioItem } from '@/shared/types/api';
import { pageUrl, botLink } from '@/shared/config';

interface Review {
  id: number;
  client_name: string;
  rating: number;
  text: string | null;
}

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
  if (!master) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-tg-bg p-6">
      <User className="w-16 h-16 text-tg-hint/40 mb-4" strokeWidth={1.5} />
      <h2 className="text-xl font-bold text-tg-text mb-2">Мастер не найден</h2>
      <p className="text-sm text-tg-hint text-center max-w-xs">
        Страница с адресом <span className="font-mono text-xs bg-tg-secondary px-1 rounded">/p/{slug}</span> не существует. 
        Проверьте ссылку или попросите мастера прислать актуальную.
      </p>
    </div>
  );

  const publicUrl = pageUrl(slug!);
  const bookUrl = botLink(`m_${slug}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicUrl)}`;

  return (
    <div className="min-h-screen bg-tg-bg">
      {/* Header */}
      <div className="pt-10 pb-6 px-6 text-center">
        <div className="w-28 h-28 rounded-3xl bg-brand-500/10 mx-auto mb-4 flex items-center justify-center overflow-hidden">
          {master.avatar_url ? (
            <img src={master.avatar_url} alt={master.display_name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-12 h-12 text-brand-300" strokeWidth={1.5} />
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{master.display_name}</h1>
        <p className="text-gray-500 mt-1">{master.specialization}</p>
        {master.description && (
          <p className="text-gray-600 text-sm mt-2 max-w-md mx-auto leading-relaxed">
            {master.description}
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
      {master.link_page_links?.filter((l: Record<string, unknown>) => !l._type && l.url).length > 0 && (
        <div className="flex flex-col items-center gap-2 px-4 mb-6 max-w-md mx-auto">
          {master.link_page_links
            .filter((l: Record<string, unknown>) => !l._type && l.url)
            .map((link: { url: string; label?: string }, i: number) => (
            <a
              key={i}
              href={/^https?:\/\//i.test(link.url) ? link.url : `https://${link.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 p-3 bg-surface-elevated rounded-card hover:scale-[1.02] transition-transform"
            >
              <div className="w-10 h-10 bg-tg-secondary rounded-xl flex items-center justify-center shrink-0">
                <ExternalLink className="w-4 h-4 text-gray-500" />
              </div>
              <span className="text-sm font-medium text-tg-text truncate">
                {link.label || link.url}
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Services */}
      {services?.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="font-bold text-lg mb-3 text-center">Мои услуги</h2>
          <div className="flex flex-col gap-2 max-w-md mx-auto">
            {(services as Service[]).map((svc) => (
              <div
                key={svc.id}
                className="flex justify-between items-center p-3.5 bg-surface-elevated rounded-card"
              >
                <div>
                  <div className="font-medium text-sm">{svc.name}</div>
                  <div className="text-xs text-gray-400">{svc.duration_min} мин</div>
                </div>
                <div className="font-bold text-brand-600 text-sm">
                  {svc.price
                    ? `${Number(svc.price).toLocaleString('ru')} ₽`
                    : 'Дог.'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio */}
      {Array.isArray(portfolio) && portfolio.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="font-bold text-lg mb-3 text-center">Портфолио</h2>
          <div className="grid grid-cols-3 gap-1 max-w-md mx-auto rounded-xl overflow-hidden">
            {(portfolio as PortfolioItem[]).map((item) => (
              <img
                key={item.id}
                src={item.image_url}
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
            {(reviews.reviews as Review[]).map((r) => (
              <div key={r.id} className="bg-surface-elevated rounded-card p-3.5">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">{r.client_name}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                </div>
                {r.text ? (
                  <p className="text-xs text-gray-500">{r.text}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA + QR */}
      <div className="px-4 pb-8 text-center">
        <a
          href={bookUrl}
          className="inline-block w-full max-w-md bg-brand-500 text-white py-4 rounded-btn font-bold text-lg shadow-button active:scale-[0.97] transition-all"
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
