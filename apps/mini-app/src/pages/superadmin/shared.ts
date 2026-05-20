/**
 * Общие типы и утилиты для суперадминских вкладок.
 */

export function fmtRub(value?: number | null): string {
  return `${(value ?? 0).toLocaleString('ru')} ₽`;
}

export function statusVariant(
  status: string
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ok') return 'success';
  if (status === 'not_configured') return 'neutral';
  return 'danger';
}

export const TICKET_STATUS_VARIANT: Record<
  string,
  'success' | 'warning' | 'danger' | 'neutral' | 'info'
> = {
  open: 'warning',
  in_progress: 'info',
  waiting_user: 'neutral',
  resolved: 'success',
  closed: 'neutral',
  escalated: 'danger',
};
