import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ChevronDown, ChevronUp, Send, ClipboardList,
  CheckCircle,
} from 'lucide-react';
import { moderationApi } from '@/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import ChipTabs from '@/shared/ui/ChipTabs';
import Button from '@/shared/ui/Button';
import { TicketCardSkeleton } from '@/shared/ui/Skeleton';
import {
  ticketStatusLabel,
  ticketStatusVariant,
} from '@/shared/lib/ticketStatus';
import { fmtDate } from '@/shared/lib/format';

interface Ticket {
  id: number;
  ticket_code?: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  initiator_role: string;
  created_at: string;
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
  { key: 'waiting_user', label: 'Ожидание' },
  { key: 'resolved', label: 'Решённые' },
];

export default function TicketsTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('open');
  const [expandedTicket, setExpandedTicket] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [showCloseForm, setShowCloseForm] = useState<number | null>(null);

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ['moderation-queue', statusFilter],
    queryFn: () =>
      moderationApi.queue({ status: statusFilter }).then((r) => r.data),
  });

  const { data: ticketMessages } = useQuery<TicketMessage[]>({
    queryKey: ['ticket-messages', expandedTicket],
    queryFn: () =>
      expandedTicket
        ? moderationApi.messages(expandedTicket).then((r) => r.data)
        : Promise.resolve([]),
    enabled: !!expandedTicket,
  });

  const assignMutation = useMutation({
    mutationFn: (id: number) => moderationApi.assign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
      toast.success('Тикет взят в работу');
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      moderationApi.close(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
      setShowCloseForm(null);
      setCloseNote('');
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

  return (
    <div className="space-y-4">
      <ChipTabs
        tabs={STATUS_TABS}
        active={statusFilter}
        onChange={setStatusFilter}
      />

      {isLoading ? (
        <TicketCardSkeleton count={3} />
      ) : tickets.length === 0 ? (
        <EmptyState
          emoji="✅"
          title="Нет тикетов"
          description="Все тикеты обработаны"
        />
      ) : (
        <div className="flex flex-col gap-card-gap">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              isExpanded={expandedTicket === ticket.id}
              messages={
                expandedTicket === ticket.id ? ticketMessages || [] : []
              }
              replyText={replyText}
              showCloseForm={showCloseForm === ticket.id}
              closeNote={closeNote}
              onToggle={() =>
                setExpandedTicket(
                  expandedTicket === ticket.id ? null : ticket.id
                )
              }
              onReplyTextChange={setReplyText}
              onSendReply={() =>
                replyMutation.mutate({ id: ticket.id, text: replyText.trim() })
              }
              onAssign={() => assignMutation.mutate(ticket.id)}
              onShowClose={() => setShowCloseForm(ticket.id)}
              onCloseNoteChange={setCloseNote}
              onConfirmClose={() =>
                closeMutation.mutate({
                  id: ticket.id,
                  note: closeNote || undefined,
                })
              }
              onCancelClose={() => {
                setShowCloseForm(null);
                setCloseNote('');
              }}
              replyPending={replyMutation.isPending}
              closePending={closeMutation.isPending}
              assignPending={assignMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TicketCardProps {
  ticket: Ticket;
  isExpanded: boolean;
  messages: TicketMessage[];
  replyText: string;
  showCloseForm: boolean;
  closeNote: string;
  onToggle: () => void;
  onReplyTextChange: (v: string) => void;
  onSendReply: () => void;
  onAssign: () => void;
  onShowClose: () => void;
  onCloseNoteChange: (v: string) => void;
  onConfirmClose: () => void;
  onCancelClose: () => void;
  replyPending: boolean;
  closePending: boolean;
  assignPending: boolean;
}

function TicketCard({
  ticket, isExpanded, messages, replyText, showCloseForm, closeNote,
  onToggle, onReplyTextChange, onSendReply, onAssign, onShowClose,
  onCloseNoteChange, onConfirmClose, onCancelClose,
  replyPending, closePending, assignPending,
}: TicketCardProps) {
  const isClosed = ticket.status === 'resolved' || ticket.status === 'closed';
  const priorityColor =
    ticket.priority === 'high' ? 'text-status-danger' : 'text-status-warning';

  return (
    <div className="bg-tg-secondary rounded-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-card-inner flex items-start gap-3 text-left interactive"
      >
        <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${priorityColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-body font-medium truncate">
              {ticket.subject || `#${ticket.id}`}
            </p>
            <StatusBadge
              label={ticketStatusLabel(ticket.status)}
              variant={ticketStatusVariant(ticket.status)}
            />
          </div>
          <p className="text-aux text-tg-hint">
            {ticket.ticket_code || `#${ticket.id}`} · {ticket.category} ·{' '}
            {ticket.initiator_role} · {fmtDate(ticket.created_at)}
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-tg-hint shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-tg-hint shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="px-card-inner pb-card-inner space-y-3 border-t border-tg-hint/10">
          {/* Сообщения */}
          <div className="max-h-60 overflow-y-auto space-y-2 pt-3">
            {messages.length === 0 && (
              <p className="text-aux text-tg-hint">Сообщений нет</p>
            )}
            {messages.map((msg) => {
              const isStaff =
                msg.sender_type === 'moderator' ||
                msg.sender_type === 'superadmin';
              const isSystem = msg.sender_type === 'system';
              return (
                <div
                  key={msg.id}
                  className={`rounded-lg p-2.5 text-body ${
                    isStaff
                      ? 'bg-status-info/10 ml-4'
                      : isSystem
                      ? 'bg-tg-secondary text-tg-hint text-aux italic mx-4'
                      : 'bg-tg-bg mr-4'
                  }`}
                >
                  <p className="text-aux text-tg-hint mb-1">{msg.sender_type}</p>
                  <p className="text-tg-text">{msg.text}</p>
                </div>
              );
            })}
          </div>

          {!isClosed && (
            <div className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => onReplyTextChange(e.target.value)}
                placeholder="Ответить..."
                className="input-field text-body"
              />
              <Button
                onClick={onSendReply}
                disabled={!replyText.trim()}
                loading={replyPending}
                size="sm"
                className="shrink-0 !w-12 !px-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}

          {!isClosed && (
            <div className="flex gap-2">
              {ticket.status === 'open' && (
                <Button
                  onClick={onAssign}
                  loading={assignPending}
                  fullWidth
                  size="sm"
                >
                  <ClipboardList className="w-4 h-4" />
                  Взять в работу
                </Button>
              )}
              {showCloseForm ? (
                <div className="flex-1 space-y-2">
                  <textarea
                    value={closeNote}
                    onChange={(e) => onCloseNoteChange(e.target.value)}
                    placeholder="Заметка при закрытии (необязательно)..."
                    className="input-field !h-auto !py-2 text-body w-full"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={onConfirmClose}
                      loading={closePending}
                      fullWidth
                      size="sm"
                    >
                      Подтвердить
                    </Button>
                    <Button
                      onClick={onCancelClose}
                      variant="secondary"
                      size="sm"
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={onShowClose}
                  fullWidth
                  size="sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  Закрыть тикет
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
