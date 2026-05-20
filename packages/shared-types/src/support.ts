/** Статусы тикета. */
export const TicketStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export type TicketStatusType =
  (typeof TicketStatus)[keyof typeof TicketStatus];

/** Приоритеты тикета. */
export const TicketPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type TicketPriorityType =
  (typeof TicketPriority)[keyof typeof TicketPriority];

/** Тикет поддержки. */
export interface SupportTicket {
  id: number;
  ticket_code?: string;
  initiator_role: string;
  initiator_id: number;
  category: string;
  priority: string;
  subject: string;
  status: string;
  assigned_to?: number | null;
  satisfaction?: number | null;
  created_at: string;
}

/** Аудит-лог. Возвращает /api/v1/superadmin/audit-log. */
export interface AuditLogEntry {
  id: number;
  admin_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: number | null;
  payload?: Record<string, unknown> | null;
  /** @deprecated — backend больше не возвращает; сохранено для совместимости. */
  user_name?: string;
  /** @deprecated — backend больше не возвращает; сохранено для совместимости. */
  details?: string;
  created_at: string;
}
