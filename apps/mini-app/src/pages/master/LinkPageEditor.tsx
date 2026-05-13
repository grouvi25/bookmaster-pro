import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { mastersApi, servicesApi, portfolioApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import Loading from '@/components/common/Loading';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import SectionBack from '@/shared/ui/SectionBack';
import { toast } from '@/shared/ui/Toast';
import {
  Link2, Eye, Copy, Plus, Trash2,
  User, Image,
} from 'lucide-react';
import type { Service, PortfolioItem } from '@/shared/types/api';

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

  useEffect(() => {
    if (master) {
      setBio(master.description || '');
      setSocialLinks(master.link_page_links || []);
    }
  }, [master]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await mastersApi.updateProfile({
        description: bio,
        link_page_links: socialLinks.filter((l) => l.url.trim()),
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
      const url = `https://t.me/BookMasterProBot?start=m_${master.slug}`;
      navigator.clipboard.writeText(url);
      toast.success('Ссылка скопирована');
    }
  };

  if (isLoading) return <Loading />;
  if (!master) return <div className="p-5 text-center text-tg-hint">Профиль не найден</div>;

  const servicesList: Service[] = toArray<Service>(services);
  const portfolioItems: PortfolioItem[] = toArray<PortfolioItem>(portfolio?.items);
  const pageUrl = `/p/${master.slug}`;

  return (
    <div className="p-5 pb-24 animate-fade-in">
      <SectionBack onBack={() => navigate(-1)} />

      <h1 className="text-2xl font-bold tracking-tight mb-1">Моя страница-визитка</h1>
      <p className="text-tg-hint text-sm mb-5">TapLink-аналог для ваших клиентов</p>

      {/* Preview & share */}
      <Card className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center">
            <Link2 className="w-5 h-5 text-brand-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">t.me/BookMasterProBot?start=m_{master.slug}</div>
            <div className="text-xs text-tg-hint">Ваша ссылка для клиентов</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={copyLink} className="flex-1">
            <Copy className="w-3.5 h-3.5" /> Копировать
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(pageUrl)}
            className="flex-1"
          >
            <Eye className="w-3.5 h-3.5" /> Предпросмотр
          </Button>
        </div>
      </Card>

      {/* Profile preview */}
      <Card className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-tg-secondary flex items-center justify-center overflow-hidden">
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
          className="w-full p-3 rounded-xl text-sm outline-none bg-tg-secondary resize-none"
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
                    className="w-full p-2.5 rounded-xl text-sm outline-none bg-tg-secondary"
                  />
                  <input
                    value={link.url}
                    onChange={(e) => updateLink(i, 'url', e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2.5 rounded-xl text-sm outline-none bg-tg-secondary"
                  />
                </div>
                <button
                  onClick={() => removeLink(i)}
                  className="p-2 text-red-400 hover:text-red-500"
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

      {/* Portfolio preview */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Портфолио</label>
          <span className="text-xs text-tg-hint">{portfolioItems.length} фото</span>
        </div>
        {portfolioItems.length > 0 ? (
          <div className="grid grid-cols-4 gap-1 rounded-xl overflow-hidden">
            {portfolioItems.slice(0, 8).map((item) => (
              <img
                key={item.id}
                src={item.image_url}
                alt=""
                className="w-full aspect-square object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="bg-tg-secondary rounded-xl p-3 text-sm text-tg-hint flex items-center gap-2">
            <Image className="w-4 h-4" />
            Добавьте фото в портфолио
          </div>
        )}
      </div>

      <Button onClick={handleSave} loading={saving} fullWidth size="lg">
        Сохранить изменения
      </Button>
    </div>
  );
}
