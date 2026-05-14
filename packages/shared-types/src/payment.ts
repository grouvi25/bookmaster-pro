/** Статусы платежа. */
export const PaymentStatus = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const;

export type PaymentStatusType =
  (typeof PaymentStatus)[keyof typeof PaymentStatus];

/** Платёж. */
export interface Payment {
  id: number;
  appointment_id: number | null;
  master_id: number;
  client_id: number | null;
  amount_total: number;
  amount_paid: number;
  payment_type: string | null;
  status: string;
  yookassa_payment_id: string | null;
}

/** Подписка мастера. */
export interface MasterSubscription {
  id: number;
  master_id: number;
  plan: string;
  price: number;
  billing_period: string;
  status: string;
  started_at: string;
  next_billing: string;
}
