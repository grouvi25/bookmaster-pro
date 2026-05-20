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
import { mastersApi, uploadsApi } from '@/api/endpoints';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import { FormSkeleton } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/Toast';
import {
  type ThemeConfig,
  DEFAULT_THEME,
  THEME_PRESETS,
  themeToStyle,
  fontFamily,
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

  const previewStyle = themeToStyle(config);

  const SECTIONS = [
    { key: 'theme', label: 'Тема', icon: <Palette className="w-4 h-4" /> },
    { key: 'header', label: 'Шапка', icon: <Image className="w-4 h-4" /> },
    { key: 'button', label: 'Кнопка', icon: <Type className="w-4 h-4" /> },
    { key: 'cards', label: 'Карточки', icon: <Palette className="w-4 h-4" /> },
    { key: 'content', label: 'Контент', icon: <ToggleLeft className="w-4 h-4" /> },
    { key: 'links', label: 'Ссылки', icon: <Link2 className="w-4 h-4" /> },
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
      <div className={`relative shrink-0 overflow-hidden transition-all duration-300 ${previewExpanded ? 'flex-1' : 'h-[35vh]'}`}>
        <div
          className="w-full h-full overflow-y-auto origin-top"
          style={{ ...previewStyle, backgroundColor: 'var(--lp-bg)', fontFamily: fontFamily(config.font_style) }}
        >
          {/* Mini preview of the page */}
          <LivePreview
            config={config}
            coverUrl={coverUrl}
            profile={profile}
            links={links}
            showServices={showServices}
          />
        </div>
        {/* Toggle expand */}
        <button
          onClick={() => setPreviewExpanded(!previewExpanded)}
          className="absolute bottom-2 right-2 bg-black/50 text-white rounded-full p-1.5 backdrop-blur"
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
      </div>
    </div>
  );
}

/** Live preview — мини-версия страницы по текущему config. */
function LivePreview({ config, coverUrl, profile, links, showServices }: {
  config: ThemeConfig;
  coverUrl: string | null;
  profile: Record<string, unknown> | undefined;
  links: { url: string; label?: string }[];
  showServices: boolean;
}) {
  return (
    <>
      {/* Header */}
      <div className="relative pt-8 pb-10 px-4 text-center" style={{ backgroundColor: config.header_style === 'image' && coverUrl ? undefined : config.header_bg }}>
        {config.header_style === 'image' && coverUrl && (
          <>
            <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40" />
          </>
        )}
        <div className="relative z-10">
          <div className="w-20 h-20 mx-auto mb-3 overflow-hidden ring-3 ring-white/30" style={{ borderRadius: `${config.card_radius + 6}px` }}>
            {(profile as Record<string, string>)?.avatar_url ? (
              <img src={(profile as Record<string, string>).avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/20 flex items-center justify-center text-white/60 text-2xl">👤</div>
            )}
          </div>
          <h2 className="text-lg font-bold text-white">{(profile as Record<string, string>)?.display_name || 'Имя мастера'}</h2>
          <p className="text-white/70 text-xs mt-0.5">{(profile as Record<string, string>)?.specialization || 'Специализация'}</p>
        </div>
      </div>

      {/* Content preview */}
      <div className="px-3 -mt-4 relative z-10">
        {/* CTA */}
        <div className="w-full py-3 text-center font-bold text-sm mb-3" style={{ backgroundColor: config.button_bg, color: config.button_text, borderRadius: `${config.button_radius}px` }}>
          ✨ Записаться
        </div>

        {/* Links preview */}
        {links.slice(0, 2).map((link, i) => (
          <div key={i} className="flex items-center gap-2 p-2.5 mb-2" style={{ backgroundColor: config.card_bg, borderRadius: `${config.card_radius}px`, boxShadow: config.card_shadow ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            <ExternalLink className="w-3.5 h-3.5" style={{ color: config.button_bg }} />
            <span className="text-xs font-medium truncate" style={{ color: config.text_color }}>{link.label || link.url}</span>
          </div>
        ))}

        {/* Services placeholder */}
        {showServices && (
          <div className="mb-2" style={{ backgroundColor: config.card_bg, borderRadius: `${config.card_radius}px`, boxShadow: config.card_shadow ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {['Маникюр', 'Педикюр', 'Наращивание'].map((s) => (
              <div key={s} className="flex justify-between px-3 py-2 border-b last:border-b-0" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                <span className="text-xs" style={{ color: config.text_color }}>{s}</span>
                <span className="text-xs font-bold" style={{ color: config.button_bg }}>1 500 ₽</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
