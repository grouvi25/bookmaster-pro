/** Feature flags — тарифные ограничения. */
export interface FeatureFlags {
  tariff_plan: string;
  ai_advisor: boolean;
  ai_voice: boolean;
  ai_content: boolean;
  crm_enabled: boolean;
  broadcast_enabled: boolean;
  loyalty_enabled: boolean;
  subscriptions_enabled: boolean;
  consultations_enabled: boolean;
  portfolio_enabled: boolean;
  locations_enabled: boolean;
  analytics_enabled: boolean;
  waitlist_enabled: boolean;
  custom_branding: boolean;
  widget_enabled: boolean;
  client_subscriptions: boolean;
}

/** Тарифные планы. */
export const TariffPlan = {
  START: 'start',
  BASIC: 'basic',
  PRO: 'pro',
  PRO_AI: 'pro_ai',
  BUSINESS: 'business',
} as const;

export type TariffPlanType =
  (typeof TariffPlan)[keyof typeof TariffPlan];

/** No-show risk levels. */
export const NoShowRiskLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type NoShowRiskLevelType =
  (typeof NoShowRiskLevel)[keyof typeof NoShowRiskLevel];
