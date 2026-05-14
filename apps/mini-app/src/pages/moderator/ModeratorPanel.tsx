import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { moderationApi, reviewsApi } from '@/api/endpoints';
import PageHeader from '@/shared/ui/PageHeader';
import ChipTabs from '@/shared/ui/ChipTabs';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import {
  MessageSquare, CheckCircle, AlertTriangle, UserCheck,
  Send, ChevronDown, ChevronUp, Star, EyeOff, Eye, ClipboardList,
} from 'lucide-react';
import { toast } from '@/shared/ui/Toast';

interface Ticket {
  id: number;
  ticket_code?: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  initiator_role: string;
  assigned_to?: number | null;
  created_at: string;
  updated_at?: string;
}

interface TicketMessage {
  id: number;
  text: string;
  sender_type: string;
  created_at: string;
}

interface Review {
  id: number;
  master_id: number;
  client_id: number;
  rating: number;
  text?: string;
  master_reply?: string;
  is_hidden: boolean;
  hide_reason?: string;
  created_at?: string;
}

const STATUS_TABS = [
  { key: 'open', label: 'Открытые' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'waiting_user', label: 'Ожидание' },
  { key: 'resolved', label: 'Решённые' },
];

export default function ModeratorPanel() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('open');
  const [expandedTicket, setExpandedTicket] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [showCloseForm, setShowCloseForm] = useState<number | null>(null);
  const [hideReason, setHideReason] = useState('');
  const [hidingReview, setHidingReview] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'tickets' | 'reviews' | 'verification'>('tickets');
  const [reviewMasterId, setReviewMasterId] = useState('');

  // ── Tickets ──────────────────────────────────────
  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ['moderation-queue', statusFilter],
    queryFn: async () => {
      const resp = await moderationApi.queue({ status: statusFilter });
      return resp.data;
    },
  });

  const { data: pendingMasters = [] } = useQuery({
    queryKey: ['pending-masters'],
    queryFn: async () => {
      const resp = await moderationApi.mastersList({ verified: 'false' });
      return resp.data?.items || resp.data || [];
    },
    enabled: activeTab === 'verification',
  });

  const { data: ticketMessages } = useQuery<TicketMessage[]>({
    queryKey: ['ticket-messages', expandedTicket],
    queryFn: async () => {
      if (!expandedTicket) return [];
      const resp = await moderationApi.messages(expandedTicket);
      return resp.data;
    },
    enabled: !!expandedTicket,
  });

  // ── Reviews (for moderation) ─────────────────────
  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ['moderation-reviews', reviewMasterId],
    queryFn: async () => {
      if (!reviewMasterId) return [];
      const resp = await reviewsApi.getByMaster(Number(reviewMasterId));
      return resp.data;
    },
    enabled: activeTab === 'reviews' && !!reviewMasterId,
  });

  // ── Mutations ────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: (id: number) => moderationApi.assign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
      toast.success('Тикет взят в работу');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => moderationApi.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
      toast.success('Тикет закрыт');
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      moderationApi.close(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
      setShowCloseForm(null);
      setCloseNote('');
      toast.success('Тикет закрыт с заметкой');
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, text }: { id: number; text: string }) =>
      moderationApi.reply(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-messages'] });
      setReplyText('');
      toast.success('Ответ отправлен');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (masterId: number) => moderationApi.masterVerify(masterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-masters'] });
      toast.success('Мастер верифицирован');
    },
  });

  const hideReviewMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      moderationApi.reviewHide(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-reviews'] });
      setHidingReview(null);
      setHideReason('');
      toast.success('Отзыв скрыт');
    },
  });

  const unhideReviewMutation = useMutation({
    mutationFn: (id: number) => moderationApi.reviewUnhide(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-reviews'] });
      toast.success('Отзыв восстановлен');
    },
  });

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      open: 'Открыт',
      in_progress: 'В работе',
      waiting_user: 'Ожидание',
      resolved: 'Решён',
      closed: 'Закрыт',
    };
    return map[s] || s;
  };

  const statusVariant = (s: string) => {
    if (s === 'resolved' || s === 'closed') return 'success' as const;
    if (s === 'in_progress') return 'info' as const;
    if (s === 'waiting_user') return 'neutral' as const;
    return 'warning' as const;
  };

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text pb-24 animate-fade-in">
      <PageHeader title="Модератор" />

      <div className="px-4 space-y-4">
        {/* Main tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'tickets' ? 'bg-brand-500 text-white' : 'bg-surface-elevated text-tg-hint'
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-1" />
            Тикеты
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'reviews' ? 'bg-brand-500 text-white' : 'bg-surface-elevated text-tg-hint'
            }`}
          >
            <Star className="w-4 h-4 inline mr-1" />
            Отзывы
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'verification' ? 'bg-brand-500 text-white' : 'bg-surface-elevated text-tg-hint'
            }`}
          >
            <UserCheck className="w-4 h-4 inline mr-1" />
            Верификация
          </button>
        </div>

        {/* ── Tickets tab ── */}
        {activeTab === 'tickets' && (
          <>
            <ChipTabs
              tabs={STATUS_TABS}
              active={statusFilter}
              onChange={setStatusFilter}
            />

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-surface-elevated rounded-xl p-4 animate-pulse h-20" />
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <EmptyState
                icon={<CheckCircle className="w-10 h-10" />}
                title="Нет тикетов"
                description="Все тикеты обработаны"
              />
            ) : (
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="bg-surface-elevated rounded-xl shadow-card overflow-hidden">
                    <button
                      onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                      className="w-full p-4 flex items-start gap-3 text-left"
                    >
                      <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
                        ticket.priority === 'high' ? 'text-red-500' : 'text-yellow-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">{ticket.subject || `#${ticket.id}`}</p>
                          <StatusBadge
                            label={statusLabel(ticket.status)}
                            variant={statusVariant(ticket.status)}
                          />
                        </div>
                        <p className="text-xs text-tg-hint">
                          {ticket.ticket_code || `#${ticket.id}`} · {ticket.category} · {ticket.initiator_role}
                          {' · '}
                          {new Date(ticket.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      </div>
                      {expandedTicket === ticket.id ? (
                        <ChevronUp className="w-4 h-4 text-tg-hint shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-tg-hint shrink-0" />
                      )}
                    </button>

                    {expandedTicket === ticket.id && (
                      <div className="px-4 pb-4 space-y-3 border-t border-tg-hint/10">
                        {/* Messages */}
                        <div className="max-h-60 overflow-y-auto space-y-2 pt-3">
                          {(ticketMessages || []).map((msg) => (
                            <div
                              key={msg.id}
                              className={`rounded-lg p-2.5 text-sm ${
                                msg.sender_type === 'moderator' || msg.sender_type === 'superadmin'
                                  ? 'bg-brand-50 ml-4'
                                  : msg.sender_type === 'system'
                                    ? 'bg-gray-100 text-tg-hint text-xs italic mx-4'
                                    : 'bg-tg-bg mr-4'
                              }`}
                            >
                              <p className="text-xs text-tg-hint mb-1">{msg.sender_type}</p>
                              <p>{msg.text}</p>
                            </div>
                          ))}
                        </div>

                        {/* Reply */}
                        {!['resolved', 'closed'].includes(ticket.status) && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Ответить..."
                              className="input-field text-sm"
                            />
                            <button
                              onClick={() => {
                                if (replyText.trim()) {
                                  replyMutation.mutate({ id: ticket.id, text: replyText.trim() });
                                }
                              }}
                              disabled={!replyText.trim()}
                              className="px-3 py-2 bg-brand-500 text-white rounded-xl disabled:opacity-40"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* Actions */}
                        {!['resolved', 'closed'].includes(ticket.status) && (
                          <div className="flex gap-2">
                            {ticket.status === 'open' && (
                              <button
                                onClick={() => assignMutation.mutate(ticket.id)}
                                className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium"
                              >
                                <ClipboardList className="w-4 h-4 inline mr-1" />
                                Взять в работу
                              </button>
                            )}
                            {showCloseForm === ticket.id ? (
                              <div className="flex-1 space-y-2">
                                <textarea
                                  value={closeNote}
                                  onChange={(e) => setCloseNote(e.target.value)}
                                  placeholder="Заметка при закрытии (необязательно)..."
                                  className="input-field text-sm w-full"
                                  rows={2}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => closeMutation.mutate({ id: ticket.id, note: closeNote || undefined })}
                                    className="flex-1 py-2 bg-green-500 text-white rounded-xl text-sm font-medium"
                                  >
                                    Подтвердить
                                  </button>
                                  <button
                                    onClick={() => { setShowCloseForm(null); setCloseNote(''); }}
                                    className="px-4 py-2 bg-gray-200 text-tg-text rounded-xl text-sm"
                                  >
                                    Отмена
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowCloseForm(ticket.id)}
                                className="flex-1 py-2 bg-green-500 text-white rounded-xl text-sm font-medium"
                              >
                                <CheckCircle className="w-4 h-4 inline mr-1" />
                                Закрыть тикет
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Reviews tab ── */}
        {activeTab === 'reviews' && (
          <>
            <div className="flex gap-2">
              <input
                type="number"
                value={reviewMasterId}
                onChange={(e) => setReviewMasterId(e.target.value)}
                placeholder="ID мастера..."
                className="input-field text-sm flex-1"
              />
            </div>

            {!reviewMasterId ? (
              <EmptyState
                icon={<Star className="w-10 h-10" />}
                title="Введите ID мастера"
                description="Для просмотра отзывов укажите ID мастера"
              />
            ) : reviews.length === 0 ? (
              <EmptyState
                icon={<Star className="w-10 h-10" />}
                title="Нет отзывов"
                description="У этого мастера пока нет отзывов"
              />
            ) : (
              <div className="space-y-2">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className={`bg-surface-elevated rounded-xl p-4 shadow-card ${
                      review.is_hidden ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-tg-hint">#{review.id}</span>
                    </div>
                    {review.text && <p className="text-sm mb-2">{review.text}</p>}
                    {review.master_reply && (
                      <p className="text-sm text-tg-hint border-l-2 border-brand-200 pl-2 mb-2">
                        Ответ: {review.master_reply}
                      </p>
                    )}
                    {review.is_hidden && review.hide_reason && (
                      <p className="text-xs text-red-500 mb-2">Скрыт: {review.hide_reason}</p>
                    )}

                    {review.is_hidden ? (
                      <button
                        onClick={() => unhideReviewMutation.mutate(review.id)}
                        className="w-full py-2 bg-green-500 text-white rounded-xl text-sm font-medium"
                      >
                        <Eye className="w-4 h-4 inline mr-1" />
                        Восстановить
                      </button>
                    ) : hidingReview === review.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={hideReason}
                          onChange={(e) => setHideReason(e.target.value)}
                          placeholder="Причина скрытия..."
                          className="input-field text-sm w-full"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (hideReason.trim()) {
                                hideReviewMutation.mutate({ id: review.id, reason: hideReason.trim() });
                              }
                            }}
                            disabled={hideReason.trim().length < 5}
                            className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-40"
                          >
                            Скрыть
                          </button>
                          <button
                            onClick={() => { setHidingReview(null); setHideReason(''); }}
                            className="px-4 py-2 bg-gray-200 text-tg-text rounded-xl text-sm"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setHidingReview(review.id)}
                        className="w-full py-2 bg-red-100 text-red-600 rounded-xl text-sm font-medium"
                      >
                        <EyeOff className="w-4 h-4 inline mr-1" />
                        Скрыть отзыв
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Verification tab ── */}
        {activeTab === 'verification' && (
          <>
            {pendingMasters.length === 0 ? (
              <EmptyState
                icon={<UserCheck className="w-10 h-10" />}
                title="Нет заявок"
                description="Все мастера верифицированы"
              />
            ) : (
              <div className="space-y-2">
                {pendingMasters.map((master: { id: number; display_name?: string; name?: string; specialization?: string; created_at?: string }) => (
                  <div key={master.id} className="bg-surface-elevated rounded-xl p-4 shadow-card flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold">
                      {(master.display_name || master.name || '?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{master.display_name || master.name}</p>
                      <p className="text-xs text-tg-hint">{master.specialization || 'Без специализации'}</p>
                    </div>
                    <button
                      onClick={() => verifyMutation.mutate(master.id)}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium"
                    >
                      <UserCheck className="w-3.5 h-3.5 inline mr-0.5" />
                      Верифицировать
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
