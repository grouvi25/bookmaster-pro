/**
 * Единая мапа статусов бронирования.
 * Используется во всех экранах мастера и клиента.
 */

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'completed'
  | 'cancelled'
  | 'cancelled_by_client'
  | 'cancelled_by_master'
  | 'no_show';

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending: 'Ожидает',
  confirmed: 'Подтверждена',
  paid: 'Оплачена',
  completed: 'Завершена',
  cancelled: 'Отменена',
  cancelled_by_client: 'Отменена клиентом',
  cancelled_by_master: 'Отменена мастером',
  no_show: 'Не пришёл',
};

export const BOOKING_STATUS_VARIANT: Record<
  string,
  'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  pending: 'neutral',
  confirmed: 'success',
  paid: 'success',
  completed: 'info',
  cancelled: 'danger',
  cancelled_by_client: 'danger',
  cancelled_by_master: 'danger',
  no_show: 'warning',
};

/** Хелпер: лейбл по статусу с фоллбэком на raw-строку. */
export function bookingStatusLabel(status: string): string {
  return BOOKING_STATUS_LABEL[status] ?? status;
}

/** Хелпер: вариант цвета для StatusBadge. */
export function bookingStatusVariant(
  status: string
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  return BOOKING_STATUS_VARIANT[status] ?? 'neutral';
}

/** Можно ли мастеру/клиенту совершать действия над записью. */
export function isBookingActionable(status: string): boolean {
  return status === 'pending' || status === 'confirmed' || status === 'paid';
}
