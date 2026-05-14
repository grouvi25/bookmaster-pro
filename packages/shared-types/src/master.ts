/** Мастер (публичный профиль). */
export interface MasterProfile {
  id: number;
  display_name: string;
  slug: string;
  specialization: string | null;
  description: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  accept_online_payment: boolean;
  buffer_minutes: number;
  link_page_enabled: boolean;
  link_page_theme: string;
  link_page_links: { url: string; label?: string }[];
  current_plan: string;
  is_verified: boolean;
  rating_avg: number;
  rating_count: number;
  total_clients: number;
  total_appointments: number;
  noshow_deposit_amount: number;
  noshow_prepay_percent: number;
  is_portfolio: boolean;
}

/** Тип тарификации мастера. */
export const TariffType = {
  COMMISSION: 'A',
  SUBSCRIPTION: 'B',
} as const;

export type TariffTypeValue =
  (typeof TariffType)[keyof typeof TariffType];
