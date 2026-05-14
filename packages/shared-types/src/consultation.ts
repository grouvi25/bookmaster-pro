/** Статусы консультации. */
export const ConsultationStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const;

export type ConsultationStatusType =
  (typeof ConsultationStatus)[keyof typeof ConsultationStatus];

/** Консультация. */
export interface Consultation {
  id: number;
  master_id: number;
  client_id: number | null;
  service_id: number | null;
  status: string;
  date: string;
  time_start: string;
  client_name?: string;
  service_name?: string;
  notes?: string;
}
