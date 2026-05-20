/**
 * Live-editor TapLink-страницы.
 *
 * Сплит-экран:
 * - Верх (40%): live preview страницы (масштабированный)
 * - Низ (60%): панель настроек
 *
 * Все изменения мгновенно отражаются на preview.
 * Save → PATCH /masters/me/page.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { mastersApi, uploadsApi, servicesApi, reviewsApi, portfolioApi } from '@/api/endpoints';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import { FormSkeleton } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/Toast';
import LinkPageRenderer from '@/components/LinkPageRenderer';
import {
  type ThemeConfig,
  DEFAULT_THEME,
  THEME_PRESETS,
} from '@/shared/lib/linkPageThemes';
import {
  Palette, Image, Type, ToggleLeft, Link2, Plus, Trash2,
  ExternalLink, Save, Upload, ArrowLeft, ChevronDown, ChevronUp,
} from 'lucide-react';

interface PageData {
  theme: string;
  theme_config: Partial<ThemeConfig>;
  custom_links: { url: string; label?: string }[];
  cover_image_url: string | null;
  show_reviews: boolean;
  show_portfolio: boolean;
  show_services: boolean;
  show_prices: boolean;
  bio_text: string | null;
}

export default function LinkPageEditor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['master-profile'],
    queryFn: () => mastersApi.getProfile().then((r) => r.data),
  });

  const { data: services } = useQuery({
    queryKey: ['services-for-editor'],
    queryFn: () => servicesApi.list().then((r) => r.data),
  });

  const { data: reviews } = useQuery({
    queryKey: ['reviews-for-editor', profile?.id],
    queryFn: () => reviewsApi.getByMaster(profile.id, { limit: '3' }).then((r) => r.data),
    enabled: !!profile?.id,
  });

  const { data: portfolioItems } = useQuery({
    queryKey: ['portfolio-for-editor', profile?.id],
    queryFn: () => portfolioApi.list(profile.id).then((r) => r.data),
    enabled: !!profile?.id,
  });

  const { data: pageData, isLoading } = useQuery<PageData>({
    queryKey: ['master-page-settings'],
    queryFn: () => mastersApi.getPage().then((r) => r.data),
  });

  const [selectedPreset, setSelectedPreset] = useState('light');
  const [config, setConfig] = useState<ThemeConfig>(DEFAULT_THEME);
  const [links, setLinks] = useState<{ url: string; label?: string }[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [showServices, setShowServices] = useState(true);
  const [showReviews, setShowReviews] = useState(true);
  const [showPortfolio, setShowPortfolio] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('theme');

  useEffect(() => {
    if (pageData) {
      setSelectedPreset(pageData.theme || 'light');
      setConfig({ ...DEFAULT_THEME, ...(pageData.theme_config || {}) });
      setLinks(pageData.custom_links || []);
      setCoverUrl(pageData.cover_image_url);
      setShowServices(pageData.show_services !== false);
      setShowReviews(pageData.show_reviews !== false);
      setShowPortfolio(pageData.show_portfolio !== false);
      setShowPrices(pageData.show_prices !== false);
    }
  }, [pageData]);

  const saveMutation = useMutation({
    mutationFn: () =>
      mastersApi.updatePage({
        theme: selectedPreset,
        theme_config: config,
        custom_links: links,
        cover_image_url: coverUrl,
        show_services: showServices,
        show_reviews: showReviews,
        show_portfolio: showPortfolio,
        show_prices: showPrices,
      }),
    onSuccess: () => {
      toast.success('Страница сохранена');
      queryClient.invalidateQueries({ queryKey: ['master-page-settings'] });
    },
    onError: () => toast.error('Ошибка сохранения'),
  });

  const updateConfig = (patch: Partial<ThemeConfig>) => setConfig((p) => ({ ...p, ...patch }));

  const selectPreset = (key: string) => {
    const preset = THEME_PRESETS.find((p) => p.key === key);
    if (preset) { setSelectedPreset(key); setConfig(preset.config); }
  };

  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    setLinks([...links, { url: newLinkUrl.trim(), label: newLinkLabel.trim() || undefined }]);
    setNewLinkUrl(''); setNewLinkLabel('');
  };

  const removeLink = (idx: number) => setLinks(links.filter((_, i) => i !== idx));

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setAvatarUploading(true);
    try {
      const resp = await uploadsApi.uploadFile(file, 'avatars');
      const url = resp.data?.url || resp.data?.public_url;
      if (url) { await mastersApi.updateProfile({ avatar_url: url }); queryClient.invalidateQueries({ queryKey: ['master-profile'] }); toast.success('Аватар обновлён'); }
    } catch { toast.error('Ошибка'); } finally { setAvatarUploading(false); }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setCoverUploading(true);
    try {
      const resp = await uploadsApi.uploadFile(file, 'covers');
      const url = resp.data?.url || resp.data?.public_url;
      if (url) { setCoverUrl(url); updateConfig({ header_style: 'image' }); toast.success('Обложка загружена'); }
    } catch { toast.error('Ошибка'); } finally { setCoverUploading(false); }
  };

  if (isLoading) return <div className="p-6"><FormSkeleton rows={6} /></div>;

  const slug = profile?.slug as string | undefined;

  const SECTIONS = [
    { key: 'theme', label: 'Тема', icon: <Palette className="w-4 h-4" /> },
    { key: 'header', label: 'Шапка', icon: <Image className="w-4 h-4" /> },
    { key: 'button', label: 'Кнопка', icon: <Type className="w-4 h-4" /> },
    { key: 'cards', label: 'Карточки', icon: <Palette className="w-4 h-4" /> },
    { key: 'content', label: 'Контент', icon: <ToggleLeft className="w-4 h-4" /> },
    { key: 'links', label: 'Ссылки', icon: <Link2 className="w-4 h-4" /> },
    { key: 'share', label: 'QR / Ссылка', icon: <ExternalLink className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 flex flex-col bg-tg-bg z-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-tg-secondary shrink-0">
        <button onClick={() => navigate('/master/settings')} className="p-2 text-tg-text interactive">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-h3 font-semibold">Редактор страницы</span>
        <Button size="sm" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
          <Save className="w-4 h-4" /> Сохранить
        </Button>
      </div>

      {/* Preview */}
      <div className={`relative shrink-0 overflow-hidden transition-all duration-300 border-b border-tg-secondary ${previewExpanded ? 'flex-1' : 'h-[38vh]'}`}>
        <div className="w-full h-full overflow-y-auto">
          <LinkPageRenderer
            data={{
              display_name: profile?.display_name || 'Мастер',
              specialization: profile?.specialization,
              city: profile?.city,
              description: profile?.description,
              avatar_url: profile?.avatar_url,
              rating_avg: profile?.rating_avg,
              rating_count: profile?.rating_count,
              services: Array.isArray(services) ? services : [],
              reviews: reviews?.reviews || [],
              portfolio: Array.isArray(portfolioItems) ? portfolioItems : [],
              links,
            }}
            themeConfig={config}
            coverUrl={coverUrl}
            showServices={showServices}
            showReviews={showReviews}
            showPortfolio={showPortfolio}
            showPrices={showPrices}
            compact
          />
        </div>
        <button
          onClick={() => setPreviewExpanded(!previewExpanded)}
          className="absolute bottom-2 right-2 bg-black/60 text-white rounded-full p-1.5 backdrop-blur-sm z-10"
        >
          {previewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Editor panel */}
      <div className={`flex-1 overflow-y-auto px-4 py-4 ${previewExpanded ? 'hidden' : ''}`}>
        {/* Section tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`chip whitespace-nowrap flex items-center gap-1 ${activeSection === s.key ? 'chip-active' : 'chip-inactive'}`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Section content */}
        {activeSection === 'theme' && (
          <div className="grid grid-cols-3 gap-2">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => selectPreset(preset.key)}
                className={`p-3 rounded-card text-center transition-all ${
                  selectedPreset === preset.key ? 'ring-2 ring-tg-button scale-[1.03]' : 'bg-tg-secondary'
                }`}
                style={selectedPreset === preset.key ? { backgroundColor: preset.config.card_bg } : undefined}
              >
                <div className="text-xl mb-1">{preset.emoji}</div>
                <div className="text-aux font-medium">{preset.name}</div>
              </button>
            ))}
          </div>
        )}

        {activeSection === 'header' && (
          <div className="space-y-3">
            <Card className="space-y-3">
              <div className="flex gap-2">
                <button onClick={() => updateConfig({ header_style: 'solid' })} className={`flex-1 py-2 rounded-btn text-sm font-medium ${config.header_style === 'solid' ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary'}`}>Цвет</button>
                <button onClick={() => updateConfig({ header_style: 'image' })} className={`flex-1 py-2 rounded-btn text-sm font-medium ${config.header_style === 'image' ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary'}`}>Фото</button>
              </div>
              {config.header_style === 'solid' && (
                <div>
                  <label className="text-aux text-tg-hint mb-1 block">Цвет шапки</label>
                  <input type="color" value={config.header_bg} onChange={(e) => updateConfig({ header_bg: e.target.value })} className="w-full h-12 rounded-btn cursor-pointer border-none" />
                </div>
              )}
              {config.header_style === 'image' && (
                <div>
                  {coverUrl && <img src={coverUrl} alt="" className="w-full h-20 object-cover rounded-xl mb-2" />}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                    <Button variant="secondary" fullWidth size="sm" loading={coverUploading} onClick={() => {}}><Image className="w-4 h-4" /> {coverUrl ? 'Заменить' : 'Загрузить обложку'}</Button>
                  </label>
                </div>
              )}
            </Card>
            {/* Avatar */}
            <Card className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-tg-secondary overflow-hidden shrink-0">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-tg-hint"><Upload className="w-5 h-5" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium">Аватар</p>
                <p className="text-aux text-tg-hint">На странице и в каталоге</p>
              </div>
              <label className="cursor-pointer"><input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} /><Button size="sm" loading={avatarUploading} onClick={() => {}}>📷</Button></label>
            </Card>
          </div>
        )}

        {activeSection === 'button' && (
          <Card className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1"><label className="text-aux text-tg-hint mb-1 block">Фон</label><input type="color" value={config.button_bg} onChange={(e) => updateConfig({ button_bg: e.target.value })} className="w-full h-10 rounded-btn cursor-pointer border-none" /></div>
              <div className="flex-1"><label className="text-aux text-tg-hint mb-1 block">Текст</label><input type="color" value={config.button_text} onChange={(e) => updateConfig({ button_text: e.target.value })} className="w-full h-10 rounded-btn cursor-pointer border-none" /></div>
            </div>
            <div><label className="text-aux text-tg-hint mb-1 block">Скругление: {config.button_radius}px</label><input type="range" min={0} max={32} value={config.button_radius} onChange={(e) => updateConfig({ button_radius: Number(e.target.value) })} className="w-full" /></div>
            <div className="w-full py-3 text-center font-bold text-sm" style={{ backgroundColor: config.button_bg, color: config.button_text, borderRadius: `${config.button_radius}px` }}>✨ Записаться</div>
          </Card>
        )}

        {activeSection === 'cards' && (
          <Card className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1"><label className="text-aux text-tg-hint mb-1 block">Фон карточек</label><input type="color" value={config.card_bg} onChange={(e) => updateConfig({ card_bg: e.target.value })} className="w-full h-10 rounded-btn cursor-pointer border-none" /></div>
              <div className="flex-1"><label className="text-aux text-tg-hint mb-1 block">Фон страницы</label><input type="color" value={config.bg_color} onChange={(e) => updateConfig({ bg_color: e.target.value })} className="w-full h-10 rounded-btn cursor-pointer border-none" /></div>
            </div>
            <div><label className="text-aux text-tg-hint mb-1 block">Скругление: {config.card_radius}px</label><input type="range" min={0} max={28} value={config.card_radius} onChange={(e) => updateConfig({ card_radius: Number(e.target.value) })} className="w-full" /></div>
            <label className="flex items-center gap-2 text-body cursor-pointer"><input type="checkbox" checked={config.card_shadow} onChange={(e) => updateConfig({ card_shadow: e.target.checked })} />Тени на карточках</label>
          </Card>
        )}

        {activeSection === 'content' && (
          <Card className="space-y-2">
            {[
              { l: 'Показывать услуги', v: showServices, s: setShowServices },
              { l: 'Показывать цены', v: showPrices, s: setShowPrices },
              { l: 'Показывать отзывы', v: showReviews, s: setShowReviews },
              { l: 'Показывать портфолио', v: showPortfolio, s: setShowPortfolio },
            ].map((t) => (
              <label key={t.l} className="flex items-center justify-between py-2 cursor-pointer">
                <span className="text-body">{t.l}</span>
                <input type="checkbox" checked={t.v} onChange={(e) => t.s(e.target.checked)} className="w-5 h-5 rounded" />
              </label>
            ))}
          </Card>
        )}

        {activeSection === 'links' && (
          <div className="space-y-3">
            {links.map((link, i) => (
              <Card key={i} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-tg-hint shrink-0" />
                <div className="flex-1 min-w-0"><div className="text-body font-medium truncate">{link.label || link.url}</div></div>
                <button onClick={() => removeLink(i)} className="p-1 text-status-danger"><Trash2 className="w-4 h-4" /></button>
              </Card>
            ))}
            <Card className="space-y-2">
              <input type="url" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} placeholder="https://..." className="input-field" />
              <input type="text" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} placeholder="Название (необязательно)" className="input-field" />
              <Button variant="secondary" size="sm" fullWidth onClick={addLink} disabled={!newLinkUrl.trim()}><Plus className="w-4 h-4" /> Добавить</Button>
            </Card>
          </div>
        )}

        {activeSection === 'share' && slug && (
          <div className="space-y-4">
            {/* Ссылка */}
            <Card className="space-y-3">
              <h3 className="text-body font-medium">Ваша страница</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/p/${slug}`}
                  className="input-field text-aux flex-1"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`);
                    toast.success('Ссылка скопирована');
                  }}
                >
                  📋
                </Button>
              </div>
              <a
                href={`/p/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center text-tg-link text-body font-medium py-2 interactive"
              >
                Открыть страницу ↗
              </a>
            </Card>

            {/* QR */}
            <Card className="text-center space-y-3">
              <h3 className="text-body font-medium">QR-код</h3>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}/p/${slug}`)}`}
                alt="QR"
                className="w-40 h-40 mx-auto rounded-xl"
              />
              <p className="text-aux text-tg-hint">
                Распечатайте и разместите в кабинете или на визитке
              </p>
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`${window.location.origin}/p/${slug}`)}`}
                download={`qr-${slug}.png`}
                className="text-tg-link text-aux font-medium interactive inline-block"
              >
                ⬇️ Скачать QR-код (PNG)
              </a>
            </Card>

            {/* Бот-ссылка */}
            <Card className="space-y-2">
              <h3 className="text-body font-medium">Ссылка для Telegram</h3>
              <p className="text-aux text-tg-hint">Клиент нажмёт → откроется Mini-App с записью к вам</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`https://t.me/${profile?.bot_username || 'swift_sellbot'}?startapp=m_${slug}`}
                  className="input-field text-aux flex-1"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://t.me/${profile?.bot_username || 'swift_sellbot'}?startapp=m_${slug}`);
                    toast.success('Ссылка скопирована');
                  }}
                >
                  📋
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
