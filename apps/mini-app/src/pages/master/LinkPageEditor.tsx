import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { HeaderBackButton } from "@/components/common/BackButton";
import { mastersApi, servicesApi, portfolioApi, uploadsApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { PageSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import PageHeader from '@/shared/ui/PageHeader';
import { toast } from '@/shared/ui/Toast';
import {
  Link2, Eye, Copy, Plus, Trash2,
  User, Image, QrCode, Download,
} from 'lucide-react';
import type { Service, PortfolioItem } from '@/shared/types/api';
import { pageUrl } from '@/shared/config';

interface SocialLink {
  url: string;
  label: string;
}

export default function LinkPageEditor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: master, isLoading } = useQuery({
    queryKey: ['master-profile'],
    queryFn: () => mastersApi.getProfile().then((r) => r.data),
  });

  const { data: services } = useQuery({
    queryKey: ['my-services'],
    queryFn: () => servicesApi.list().then((r) => r.data),
  });

  const { data: portfolio } = useQuery({
    queryKey: ['my-portfolio', master?.id],
    queryFn: () => portfolioApi.list(master.id).then((r) => r.data),
    enabled: !!master?.id,
  });

  const [bio, setBio] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (master) {
      setBio(master.description || '');
      const allLinks = master.link_page_links || [];
      setSocialLinks(allLinks.filter((l: Record<string, unknown>) => !l._type));
    }
  }, [master]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const existingPackages = (master?.link_page_links || []).filter(
        (l: Record<string, unknown>) => l._type === 'subscription_package'
      );
      const normalizedLinks = socialLinks
        .filter((l) => l.url.trim())
        .map((l) => ({
          ...l,
          url: /^https?:\/\//i.test(l.url.trim()) ? l.url.trim() : `https://${l.url.trim()}`,
        }));
      await mastersApi.updateProfile({
        description: bio,
        link_page_links: [
          ...normalizedLinks,
          ...existingPackages,
        ],
      });
      queryClient.invalidateQueries({ queryKey: ['master-profile'] });
      toast.success('Страница обновлена');
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const addLink = () => {
    setSocialLinks([...socialLinks, { url: '', label: '' }]);
  };

  const removeLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  };

  const updateLink = (index: number, field: keyof SocialLink, value: string) => {
    const updated = [...socialLinks];
    updated[index] = { ...updated[index], [field]: value };
    setSocialLinks(updated);
  };

  const copyLink = () => {
    if (master?.slug) {
      navigator.clipboard.writeText(pageUrl(master.slug));
      toast.success('Ссылка скопирована');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploadResp = await uploadsApi.uploadFile(file, 'portfolio');
        const { file_key } = uploadResp.data;
        await portfolioApi.upload({ s3_key: file_key });
      }
      queryClient.invalidateQueries({ queryKey: ['my-portfolio'] });
      toast.success('Фото добавлены');
    } catch {
      toast.error('Ошибка загрузки фото');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handlePhotoDelete = async (photoId: number) => {
    try {
      await portfolioApi.delete(photoId);
      queryClient.invalidateQueries({ queryKey: ['my-portfolio'] });
      toast.success('Фото удалено');
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  if (isLoading) return <PageSkeleton />;
  if (!master) return <div className="px-screen-x py-section-y text-center text-tg-hint">Профиль не найден</div>;

  const servicesList: Service[] = toArray<Service>(services);
  const portfolioItems: PortfolioItem[] = toArray<PortfolioItem>(portfolio);
  const previewPath = `/p/${master.slug}`;

  return (
    <div >
      <PageHeader
        title="Моя страница-визитка"
        left={<HeaderBackButton to="/master/settings" />}
      />

      <div className="px-screen-x">
      <p className="text-tg-hint text-sm mb-5">TapLink-аналог для ваших клиентов</p>

      {/* Preview & share */}
      <Card className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center">
            <Link2 className="w-5 h-5 text-brand-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{pageUrl(master.slug)}</div>
            <div className="text-xs text-tg-hint">Ваша публичная страница</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={copyLink} className="flex-1">
            <Copy className="w-3.5 h-3.5" /> Копировать
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`${previewPath}?preview=1`)}
            className="flex-1"
          >
            <Eye className="w-3.5 h-3.5" /> Предпросмотр
          </Button>
        </div>
      </Card>

      {/* QR Code */}
      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <QrCode className="w-5 h-5 text-brand-500" />
          <span className="font-medium text-sm">QR-код для клиентов</span>
        </div>
        <div className="flex flex-col items-center">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pageUrl(master.slug))}`}
            alt="QR код"
            className="w-40 h-40 rounded-xl mb-3"
          />
          <p className="text-xs text-tg-hint text-center mb-3">
            Распечатайте и разместите в кабинете — клиенты смогут записаться, отсканировав код
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const link = document.createElement('a');
              link.href = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(pageUrl(master.slug))}` ;
              link.download = `qr-${master.slug}.png`;
              link.click();
            }}
          >
            <Download className="w-3.5 h-3.5" /> Скачать QR
          </Button>
        </div>
      </Card>

      {/* Profile preview */}
      <Card className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-card bg-tg-secondary flex items-center justify-center overflow-hidden">
            {master.avatar_url ? (
              <img src={master.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-tg-hint" />
            )}
          </div>
          <div>
            <div className="font-bold">{master.display_name}</div>
            <div className="text-xs text-tg-hint">{master.specialization} · {master.city}</div>
          </div>
        </div>
      </Card>

      {/* Bio */}
      <div className="mb-4">
        <label className="text-sm font-medium mb-1.5 block">О себе</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Расскажите о себе, опыте, подходе к работе..."
          rows={4}
                  className="input-field !h-auto resize-none"
                />
      </div>

      {/* Social links */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Социальные сети</label>
          <button onClick={addLink} className="flex items-center gap-1 text-tg-link text-sm">
            <Plus className="w-4 h-4" /> Добавить
          </button>
        </div>
        {socialLinks.length === 0 ? (
          <div className="text-sm text-tg-hint bg-tg-secondary rounded-xl p-3 text-center">
            Нет добавленных ссылок
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {socialLinks.map((link, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 flex flex-col gap-1.5">
                  <input
                    value={link.label}
                    onChange={(e) => updateLink(i, 'label', e.target.value)}
                    placeholder="Название (Instagram, Telegram...)"
                                      className="input-field"
                                    />
                                    <input
                                      value={link.url}
                                      onChange={(e) => updateLink(i, 'url', e.target.value)}
                                      placeholder="https://..."
                                      className="input-field"
                  />
                </div>
                <button
                  onClick={() => removeLink(i)}
                  className="p-2 text-status-danger hover:text-status-danger"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Services preview */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Услуги на странице</label>
          <span className="text-xs text-tg-hint">{servicesList.length} услуг</span>
        </div>
        <div className="bg-tg-secondary rounded-xl p-3 text-sm text-tg-hint">
          {servicesList.length > 0
            ? `Отображаются: ${servicesList.slice(0, 3).map((s) => s.name).join(', ')}${servicesList.length > 3 ? ` и ещё ${servicesList.length - 3}` : ''}`
            : 'Добавьте услуги в разделе «Мои услуги»'}
        </div>
      </div>

      {/* Portfolio */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Портфолио</label>
          <label className="flex items-center gap-1 text-tg-link text-sm cursor-pointer">
            <Plus className="w-4 h-4" /> {uploading ? 'Загрузка...' : 'Добавить'}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploading}
            />
          </label>
        </div>
        {portfolioItems.length > 0 ? (
          <div className="grid grid-cols-4 gap-1 rounded-xl overflow-hidden">
            {portfolioItems.map((item) => (
              <div key={item.id} className="relative group">
                <img
                  src={item.image_url}
                  alt=""
                  className="w-full aspect-square object-cover"
                />
                <button
                  onClick={() => handlePhotoDelete(item.id)}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-tg-secondary rounded-xl p-3 text-sm text-tg-hint flex items-center gap-2">
            <Image className="w-4 h-4" />
            Добавьте фото работ для привлечения клиентов
          </div>
        )}
      </div>

      <Button onClick={handleSave} loading={saving} fullWidth size="lg">
        Сохранить изменения
      </Button>
      </div>
    </div>
  );
}
