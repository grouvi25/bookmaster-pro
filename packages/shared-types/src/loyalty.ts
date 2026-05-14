/** Типы loyalty-транзакций. */
export const LoyaltyTransactionType = {
  EARN_VISIT: 'earn_visit',
  EARN_REVIEW: 'earn_review',
  EARN_BIRTHDAY: 'earn_birthday',
  EARN_REFERRAL: 'earn_referral',
  SPEND: 'spend',
  EXPIRE: 'expire',
} as const;

export type LoyaltyTransactionTypeValue =
  (typeof LoyaltyTransactionType)[keyof typeof LoyaltyTransactionType];

/** Лояльность — история. */
export interface LoyaltyTransaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}
