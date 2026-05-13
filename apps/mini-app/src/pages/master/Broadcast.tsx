import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { broadcastApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import { Send, Plus, Users } from 'lucide-react';

export default function Broadcast() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: () => broadcastApi.list().then((r) => r.data),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => broadcastApi.send(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['broadcasts'] }),
  });

  if (isLoading) return <Loading />;

  const broadcasts = (data || []) as Array<{
    id: number;
    title: string;
    text: string;
    status: string;
    total_recipients: number;
    delivered_count: number;
    sent_at: string | null;
  }>;

  return (
    <div className="p-5 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Рассылки</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 bg-brand-500 text-white px-3.5 py-2 rounded-xl text-sm font-semibold shadow-button active:scale-[0.97] transition-all"
        >
          <Plus className="w-4 h-4" />
          Новая
        </button>
      </div>

      {showCreate && <CreateBroadcast onClose={() => setShowCreate(false)} />}

      <div className="flex flex-col gap-3">
        {broadcasts.length === 0 ? (
          <p className="text-tg-hint text-center py-8">Нет рассылок</p>
        ) : (
          broadcasts.map((b) => (
            <div key={b.id} className="bg-surface-elevated shadow-card rounded-2xl p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-medium text-sm">{b.title}</h3>
                  <p className="text-xs text-tg-hint mt-0.5 line-clamp-2">{b.text}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-lg flex-shrink-0 ml-2 ${
                  b.status === 'sent' ? 'bg-green-500/15 text-green-600' :
                  b.status === 'sending' ? 'bg-yellow-500/15 text-yellow-600' :
                  'bg-tg-secondary text-tg-hint'
                }`}>
                  {b.status === 'sent' ? 'Отправлено' :
                   b.status === 'sending' ? 'Отправляется' :
                   b.status === 'draft' ? 'Черновик' : b.status}
                </span>
              </div>

              {b.status === 'sent' && (
                <div className="text-xs text-tg-hint">
                  <Users className="w-3 h-3 inline mr-1" />
                  {b.delivered_count}/{b.total_recipients} доставлено
                </div>
              )}

              {(b.status === 'draft' || b.status === 'scheduled') && (
                <button
                  onClick={() => sendMutation.mutate(b.id)}
                  disabled={sendMutation.isPending}
                  className="mt-2 flex items-center gap-1.5 text-xs text-tg-link font-medium"
                >
                  <Send className="w-3 h-3" />
                  Отправить сейчас
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CreateBroadcast({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [tags, setTags] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      broadcastApi.create({
        title,
        text,
        segment_filter: tags ? { tags: tags.split(',').map((t) => t.trim()) } : {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      onClose();
    },
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      broadcastApi.previewSegment({
        title: 'preview',
        text: 'preview',
        segment_filter: tags ? { tags: tags.split(',').map((t) => t.trim()) } : {},
      }),
  });

  return (
    <div className="bg-surface-elevated shadow-card-lg rounded-2xl p-4 mb-5">
      <h3 className="text-sm font-semibold mb-3">Новая рассылка</h3>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Заголовок"
        className="input-field mb-2"
      />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Текст рассылки"
        rows={3}
        className="input-field mb-2 resize-none"
      />

      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="Фильтр по тегам (через запятую)"
        className="input-field mb-3"
      />

      <div className="flex gap-2">
        <button
          onClick={() => previewMutation.mutate()}
          className="text-xs text-tg-link font-medium"
        >
          {previewMutation.isPending ? '...' :
           previewMutation.data ? `${(previewMutation.data.data as {count: number}).count} получателей` :
           'Предпросмотр'}
        </button>
        <div className="flex-1" />
        <button onClick={onClose} className="text-xs text-tg-hint">
          Отмена
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!title || !text || createMutation.isPending}
          className="bg-tg-button text-tg-button-text px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
        >
          Создать
        </button>
      </div>
    </div>
  );
}
