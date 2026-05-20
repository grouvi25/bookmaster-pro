/**
 * Редактор TapLink-страницы мастера.
 *
 * Секции:
 * 1. Выбор темы (6 пресетов)
 * 2. Шапка (cover image или цвет)
 * 3. Кнопка CTA (цвет + radius)
 * 4. Карточки (цвет + radius + shadow)
 * 5. Контент (toggles: услуги/отзывы/портфолио/цены)
 * 6. Ссылки (CRUD)
 * 7. Аватар (загрузка)
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeaderBackButton } from '@/components/common/BackButton';
import { mastersApi, uploadsApi } from '@/api/endpoints';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import PageHeader from '@/shared/ui/PageHeader';
import { FormSkeleton } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/Toast';
import {
  type ThemeConfig,
  DEFAULT_THEME,
  THEME_PRESETS,
} from '@/shared/lib/linkPageThemes';
import {
  Palette, Image, Type, ToggleLeft, Link2, Plus, Trash2,
  ExternalLink, Eye, Save, Upload,
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

  // Initialize from server data
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

  const updateConfig = (patch: Partial<ThemeConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const selectPreset = (key: string) => {
    const preset = THEME_PRESETS.find((p) => p.key === key);
    if (preset) {
      setSelectedPreset(key);
      setConfig(preset.config);
    }
  };

  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    setLinks([...links, { url: newLinkUrl.trim(), label: newLinkLabel.trim() || undefined }]);
    setNewLinkUrl('');
    setNewLinkLabel('');
  };

  const removeLink = (idx: number) => {
    setLinks(links.filter((_, i) => i !== idx));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const resp = await uploadsApi.uploadFile(file, 'avatars');
      const url = resp.data?.url || resp.data?.public_url;
      if (url) {
        await mastersApi.updateProfile({ avatar_url: url });
        queryClient.invalidateQueries({ queryKey: ['master-profile'] });
        toast.success('Аватар обновлён');
      }
    } catch {
      toast.error('Ошибка загрузки');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const resp = await uploadsApi.uploadFile(file, 'covers');
      const url = resp.data?.url || resp.data?.public_url;
      if (url) {
        setCoverUrl(url);
        updateConfig({ header_style: 'image' });
        toast.success('Обложка загружена');
      }
    } catch {
      toast.error('Ошибка загрузки');
    } finally {
      setCoverUploading(false);
    }
  };

  if (isLoading) return <div className="px-screen-x py-section-y"><FormSkeleton rows={6} /></div>;

  const slug = profile?.slug;
  const previewUrl = slug ? `/p/${slug}` : null;

  return (
    <div className="px-screen-x">
      <PageHeader
        title="Моя страница"
        left={<HeaderBackButton to="/master/settings" />}
        right={
          previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-tg-link"
            >
              <Eye className="w-5 h-5" />
            </a>
          ) : null
        }
      />

      <div className="space-y-5 pb-32">
        {/* ── 1. Темы-пресеты ──────────────────── */}
        <section>
          <SectionTitle icon={<Palette className="w-4 h-4" />} title="Тема" />
          <div className="grid grid-cols-3 gap-2">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => selectPreset(preset.key)}
                className={`p-3 rounded-card text-center transition-all ${
                  selectedPreset === preset.key
                    ? 'ring-2 ring-tg-button scale-[1.02]'
                    : 'bg-tg-secondary'
                }`}
                style={
                  selectedPreset === preset.key
                    ? { backgroundColor: preset.config.bg_color }
                    : undefined
                }
              >
                <div className="text-xl mb-1">{preset.emoji}</div>
                <div className="text-aux font-medium">{preset.name}</div>
              </button>
            ))}
          </div>
        </section>

        {/* ── 2. Аватар ────────────────────────── */}
        <section>
          <SectionTitle icon={<Upload className="w-4 h-4" />} title="Аватар" />
          <Card>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-tg-secondary overflow-hidden shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-tg-hint">
                    <Upload className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-body font-medium">Фото профиля</p>
                <p className="text-aux text-tg-hint">Отображается на странице и в каталоге</p>
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <Button size="sm" loading={avatarUploading} onClick={() => {}}>
                  Загрузить
                </Button>
              </label>
            </div>
          </Card>
        </section>

        {/* ── 3. Шапка / Cover ─────────────────── */}
        <section>
          <SectionTitle icon={<Image className="w-4 h-4" />} title="Шапка" />
          <Card className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => updateConfig({ header_style: 'solid' })}
                className={`flex-1 py-2 rounded-btn text-sm font-medium ${
                  config.header_style === 'solid' ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary text-tg-text'
                }`}
              >
                Цвет
              </button>
              <button
                onClick={() => updateConfig({ header_style: 'image' })}
                className={`flex-1 py-2 rounded-btn text-sm font-medium ${
                  config.header_style === 'image' ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary text-tg-text'
                }`}
              >
                Изображение
              </button>
            </div>

            {config.header_style === 'solid' && (
              <div>
                <label className="text-aux text-tg-hint mb-1 block">Цвет шапки</label>
                <input
                  type="color"
                  value={config.header_bg}
                  onChange={(e) => updateConfig({ header_bg: e.target.value })}
                  className="w-full h-12 rounded-btn cursor-pointer border-none"
                />
              </div>
            )}

            {config.header_style === 'image' && (
              <div>
                {coverUrl && (
                  <img src={coverUrl} alt="" className="w-full h-24 object-cover rounded-xl mb-2" />
                )}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                  <Button variant="secondary" fullWidth size="sm" loading={coverUploading} onClick={() => {}}>
                    <Image className="w-4 h-4" /> {coverUrl ? 'Заменить обложку' : 'Загрузить обложку'}
                  </Button>
                </label>
              </div>
            )}
          </Card>
        </section>

        {/* ── 4. Кнопка CTA ────────────────────── */}
        <section>
          <SectionTitle icon={<Type className="w-4 h-4" />} title="Кнопка «Записаться»" />
          <Card className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-aux text-tg-hint mb-1 block">Цвет фона</label>
                <input
                  type="color"
                  value={config.button_bg}
                  onChange={(e) => updateConfig({ button_bg: e.target.value })}
                  className="w-full h-10 rounded-btn cursor-pointer border-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-aux text-tg-hint mb-1 block">Цвет текста</label>
                <input
                  type="color"
                  value={config.button_text}
                  onChange={(e) => updateConfig({ button_text: e.target.value })}
                  className="w-full h-10 rounded-btn cursor-pointer border-none"
                />
              </div>
            </div>
            <div>
              <label className="text-aux text-tg-hint mb-1 block">
                Скругление: {config.button_radius}px
              </label>
              <input
                type="range"
                min={0}
                max={32}
                value={config.button_radius}
                onChange={(e) => updateConfig({ button_radius: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            {/* Preview */}
            <div
              className="w-full py-3 text-center font-bold text-sm"
              style={{
                backgroundColor: config.button_bg,
                color: config.button_text,
                borderRadius: `${config.button_radius}px`,
              }}
            >
              ✨ Записаться
            </div>
          </Card>
        </section>

        {/* ── 5. Карточки ──────────────────────── */}
        <section>
          <SectionTitle icon={<Palette className="w-4 h-4" />} title="Карточки" />
          <Card className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-aux text-tg-hint mb-1 block">Фон карточек</label>
                <input
                  type="color"
                  value={config.card_bg}
                  onChange={(e) => updateConfig({ card_bg: e.target.value })}
                  className="w-full h-10 rounded-btn cursor-pointer border-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-aux text-tg-hint mb-1 block">Фон страницы</label>
                <input
                  type="color"
                  value={config.bg_color}
                  onChange={(e) => updateConfig({ bg_color: e.target.value })}
                  className="w-full h-10 rounded-btn cursor-pointer border-none"
                />
              </div>
            </div>
            <div>
              <label className="text-aux text-tg-hint mb-1 block">
                Скругление: {config.card_radius}px
              </label>
              <input
                type="range"
                min={0}
                max={28}
                value={config.card_radius}
                onChange={(e) => updateConfig({ card_radius: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <label className="flex items-center gap-2 text-body cursor-pointer">
              <input
                type="checkbox"
                checked={config.card_shadow}
                onChange={(e) => updateConfig({ card_shadow: e.target.checked })}
              />
              Тень на карточках
            </label>
          </Card>
        </section>

        {/* ── 6. Контент ───────────────────────── */}
        <section>
          <SectionTitle icon={<ToggleLeft className="w-4 h-4" />} title="Отображение" />
          <Card className="space-y-2">
            {[
              { label: 'Показывать услуги', value: showServices, set: setShowServices },
              { label: 'Показывать цены', value: showPrices, set: setShowPrices },
              { label: 'Показывать отзывы', value: showReviews, set: setShowReviews },
              { label: 'Показывать портфолио', value: showPortfolio, set: setShowPortfolio },
            ].map((toggle) => (
              <label key={toggle.label} className="flex items-center justify-between py-1.5 cursor-pointer">
                <span className="text-body">{toggle.label}</span>
                <input
                  type="checkbox"
                  checked={toggle.value}
                  onChange={(e) => toggle.set(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
              </label>
            ))}
          </Card>
        </section>

        {/* ── 7. Ссылки ────────────────────────── */}
        <section>
          <SectionTitle icon={<Link2 className="w-4 h-4" />} title="Ссылки" />
          {links.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {links.map((link, i) => (
                <Card key={i} className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-tg-hint shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-body font-medium truncate">{link.label || link.url}</div>
                    <div className="text-aux text-tg-hint truncate">{link.url}</div>
                  </div>
                  <button onClick={() => removeLink(i)} className="p-1 text-status-danger">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Card>
              ))}
            </div>
          )}
          <Card className="space-y-2">
            <input
              type="url"
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              placeholder="https://instagram.com/..."
              className="input-field"
            />
            <input
              type="text"
              value={newLinkLabel}
              onChange={(e) => setNewLinkLabel(e.target.value)}
              placeholder="Название ссылки (необязательно)"
              className="input-field"
            />
            <Button variant="secondary" size="sm" fullWidth onClick={addLink} disabled={!newLinkUrl.trim()}>
              <Plus className="w-4 h-4" /> Добавить ссылку
            </Button>
          </Card>
        </section>
      </div>

      {/* Save button — sticky */}
      <div className="fixed bottom-[var(--tabbar-height,80px)] left-0 right-0 px-screen-x pb-3 pt-2 bg-tg-bg border-t border-tg-secondary z-40">
        <Button
          onClick={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
          fullWidth
          size="lg"
        >
          <Save className="w-4 h-4" /> Сохранить страницу
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-tg-hint">{icon}</span>
      <h3 className="text-h3">{title}</h3>
    </div>
  );
}
