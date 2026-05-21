/**
 * Страница тикета поддержки — просмотр переписки + ответ + оценка.
 * Открывается по deep link: ?startParam=ticket_{id}
 * или через навигацию из списка тикетов.
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supportApi } from '@/api/endpoints';
import { HeaderBackButton } from '@/components/common/BackButton';
import PageHeader from '@/shared/ui/PageHeader';
import Button from '@/shared/ui/Button';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/Toast';
import { Send, Star } from 'lucide-react';

interface TicketMessage {
  id: number;
  sender_type: string;
  sender_id?: number;
  text: string;
  attachment_url?: string;
  created_at: string;
}

export default function TicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [searchParams] = useSearchParams();
  const showRate = searchParams.get('rate') === '1';
  const [replyText, setReplyText] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery<TicketMessage[]>({
    queryKey: ['ticket-messages', ticketId],
    queryFn: () => supportApi.messages(Number(ticketId)).then((r) => r.data),
    enabled: !!ticketId,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const replyMutation = useMutation({
    mutationFn: (text: string) => supportApi.reply(Number(ticketId), text),
    onSuccess: () => {
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] });
      toast.success('Сообщение отправлено');
    },
    onError: () => toast.error('Не удалось отправить'),
  });

  const rateMutation = useMutation({
    mutationFn: (score: number) => supportApi.rate(Number(ticketId), score),
    onSuccess: () => {
      toast.success('Спасибо за оценку!');
      setRating(null);
    },
    onError: () => toast.error('Не удалось отправить оценку'),
  });

  if (isLoading) {
    return (
      <div className="px-screen-x py-section-y">
        <PageHeader title="Тикет" left={<HeaderBackButton />} />
        <ListSkeleton count={5} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh]">
      <div className="shrink-0">
        <PageHeader
          title={`Тикет #${ticketId}`}
          left={<HeaderBackButton />}
        />
      </div>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto px-screen-x py-3 space-y-3">
        {(!messages || messages.length === 0) && (
          <p className="text-center text-tg-hint text-sm py-8">
            Сообщений пока нет
          </p>
        )}
        {messages?.map((msg) => {
          const isStaff = msg.sender_type === 'moderator' || msg.sender_type === 'admin' || msg.sender_type === 'superadmin';
          const isSystem = msg.sender_type === 'system';

          return (
            <div
              key={msg.id}
              className={`max-w-[85%] ${
                isStaff ? 'ml-auto' : isSystem ? 'mx-auto' : 'mr-auto'
              }`}
            >
              <div
                className={`rounded-2xl p-3 ${
                  isStaff
                    ? 'bg-tg-button text-tg-button-text rounded-br-md'
                    : isSystem
                    ? 'bg-tg-secondary text-tg-hint text-xs italic text-center'
                    : 'bg-tg-secondary text-tg-text rounded-bl-md'
                }`}
              >
                {!isSystem && (
                  <p className="text-[10px] opacity-60 mb-1">
                    {isStaff ? 'Поддержка' : 'Вы'}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
              </div>
              {!isSystem && (
                <p className={`text-[10px] text-tg-hint mt-1 ${isStaff ? 'text-right' : ''}`}>
                  {new Date(msg.created_at).toLocaleString('ru', {
                    day: '2-digit', month: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Оценка (если пришли по deep link rate) */}
      {showRate && (
        <div className="shrink-0 px-screen-x py-3 border-t border-tg-section-separator bg-tg-bg">
          <p className="text-sm text-center mb-2">Оцените качество поддержки</p>
          <div className="flex justify-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setRating(s)}
                className="p-1"
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    rating && s <= rating
                      ? 'text-status-warning fill-status-warning'
                      : 'text-tg-hint'
                  }`}
                />
              </button>
            ))}
          </div>
          {rating && (
            <Button
              variant="primary"
              fullWidth
              size="sm"
              onClick={() => rateMutation.mutate(rating)}
              loading={rateMutation.isPending}
            >
              Отправить оценку ({rating}/5)
            </Button>
          )}
        </div>
      )}

      {/* Поле ответа */}
      <div className="shrink-0 px-screen-x py-3 border-t border-tg-section-separator bg-tg-bg safe-area-bottom">
        <div className="flex gap-2">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Написать..."
            className="input-field flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && replyText.trim()) {
                replyMutation.mutate(replyText.trim());
              }
            }}
          />
          <Button
            onClick={() => replyMutation.mutate(replyText.trim())}
            disabled={!replyText.trim()}
            loading={replyMutation.isPending}
            size="sm"
            className="shrink-0 !w-12 !px-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
