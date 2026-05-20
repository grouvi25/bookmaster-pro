/**
 * LinkPageRenderer — чистый рендер TapLink-страницы.
 * Без запросов к API — все данные передаются через props.
 * Используется:
 *   1. В публичной странице /p/:slug
 *   2. В live-preview редактора /link-page/edit
 */
import { User, Star, ExternalLink, MapPin, Clock, Download } from 'lucide-react';
import {
  type ThemeConfig,
  DEFAULT_THEME,
  themeToStyle,
  fontFamily,
} from '@/shared/lib/linkPageThemes';

export interface LinkPageData {
  display_name: string;
  specialization?: string | null;
  city?: string | null;
  description?: string | null;
  avatar_url?: string | null;
  rating_avg?: number | null;
  rating_count?: number;
  services?: { id: number; name: string; duration_min: number; price?: number | null }[];
  reviews?: { id: number; client_name: string; rating: number; text?: string | null }[];
  portfolio?: { id: number; image_url: string }[];
  links?: { url: string; label?: string }[];
}

export interface LinkPageRenderProps {
  data: LinkPageData;
  themeConfig: ThemeConfig;
  coverUrl?: string | null;
  showServices?: boolean;
  showReviews?: boolean;
  showPortfolio?: boolean;
  showPrices?: boolean;
  bookUrl?: string;
  qrUrl?: string;
  /** Скрыть QR и footer (для compact preview). */
  compact?: boolean;
}

export default function LinkPageRenderer({
  data,
  themeConfig,
  coverUrl,
  showServices = true,
  showReviews = true,
  showPortfolio = true,
  showPrices = true,
  bookUrl = '#',
  qrUrl,
  compact = false,
}: LinkPageRenderProps) {
  const tc = { ...DEFAULT_THEME, ...themeConfig };
  const style = themeToStyle(tc);

  return (
    <div
      className="min-h-full"
      style={{
        ...style,
        backgroundColor: 'var(--lp-bg)',
        color: 'var(--lp-text)',
        fontFamily: fontFamily(tc.font_style),
      }}
    >
      {/* Header */}
      <div
        className="relative pt-10 pb-14 px-5 text-center overflow-hidden"
        style={{
          backgroundColor: tc.header_style === 'image' && coverUrl ? undefined : 'var(--lp-header-bg)',
        }}
      >
        {tc.header_style === 'image' && coverUrl && (
          <>
            <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40" />
          </>
        )}
        <div className="relative z-10">
          <div
            className="w-24 h-24 mx-auto mb-3 overflow-hidden ring-4 ring-white/30 shadow-xl"
            style={{ borderRadius: `${tc.card_radius + 6}px` }}
          >
            {data.avatar_url ? (
              <img src={data.avatar_url} alt={data.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/20 backdrop-blur flex items-center justify-center">
                <User className="w-10 h-10 text-white/70" strokeWidth={1.5} />
              </div>
            )}
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{data.display_name}</h1>
          {data.specialization && (
            <p className="text-white/80 mt-0.5 text-sm">{data.specialization}</p>
          )}
          {data.city && (
            <div className="flex items-center justify-center gap-1 mt-1.5 text-white/60 text-xs">
              <MapPin className="w-3 h-3" />{data.city}
            </div>
          )}
          {(data.rating_count || 0) > 0 && (
            <div className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 bg-white/20 backdrop-blur rounded-full">
              <Star className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
              <span className="text-white font-bold text-xs">{data.rating_avg?.toFixed(1)}</span>
              <span className="text-white/70 text-[10px]">· {data.rating_count} отзывов</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-5 relative z-10 max-w-lg mx-auto">
        {/* Bio */}
        {data.description && (
          <div className="p-4 mb-3" style={{ backgroundColor: 'var(--lp-card-bg)', borderRadius: 'var(--lp-card-radius)', boxShadow: 'var(--lp-card-shadow)' }}>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-hint)' }}>{data.description}</p>
          </div>
        )}

        {/* CTA */}
        <a
          href={bookUrl}
          className="block w-full py-3.5 font-bold text-center text-base shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all mb-3"
          style={{ backgroundColor: 'var(--lp-btn-bg)', color: 'var(--lp-btn-text)', borderRadius: 'var(--lp-btn-radius)' }}
        >
          ✨ Записаться
        </a>

        {/* Links */}
        {data.links && data.links.length > 0 && (
          <div className="flex flex-col gap-2 mb-5">
            {data.links.map((link, i) => (
              <a
                key={i}
                href={/^https?:\/\//i.test(link.url) ? link.url : `https://${link.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 hover:scale-[1.01] active:scale-[0.98] transition-all"
                style={{ backgroundColor: 'var(--lp-card-bg)', borderRadius: 'var(--lp-card-radius)', boxShadow: 'var(--lp-card-shadow)' }}
              >
                <div className="w-9 h-9 flex items-center justify-center shrink-0 rounded-lg" style={{ backgroundColor: tc.button_bg + '20' }}>
                  <ExternalLink className="w-4 h-4" style={{ color: 'var(--lp-btn-bg)' }} />
                </div>
                <span className="text-sm font-medium truncate">{link.label || link.url}</span>
              </a>
            ))}
          </div>
        )}

        {/* Services */}
        {showServices && data.services && data.services.length > 0 && (
          <div className="mb-5">
            <h2 className="font-bold text-base mb-2">Услуги</h2>
            <div className="overflow-hidden divide-y" style={{ backgroundColor: 'var(--lp-card-bg)', borderRadius: 'var(--lp-card-radius)', boxShadow: 'var(--lp-card-shadow)', borderColor: 'rgba(0,0,0,0.05)' }}>
              {data.services.map((svc) => (
                <div key={svc.id} className="flex justify-between items-center px-4 py-3">
                  <div>
                    <div className="font-medium text-sm">{svc.name}</div>
                    <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--lp-hint)' }}>
                      <Clock className="w-3 h-3" />{svc.duration_min} мин
                    </div>
                  </div>
                  {showPrices && svc.price && (
                    <div className="font-bold text-sm whitespace-nowrap" style={{ color: 'var(--lp-btn-bg)' }}>
                      {Number(svc.price).toLocaleString('ru')} ₽
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio */}
        {showPortfolio && data.portfolio && data.portfolio.length > 0 && (
          <div className="mb-5">
            <h2 className="font-bold text-base mb-2">Работы</h2>
            <div className="grid grid-cols-3 gap-1.5 overflow-hidden" style={{ borderRadius: 'var(--lp-card-radius)' }}>
              {data.portfolio.slice(0, 9).map((item) => (
                <img key={item.id} src={item.image_url} alt="" className="w-full aspect-square object-cover" />
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {showReviews && data.reviews && data.reviews.length > 0 && (
          <div className="mb-5">
            <h2 className="font-bold text-base mb-2">Отзывы</h2>
            <div className="flex flex-col gap-2">
              {data.reviews.map((r) => (
                <div key={r.id} className="p-3.5" style={{ backgroundColor: 'var(--lp-card-bg)', borderRadius: 'var(--lp-card-radius)', boxShadow: 'var(--lp-card-shadow)' }}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-medium">{r.client_name}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                      ))}
                    </div>
                  </div>
                  {r.text && <p className="text-xs leading-relaxed" style={{ color: 'var(--lp-hint)' }}>{r.text}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QR + footer */}
        {!compact && qrUrl && (
          <div className="text-center pb-8">
            <div className="inline-block p-3" style={{ backgroundColor: 'var(--lp-card-bg)', borderRadius: 'var(--lp-card-radius)', boxShadow: 'var(--lp-card-shadow)' }}>
              <img src={qrUrl} alt="QR" className="w-28 h-28 mx-auto" />
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--lp-hint)' }}>Отсканируйте для записи</p>
            <a href={qrUrl} download className="inline-flex items-center gap-1 text-xs mt-1 font-medium" style={{ color: 'var(--lp-btn-bg)' }}>
              <Download className="w-3 h-3" /> Скачать QR
            </a>
          </div>
        )}

        {!compact && (
          <div className="text-center pb-5">
            <p className="text-[10px]" style={{ color: 'var(--lp-hint)', opacity: 0.4 }}>BookMaster Pro</p>
          </div>
        )}
      </div>
    </div>
  );
}
