import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { clientsApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';
import BackButton from '@/components/common/BackButton';
import {
  User,
  Phone,
  Cake,
  Star,
  Clock,
  Tag,
  FileText,
  Gift,
  Plus,
} from 'lucide-react';

interface VisitItem {
  id: number;
  date: string;
  service_name: string;
  status: string;
  price: number | null;
}

interface NoteItem {
  id: number;
  text: string;
  created_at: string;
}

interface ClientDetailData {
  client_id: number;
  display_name: string;
  phone: string | null;
  birthday: string | null;
  avatar_url: string | null;
  tags: string[];
  master_notes: string | null;
  first_visit_date: string | null;
  last_visit_date: string | null;
  visit_count: number;
  total_spent: number;
  no_show_count: number;
  source: string | null;
  visits: VisitItem[];
  notes: NoteItem[];
  loyalty_balance: number;
  loyalty_tier: string;
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Завершён',
  confirmed: 'Подтверждён',
  pending: 'Ожидание',
  cancelled: 'Отменён',
  no_show: 'Неявка',
};

const TIER_LABELS: Record<string, string> = {
  new: 'Новый',
  regular: 'Постоянный',
  vip: 'VIP',
};

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useQuery<ClientDetailData>({
    queryKey: ['client-detail', clientId],
    queryFn: () =>
      clientsApi.get(Number(clientId)).then((r) => r.data),
    enabled: !!clientId,
  });

  const [activeTab, setActiveTab] = useState<'visits' | 'notes' | 'info'>('visits');
  const [newTag, setNewTag] = useState('');
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (isLoading) return <Loading />;
  if (!client) {
    return (
      <div className="p-4 text-center">
        <p className="text-tg-hint">Клиент не найден</p>
      </div>
    );
  }

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    setSaving(true);
    try {
      const updatedTags = [...client.tags, newTag.trim()];
      await clientsApi.addTag(client.client_id, { tags: updatedTags });
      await queryClient.invalidateQueries({ queryKey: ['client-detail', clientId] });
      setNewTag('');
      toast.success('Тег добавлен');
    } catch {
      toast.error('Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      await clientsApi.addNote(client.client_id, { text: newNote.trim() });
      await queryClient.invalidateQueries({ queryKey: ['client-detail', clientId] });
      setNewNote('');
      toast.success('Заметка добавлена');
    } catch {
      toast.error('Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="px-screen-x pt-section-y pb-24 animate-fade-in">
      <BackButton to="/master/clients" label="Клиенты" />

      {/* Header card */}
      <Card className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-14 h-14 bg-brand-500/10 rounded-full flex items-center justify-center overflow-hidden">
            {client.avatar_url ? (
              <img src={client.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
            ) : (
              <User className="w-7 h-7 text-brand-400" strokeWidth={1.5} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg">{client.display_name}</div>
            <div className="text-sm text-tg-hint flex items-center gap-1">
              <Star className="w-3.5 h-3.5" />
              {TIER_LABELS[client.loyalty_tier] ?? client.loyalty_tier}
              {client.loyalty_balance > 0 && ` · ${client.loyalty_balance} баллов`}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-tg-secondary rounded-card p-2.5">
            <div className="font-bold text-lg">{client.visit_count}</div>
            <div className="text-2xs text-tg-hint">Визитов</div>
          </div>
          <div className="bg-tg-secondary rounded-card p-2.5">
            <div className="font-bold text-lg">
              {client.total_spent > 0
                ? `${(client.total_spent / 1000).toFixed(client.total_spent >= 10000 ? 0 : 1)}к`
                : '0'}
            </div>
            <div className="text-2xs text-tg-hint">Выручка, ₽</div>
          </div>
          <div className="bg-tg-secondary rounded-card p-2.5">
            <div className="font-bold text-lg">{client.no_show_count}</div>
            <div className="text-2xs text-tg-hint">Неявок</div>
          </div>
        </div>
      </Card>

      {/* Contact info */}
      <Card className="mb-4">
        {client.phone && (
          <div className="flex items-center gap-2 text-sm mb-2">
            <Phone className="w-4 h-4 text-tg-hint" />
            <a href={`tel:${client.phone}`} className="text-tg-link">{client.phone}</a>
          </div>
        )}
        {client.birthday && (
          <div className="flex items-center gap-2 text-sm mb-2">
            <Cake className="w-4 h-4 text-tg-hint" />
            <span>{formatDate(client.birthday)}</span>
          </div>
        )}
        {client.first_visit_date && (
          <div className="flex items-center gap-2 text-sm mb-2">
            <Clock className="w-4 h-4 text-tg-hint" />
            <span>Первый визит: {formatDate(client.first_visit_date)}</span>
          </div>
        )}
        {client.source && (
          <div className="flex items-center gap-2 text-sm">
            <Gift className="w-4 h-4 text-tg-hint" />
            <span>Источник: {client.source}</span>
          </div>
        )}
      </Card>

      {/* Tags */}
      <Card className="mb-4">
        <div className="flex items-center gap-1 mb-2">
          <Tag className="w-4 h-4 text-tg-hint" />
          <span className="text-sm font-medium">Теги</span>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {client.tags.map((tag) => (
            <span
              key={tag}
              className="bg-brand-500/10 text-brand-600 text-xs px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
          {client.tags.length === 0 && (
            <span className="text-xs text-tg-hint">Нет тегов</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Новый тег"
            className="flex-1 input-field !text-xs !p-2"
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
          />
          <Button size="sm" onClick={handleAddTag} loading={saving}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 mb-3">
        {(['visits', 'notes', 'info'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm rounded-xl font-medium ${
              activeTab === tab
                ? 'bg-brand-500 text-white'
                : 'bg-tg-secondary text-tg-hint'
            }`}
          >
            {tab === 'visits' ? 'Визиты' : tab === 'notes' ? 'Заметки' : 'Доп. инфо'}
          </button>
        ))}
      </div>

      {activeTab === 'visits' && (
        <div className="flex flex-col gap-2">
          {client.visits.length === 0 ? (
            <p className="text-center text-sm text-tg-hint py-4">Нет визитов</p>
          ) : (
            client.visits.map((v) => (
              <Card key={v.id} className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-sm">{v.service_name}</div>
                  <div className="text-xs text-tg-hint">{formatDate(v.date)}</div>
                </div>
                <div className="text-right">
                  {v.price !== null && (
                    <div className="text-sm font-bold">{v.price.toLocaleString('ru')} ₽</div>
                  )}
                  <div
                    className={`text-xs ${
                      v.status === 'completed'
                        ? 'text-green-500'
                        : v.status === 'cancelled' || v.status === 'no_show'
                        ? 'text-red-400'
                        : 'text-tg-hint'
                    }`}
                  >
                    {STATUS_LABELS[v.status] ?? v.status}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 mb-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Добавить заметку..."
              rows={2}
              className="flex-1 input-field resize-none"
            />
            <Button size="sm" onClick={handleAddNote} loading={saving}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {client.master_notes && (
            <Card>
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-tg-hint mt-0.5" />
                <p className="text-sm">{client.master_notes}</p>
              </div>
            </Card>
          )}
          {client.notes.map((n) => (
            <Card key={n.id}>
              <p className="text-sm mb-1">{n.text}</p>
              <span className="text-[10px] text-tg-hint">{formatDate(n.created_at)}</span>
            </Card>
          ))}
          {client.notes.length === 0 && !client.master_notes && (
            <p className="text-center text-sm text-tg-hint py-4">Нет заметок</p>
          )}
        </div>
      )}

      {activeTab === 'info' && (
        <Card>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-tg-hint">Лояльность</span>
              <span className="font-medium">{TIER_LABELS[client.loyalty_tier] ?? client.loyalty_tier}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-tg-hint">Баллы</span>
              <span className="font-medium">{client.loyalty_balance}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-tg-hint">Всего потрачено</span>
              <span>{client.total_spent.toLocaleString('ru')} ₽</span>
            </div>
            {client.last_visit_date && (
              <div className="flex justify-between">
                <span className="text-tg-hint">Последний визит</span>
                <span>{formatDate(client.last_visit_date)}</span>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
