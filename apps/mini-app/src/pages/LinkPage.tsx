/**
 * Публичная страница-визитка мастера (TapLink-like).
 * URL: /p/:slug — открывается в браузере.
 *
 * Рендерится по theme_config из master_pages.
 * Все цвета/radius/тени через CSS-переменные (--lp-*).
 */
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { mastersApi, servicesApi, reviewsApi, portfolioApi } from '@/api/endpoints';
import { User, Star, ExternalLink, MapPin, Clock, Download } from 'lucide-react';
import type { Service, PortfolioItem } from '@/shared/types/api';
import { pageUrl, botLink } from '@/shared/config';
import {
  type ThemeConfig,
  DEFAULT_THEME,
  themeToStyle,
  fontFamily,
} from '@/shared/lib/linkPageThemes';

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

  // Theme config: берём из master.page_theme_config или default
  const tc: ThemeConfig = {
    ...DEFAULT_THEME,
    ...(master.page_theme_config || {}),
  };
  const style = themeToStyle(tc);
  const coverUrl = master.page_cover_image_url || master.cover_url;

  const publicUrl = pageUrl(slug!);
  const bookUrl = botLink(`m_${slug}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}`;

  const socialLinks = (master.link_page_links || []).filter(
    (l: Record<string, unknown>) => !l._type && l.url
  );
  const showServices = master.page_show_services !== false;
  const showReviews = master.page_show_reviews !== false;
  const showPortfolio = master.page_show_portfolio !== false;

  return (
    <div
      className="min-h-screen"
      style={{
        ...style,
        backgroundColor: 'var(--lp-bg)',
        color: 'var(--lp-text)',
        fontFamily: fontFamily(tc.font_style),
      }}
    >
      {/* Header */}
      <div
        className="relative pt-12 pb-16 px-6 text-center overflow-hidden"
        style={{
          backgroundColor: tc.header_style === 'image' && coverUrl ? undefined : 'var(--lp-header-bg)',
        }}
      >
        {/* Cover image */}
        {tc.header_style === 'image' && coverUrl && (
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Overlay для читаемости текста на image */}
        {tc.header_style === 'image' && coverUrl && (
          <div className="absolute inset-0 bg-black/40" />
        )}

        <div className="relative z-10">
          {/* Avatar */}
          <div
            className="w-28 h-28 mx-auto mb-4 overflow-hidden ring-4 ring-white/30 shadow-xl"
            style={{ borderRadius: `${tc.card_radius + 8}px` }}
          >
            {master.avatar_url ? (
              <img src={master.avatar_url} alt={master.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/20 backdrop-blur flex items-center justify-center">
                <User className="w-12 h-12 text-white/70" strokeWidth={1.5} />
              </div>
            )}
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight">
            {master.display_name}
          </h1>
          <p className="text-white/80 mt-1 text-sm font-medium">
            {master.specialization}
          </p>
          {master.city && (
            <div className="flex items-center justify-center gap-1 mt-2 text-white/60 text-xs">
              <MapPin className="w-3 h-3" />
              {master.city}
            </div>
          )}
          {master.rating_count > 0 && (
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-white/20 backdrop-blur rounded-full">
              <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
              <span className="text-white font-bold text-sm">{master.rating_avg?.toFixed(1)}</span>
              <span className="text-white/70 text-xs">· {master.rating_count} отзывов</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-5 relative z-10 max-w-lg mx-auto">
        {/* Bio */}
        {master.description && (
          <div
            className="p-5 mb-4"
            style={{
              backgroundColor: 'var(--lp-card-bg)',
              borderRadius: 'var(--lp-card-radius)',
              boxShadow: 'var(--lp-card-shadow)',
            }}
          >
            <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-hint)' }}>
              {master.description}
            </p>
          </div>
        )}

        {/* CTA */}
        <a
          href={bookUrl}
          className="block w-full py-4 font-bold text-center text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all mb-4"
          style={{
            backgroundColor: 'var(--lp-btn-bg)',
            color: 'var(--lp-btn-text)',
            borderRadius: 'var(--lp-btn-radius)',
          }}
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
                className="flex items-center gap-3 p-3.5 hover:scale-[1.01] active:scale-[0.98] transition-all"
                style={{
                  backgroundColor: 'var(--lp-card-bg)',
                  borderRadius: 'var(--lp-card-radius)',
                  boxShadow: 'var(--lp-card-shadow)',
                }}
              >
                <div
                  className="w-10 h-10 flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: 'var(--lp-btn-bg)',
                    opacity: 0.15,
                    borderRadius: `${Math.max(tc.card_radius - 4, 6)}px`,
                  }}
                >
                  <ExternalLink className="w-4 h-4" style={{ color: 'var(--lp-btn-bg)' }} />
                </div>
                <span className="text-sm font-medium truncate">{link.label || link.url}</span>
              </a>
            ))}
          </div>
        )}

        {/* Services */}
        {showServices && services?.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-3">Услуги</h2>
            <div
              className="overflow-hidden divide-y"
              style={{
                backgroundColor: 'var(--lp-card-bg)',
                borderRadius: 'var(--lp-card-radius)',
                boxShadow: 'var(--lp-card-shadow)',
                borderColor: tc.bg_color === tc.card_bg ? 'rgba(0,0,0,0.06)' : 'transparent',
              }}
            >
              {(services as Service[]).map((svc) => (
                <div key={svc.id} className="flex justify-between items-center px-4 py-3.5">
                  <div>
                    <div className="font-medium text-sm">{svc.name}</div>
                    <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--lp-hint)' }}>
                      <Clock className="w-3 h-3" />
                      {svc.duration_min} мин
                    </div>
                  </div>
                  <div className="font-bold text-sm whitespace-nowrap" style={{ color: 'var(--lp-btn-bg)' }}>
                    {svc.price ? `${Number(svc.price).toLocaleString('ru')} ₽` : 'Дог.'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio */}
        {showPortfolio && Array.isArray(portfolio) && portfolio.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-3">Работы</h2>
            <div
              className="grid grid-cols-3 gap-1.5 overflow-hidden"
              style={{ borderRadius: 'var(--lp-card-radius)' }}
            >
              {(portfolio as PortfolioItem[]).slice(0, 9).map((item) => (
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
        {showReviews && reviews?.reviews?.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-3">Отзывы</h2>
            <div className="flex flex-col gap-2">
              {(reviews.reviews as Review[]).map((r) => (
                <div
                  key={r.id}
                  className="p-4"
                  style={{
                    backgroundColor: 'var(--lp-card-bg)',
                    borderRadius: 'var(--lp-card-radius)',
                    boxShadow: 'var(--lp-card-shadow)',
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">{r.client_name}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {r.text && (
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--lp-hint)' }}>
                      {r.text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QR */}
        <div className="text-center pb-10">
          <div
            className="inline-block p-4"
            style={{
              backgroundColor: 'var(--lp-card-bg)',
              borderRadius: 'var(--lp-card-radius)',
              boxShadow: 'var(--lp-card-shadow)',
            }}
          >
            <img src={qrUrl} alt="QR" className="w-32 h-32 mx-auto" />
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--lp-hint)' }}>
            Отсканируйте для записи
          </p>
          <a
            href={qrUrl}
            download={`qr-${slug}.png`}
            className="inline-flex items-center gap-1 text-xs mt-1 font-medium hover:underline"
            style={{ color: 'var(--lp-btn-bg)' }}
          >
            <Download className="w-3 h-3" />
            Скачать QR-код
          </a>
        </div>

        <div className="text-center pb-6">
          <p className="text-[10px]" style={{ color: 'var(--lp-hint)', opacity: 0.5 }}>
            Создано с помощью BookMaster Pro
          </p>
        </div>
      </div>
    </div>
  );
}

function LinkPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      <div className="bg-indigo-400 pt-12 pb-16 px-6 text-center">
        <div className="w-28 h-28 rounded-3xl mx-auto mb-4 bg-white/20" />
        <div className="h-7 w-48 mx-auto bg-white/20 rounded-lg mb-2" />
        <div className="h-4 w-32 mx-auto bg-white/20 rounded-lg" />
      </div>
      <div className="px-4 -mt-5 max-w-lg mx-auto space-y-3">
        <div className="bg-white rounded-2xl h-14 shadow-sm" />
        <div className="bg-white rounded-2xl h-14 shadow-sm" />
        <div className="bg-white rounded-2xl h-40 shadow-sm" />
      </div>
    </div>
  );
}

function NotFound({ slug }: { slug?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
      <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-5">
        <User className="w-10 h-10 text-gray-300" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Мастер не найден</h2>
      <p className="text-sm text-gray-500 text-center max-w-xs">
        Страница <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">/p/{slug}</span> не существует.
      </p>
    </div>
  );
}
