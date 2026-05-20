import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { superadminApi } from '@/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import EmptyState from '@/shared/ui/EmptyState';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import StatusBadge from '@/shared/ui/StatusBadge';
import { TICKET_STATUS_VARIANT } from '../shared';

interface TicketItem {
  id: number;
  ticket_code: string;
  initiator_role: string;
  initiator_id: number;
  category?: string;
  subject?: string;
  status: string;
  priority: string;
  created_at: string;
  age_hours: number;
  sla_breach: boolean;
}

interface TicketMessage {
  id: number;
  sender_type: string;
  text: string;
  created_at: string;
}

interface TicketDetail {
  id: number;
  ticket_code: string;
  subject?: string;
  status: string;
  priority: string;
  initiator_role: string;
  initiator_id: number;
  messages: TicketMessage[];
}

const STATUS_FILTERS = ['', 'open', 'in_progress', 'resolved', 'escalated'] as const;
const PRIORITY_FILTERS = ['', 'high', 'medium', 'low', 'feedback'] as const;

export default function TicketsTab() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-tickets', statusFilter, priorityFilter],
    queryFn: () =>
      superadminApi
        .tickets({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
        })
        .then((r) => r.data),
  });

  const detailQuery = useQuery<TicketDetail>({
    queryKey: ['superadmin-ticket-detail', activeTicketId],
    queryFn: () => superadminApi.ticketDetail(activeTicketId!).then((r) => r.data),
    enabled: activeTicketId != null,
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, text }: { id: number; text: string }) =>
      superadminApi.replyTicket(id, text),
    onSuccess: () => {
      toast.success('Ответ отправлен');
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['superadmin-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-ticket-detail'] });
    },
    onError: () => toast.error('Не удалось отправить ответ'),
  });

  const escalateMutation = useMutation({
    mutationFn: (ticketId: number) => superadminApi.escalateTicket(ticketId),
    onSuccess: () => {
      toast.success('Эскалирован');
      queryClient.invalidateQueries({ queryKey: ['superadmin-tickets'] });
    },
  });

  if (isLoading) return <ListSkeleton count={4} />;

  const tickets: TicketItem[] = data?.tickets || [];
  const openCount: number = data?.open_count ?? 0;
  const slaBreached: number = data?.sla_breached ?? 0;

  return (
    <div>
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`chip whitespace-nowrap ${
                statusFilter === s ? 'chip-active' : 'chip-inactive'
              }`}
            >
              {s || 'Все статусы'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {PRIORITY_FILTERS.map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`chip whitespace-nowrap ${
                priorityFilter === p ? 'chip-active' : 'chip-inactive'
              }`}
            >
              {p || 'Все приоритеты'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between text-[11px] text-tg-hint mb-3">
        <span>Открытых: {openCount}</span>
        <span className={slaBreached > 0 ? 'text-status-danger font-medium' : ''}>
          SLA нарушено: {slaBreached}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {tickets.length === 0 ? (
          <EmptyState emoji="📨" title="Нет тикетов" description="Очередь пуста" />
        ) : (
          tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              isActive={activeTicketId === t.id}
              detail={activeTicketId === t.id ? detailQuery.data : undefined}
              detailLoading={activeTicketId === t.id && detailQuery.isLoading}
              replyText={replyText}
              onReplyTextChange={setReplyText}
              onToggle={() =>
                setActiveTicketId(activeTicketId === t.id ? null : t.id)
              }
              onReply={() => replyMutation.mutate({ id: t.id, text: replyText })}
              onEscalate={() => escalateMutation.mutate(t.id)}
              replyPending={replyMutation.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface TicketCardProps {
  ticket: TicketItem;
  isActive: boolean;
  detail?: TicketDetail;
  detailLoading: boolean;
  replyText: string;
  onReplyTextChange: (v: string) => void;
  onToggle: () => void;
  onReply: () => void;
  onEscalate: () => void;
  replyPending: boolean;
}

function TicketCard({
  ticket,
  isActive,
  detail,
  detailLoading,
  replyText,
  onReplyTextChange,
  onToggle,
  onReply,
  onEscalate,
  replyPending,
}: TicketCardProps) {
  const priorityVariant =
    ticket.priority === 'high'
      ? 'danger'
      : ticket.priority === 'medium'
      ? 'warning'
      : 'neutral';

  return (
    <Card>
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">
            {ticket.ticket_code}: {ticket.subject || ticket.category || 'Без темы'}
          </div>
          <div className="text-[11px] text-tg-hint mt-0.5">
            {ticket.initiator_role}#{ticket.initiator_id} · возраст{' '}
            {ticket.age_hours.toFixed(1)} ч
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge label={ticket.priority} variant={priorityVariant} />
          <StatusBadge
            label={ticket.status}
            variant={TICKET_STATUS_VARIANT[ticket.status] || 'neutral'}
          />
          {ticket.sla_breach && <StatusBadge label="SLA!" variant="danger" />}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={onToggle}
          className="text-xs bg-tg-button text-tg-button-text px-2.5 py-1.5 rounded-lg"
        >
          {isActive ? 'Свернуть' : 'Открыть'}
        </button>
        {ticket.status !== 'escalated' && ticket.status !== 'resolved' && (
          <button
            onClick={onEscalate}
            className="text-xs bg-status-danger/10 text-status-danger px-2.5 py-1.5 rounded-lg"
          >
            Эскалировать
          </button>
        )}
      </div>

      {isActive && (
        <div className="mt-3 pt-3 border-t border-tg-secondary/50">
          {detailLoading ? (
            <div className="text-xs text-tg-hint">Загружаю…</div>
          ) : detail ? (
            <>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mb-2">
                {detail.messages.length === 0 && (
                  <div className="text-xs text-tg-hint">Сообщений пока нет</div>
                )}
                {detail.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`text-xs rounded-lg p-2 ${
                      m.sender_type === 'admin'
                        ? 'bg-status-info/10 ml-4'
                        : 'bg-tg-bg mr-4'
                    }`}
                  >
                    <div className="text-[10px] text-tg-hint mb-0.5">
                      {m.sender_type} · {m.created_at}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  </div>
                ))}
              </div>
              <textarea
                value={replyText}
                onChange={(e) => onReplyTextChange(e.target.value)}
                placeholder="Ваш ответ..."
                rows={3}
                className="input-field !h-auto !py-2"
              />
              <Button
                onClick={onReply}
                loading={replyPending}
                disabled={!replyText.trim()}
                fullWidth
                size="sm"
                className="mt-2"
              >
                Отправить ответ
              </Button>
            </>
          ) : null}
        </div>
      )}
    </Card>
  );
}
