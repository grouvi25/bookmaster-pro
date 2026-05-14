/** Конфигурация тарифных планов. */
export interface PlanConfig {
  key: string;
  name: string;
  price: number;
  maxBookingsPerMonth: number;
  maxServices: number;
  maxLocations: number;
  aiTokensMonthly: number;
  commissionRateBp: number;
}

export const TARIFF_PLANS: PlanConfig[] = [
  {
    key: 'start',
    name: 'Старт',
    price: 590,
    maxBookingsPerMonth: 30,
    maxServices: 3,
    maxLocations: 1,
    aiTokensMonthly: 0,
    commissionRateBp: 700,
  },
  {
    key: 'basic',
    name: 'Базовый',
    price: 990,
    maxBookingsPerMonth: 100,
    maxServices: 10,
    maxLocations: 1,
    aiTokensMonthly: 0,
    commissionRateBp: 500,
  },
  {
    key: 'pro',
    name: 'Про',
    price: 1990,
    maxBookingsPerMonth: 999999,
    maxServices: 50,
    maxLocations: 3,
    aiTokensMonthly: 50000,
    commissionRateBp: 300,
  },
  {
    key: 'pro_ai',
    name: 'Про + AI',
    price: 2990,
    maxBookingsPerMonth: 999999,
    maxServices: 50,
    maxLocations: 3,
    aiTokensMonthly: 200000,
    commissionRateBp: 300,
  },
  {
    key: 'business',
    name: 'Бизнес',
    price: 4990,
    maxBookingsPerMonth: 999999,
    maxServices: 100,
    maxLocations: 10,
    aiTokensMonthly: 500000,
    commissionRateBp: 200,
  },
];

/** Маппинг feature flag → минимальный тариф для его активации. */
export const TARIFF_LABELS: Record<string, string> = {
  crm_enabled: 'Базовый',
  broadcast_enabled: 'Базовый',
  loyalty_enabled: 'Базовый',
  analytics_enabled: 'Базовый',
  ai_advisor: 'Про',
  ai_voice: 'Про',
  portfolio_enabled: 'Про',
  subscriptions_enabled: 'Про',
  consultations_enabled: 'Про',
  ai_content: 'Про + AI',
  client_subscriptions: 'Про + AI',
  waitlist_enabled: 'Про + AI',
  locations_enabled: 'Бизнес',
  custom_branding: 'Бизнес',
  widget_enabled: 'Бизнес',
  marketplace_enabled: 'Бизнес',
};
