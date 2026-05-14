/** Статусы записи (appointment). */
export const AppointmentStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PAID: 'paid',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED_BY_CLIENT: 'cancelled_by_client',
  CANCELLED_BY_MASTER: 'cancelled_by_master',
  NO_SHOW: 'no_show',
} as const;

export type AppointmentStatusType =
  (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

/** Запись (бронирование). */
export interface Booking {
  id: number;
  master_id: number;
  client_id: number | null;
  service_id: number | null;
  date: string;
  time_start: string;
  time_end: string;
  time?: string;
  status: AppointmentStatusType;
  client_name: string | null;
  client_phone: string | null;
  client_comment: string | null;
  master_comment: string | null;
  service_name?: string;
  master_name?: string;
  duration_min?: number;
  price?: number;
  price_final: number | null;
  discount_amount: number;
  source: string;
}

/** Источник записи. */
export const BookingSource = {
  MINI_APP: 'mini_app',
  BOT: 'bot',
  MARKETPLACE: 'marketplace',
  WIDGET: 'widget',
  MANUAL: 'manual',
} as const;

export type BookingSourceType =
  (typeof BookingSource)[keyof typeof BookingSource];
