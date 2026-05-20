/**
 * Публичная страница-визитка мастера (TapLink-like).
 * URL: /p/:slug — открывается в браузере, НЕ в боте.
 *
 * ТЗ 8.4: аватар, имя, специализация, bio, рейтинг+отзывы,
 * ссылки-кнопки (соцсети), услуги с ценами, портфолио,
 * последние 3 отзыва, кнопка [Записаться], QR-код.
 *
 * Дизайн: публичная страница вне TG-темы — свои цвета,
 * gradient header, стеклянные карточки, плавные анимации.
 */
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { mastersApi, servicesApi, reviewsApi, portfolioApi } from '@/api/endpoints';
import { User, Star, ExternalLink, MapPin, Clock, Download } from 'lucide-react';
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
    queryFn: () => reviewsApi.getByMaster(master.id, { limit: '3' }).then((r) => r.data),
    enabled: !!master?.id,
  });

  const { data: portfolio } = useQuery({
    queryKey: ['link-page-portfolio', master?.id],
    queryFn: () => portfolioApi.list(master.id).then((r) => r.data),
    enabled: !!master?.id && master?.is_portfolio,
  });

  if (isLoading) return <LinkPageSkeleton />;
  if (!master) return <NotFound slug={slug} />;

  const publicUrl = pageUrl(slug!);
  const bookUrl = botLink(`m_${slug}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}&bgcolor=ffffff&color=1a1a2e`;

  const socialLinks = (master.link_page_links || []).filter(
    (l: Record<string, unknown>) => !l._type && l.url
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white font-sans">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-400 opacity-90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 to-transparent" />

        <div className="relative pt-12 pb-16 px-6 text-center">
          {/* Avatar */}
          <div className="w-32 h-32 rounded-[2rem] mx-auto mb-5 overflow-hidden ring-4 ring-white/30 shadow-2xl">
            {master.avatar_url ? (
              <img
                src={master.avatar_url}
                alt={master.display_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-white/20 backdrop-blur flex items-center justify-center">
                <User className="w-14 h-14 text-white/70" strokeWidth={1.5} />
              </div>
            )}
          </div>

          {/* Name & specialization */}
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {master.display_name}
          </h1>
          <p className="text-white/80 mt-1 text-sm font-medium">
            {master.specialization}
          </p>

          {/* Location */}
          {master.city && (
            <div className="flex items-center justify-center gap-1 mt-2 text-white/60 text-xs">
              <MapPin className="w-3 h-3" />
              {master.city}
            </div>
          )}

          {/* Rating */}
          {master.rating_count > 0 && (
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-white/20 backdrop-blur rounded-full">
              <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
              <span className="text-white font-bold text-sm">
                {master.rating_avg?.toFixed(1)}
              </span>
              <span className="text-white/70 text-xs">
                · {master.rating_count} отзывов
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-6 relative z-10 max-w-lg mx-auto">

        {/* Bio */}
        {master.description && (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <p className="text-gray-700 text-sm leading-relaxed">
              {master.description}
            </p>
          </div>
        )}

        {/* CTA Button */}
        <a
          href={bookUrl}
          className="block w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-4 rounded-2xl font-bold text-center text-lg shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all mb-4"
        >
          ✨ Записаться
        </a>

        {/* Social links */}
        {socialLinks.length > 0 && (
          <div className="flex flex-col gap-2 mb-6">
            {socialLinks.map((link: { url: string; label?: string }, i: number) => (
              <a
                key={i}
                href={/^https?:\/\//i.test(link.url) ? link.url : `https://${link.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3.5 bg-white rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl flex items-center justify-center shrink-0">
                  <ExternalLink className="w-4 h-4 text-indigo-500" />
                </div>
                <span className="text-sm font-medium text-gray-800 truncate">
                  {link.label || link.url}
                </span>
              </a>
            ))}
          </div>
        )}

        {/* Services */}
        {services?.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-lg text-gray-900 mb-3">Услуги</h2>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
              {(services as Service[]).map((svc) => (
                <div key={svc.id} className="flex justify-between items-center px-4 py-3.5">
                  <div>
                    <div className="font-medium text-sm text-gray-900">{svc.name}</div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {svc.duration_min} мин
                    </div>
                  </div>
                  <div className="font-bold text-indigo-600 text-sm whitespace-nowrap">
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
          <div className="mb-6">
            <h2 className="font-bold text-lg text-gray-900 mb-3">Работы</h2>
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden">
              {(portfolio as PortfolioItem[]).slice(0, 9).map((item) => (
                <img
                  key={item.id}
                  src={item.image_url}
                  alt=""
                  className="w-full aspect-square object-cover hover:opacity-90 transition-opacity"
                />
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {reviews?.reviews?.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-lg text-gray-900 mb-3">Отзывы</h2>
            <div className="flex flex-col gap-2">
              {(reviews.reviews as Review[]).map((r) => (
                <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-800">
                      {r.client_name}
                    </span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < r.rating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {r.text && (
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {r.text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QR Code */}
        <div className="text-center pb-10">
          <div className="inline-block bg-white rounded-2xl p-4 shadow-sm">
            <img
              src={qrUrl}
              alt="QR для записи"
              className="w-36 h-36 mx-auto"
            />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Отсканируйте для записи
          </p>
          <a
            href={qrUrl}
            download={`qr-${slug}.png`}
            className="inline-flex items-center gap-1 text-indigo-500 text-xs mt-1 font-medium hover:underline"
          >
            <Download className="w-3 h-3" />
            Скачать QR-код
          </a>
        </div>

        {/* Footer */}
        <div className="text-center pb-6">
          <p className="text-[10px] text-gray-300">
            Создано с помощью BookMaster Pro
          </p>
        </div>
      </div>
    </div>
  );
}

function LinkPageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white animate-pulse">
      <div className="bg-gradient-to-br from-indigo-400 to-purple-400 pt-12 pb-16 px-6 text-center">
        <div className="w-32 h-32 rounded-[2rem] mx-auto mb-5 bg-white/20" />
        <div className="h-7 w-48 mx-auto bg-white/20 rounded-lg mb-2" />
        <div className="h-4 w-32 mx-auto bg-white/20 rounded-lg" />
      </div>
      <div className="px-4 -mt-6 max-w-lg mx-auto space-y-4">
        <div className="bg-white rounded-2xl h-14 shadow-sm" />
        <div className="bg-white rounded-2xl h-14 shadow-sm" />
        <div className="bg-white rounded-2xl h-40 shadow-sm" />
      </div>
    </div>
  );
}

function NotFound({ slug }: { slug?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-5">
        <User className="w-10 h-10 text-gray-300" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Мастер не найден</h2>
      <p className="text-sm text-gray-500 text-center max-w-xs leading-relaxed">
        Страница{' '}
        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
          /p/{slug}
        </span>{' '}
        не существует. Проверьте ссылку или попросите мастера прислать актуальную.
      </p>
    </div>
  );
}
