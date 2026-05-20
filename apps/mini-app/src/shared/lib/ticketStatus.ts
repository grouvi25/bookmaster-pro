/**
 * Единая мапа статусов тикетов поддержки.
 * Используется в суперадминке, модераторе, master/Settings.
 */

export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_user'
  | 'resolved'
  | 'closed'
  | 'escalated';

export type TicketPriority = 'high' | 'medium' | 'low' | 'feedback';

export const TICKET_STATUS_LABEL: Record<string, string> = {
  open: 'Открыт',
  in_progress: 'В работе',
  waiting_user: 'Ждёт ответа',
  resolved: 'Решён',
  closed: 'Закрыт',
  escalated: 'Эскалирован',
};

export const TICKET_STATUS_VARIANT: Record<
  string,
  'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  open: 'warning',
  in_progress: 'info',
  waiting_user: 'neutral',
  resolved: 'success',
  closed: 'neutral',
  escalated: 'danger',
};

export const TICKET_PRIORITY_LABEL: Record<string, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
  feedback: 'Отзыв',
};

export const TICKET_PRIORITY_VARIANT: Record<
  string,
  'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
  feedback: 'info',
};

export function ticketStatusLabel(status: string): string {
  return TICKET_STATUS_LABEL[status] ?? status;
}

export function ticketStatusVariant(
  status: string
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  return TICKET_STATUS_VARIANT[status] ?? 'neutral';
}

export function ticketPriorityLabel(priority: string): string {
  return TICKET_PRIORITY_LABEL[priority] ?? priority;
}

export function ticketPriorityVariant(
  priority: string
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  return TICKET_PRIORITY_VARIANT[priority] ?? 'neutral';
}
