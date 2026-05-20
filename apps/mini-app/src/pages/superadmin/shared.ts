/**
 * Реэкспорт хелперов для совместимости с прежними импортами в `tabs/*`.
 *
 * Источник правды:
 *  - shared/lib/format.ts        — fmtRub
 *  - shared/lib/ticketStatus.ts  — TICKET_STATUS_VARIANT
 */
export { fmtRub } from '@/shared/lib/format';
export {
  TICKET_STATUS_VARIANT,
  ticketStatusLabel,
  ticketStatusVariant,
} from '@/shared/lib/ticketStatus';

/** Цвет для произвольной строки статуса (используется в HealthTab). */
export function statusVariant(
  status: string
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ok') return 'success';
  if (status === 'not_configured') return 'neutral';
  return 'danger';
}
