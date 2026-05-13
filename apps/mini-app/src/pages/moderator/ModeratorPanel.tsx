import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { moderationApi } from '@/api/endpoints';
import PageHeader from '@/shared/ui/PageHeader';
import ChipTabs from '@/shared/ui/ChipTabs';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import { MessageSquare, CheckCircle, AlertTriangle, UserCheck, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from '@/shared/ui/Toast';

interface Ticket {
  id: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  initiator_role: string;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: number;
  text: string;
  sender_type: string;
  created_at: string;
}

const STATUS_TABS = [
  { key: 'open', label: 'Открытые' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'resolved', label: 'Решённые' },
];

export default function ModeratorPanel() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('open');
  const [expandedTicket, setExpandedTicket] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [activeTab, setActiveTab] = useState<'tickets' | 'verification'>('tickets');

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

  const resolveMutation = useMutation({
    mutationFn: (id: number) => moderationApi.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
      toast.success('Тикет закрыт');
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
            onClick={() => setActiveTab('verification')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'verification' ? 'bg-brand-500 text-white' : 'bg-surface-elevated text-tg-hint'
            }`}
          >
            <UserCheck className="w-4 h-4 inline mr-1" />
            Верификация
          </button>
        </div>

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
                          <p className="text-sm font-medium truncate">{ticket.subject}</p>
                          <StatusBadge
                        label={ticket.status === 'open' ? 'Открыт' : ticket.status === 'in_progress' ? 'В работе' : 'Решён'}
                        variant={ticket.status === 'resolved' ? 'success' : ticket.status === 'in_progress' ? 'info' : 'warning'}
                      />
                        </div>
                        <p className="text-xs text-tg-hint">
                          #{ticket.id} · {ticket.category} · {ticket.initiator_role}
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
                                  : 'bg-tg-bg mr-4'
                              }`}
                            >
                              <p className="text-xs text-tg-hint mb-1">{msg.sender_type}</p>
                              <p>{msg.text}</p>
                            </div>
                          ))}
                        </div>

                        {/* Reply */}
                        {ticket.status !== 'resolved' && (
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
                        {ticket.status !== 'resolved' && (
                          <button
                            onClick={() => resolveMutation.mutate(ticket.id)}
                            className="w-full py-2 bg-green-500 text-white rounded-xl text-sm font-medium"
                          >
                            <CheckCircle className="w-4 h-4 inline mr-1" />
                            Закрыть тикет
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

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
