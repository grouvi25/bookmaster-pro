import { useQuery } from '@tanstack/react-query';
import { featureFlagsApi } from '@/api/endpoints';
import { useAuthStore } from '@/stores/auth';

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

const FREE_FLAGS: FeatureFlags = {
  tariff_plan: 'start',
  ai_advisor: false,
  ai_voice: false,
  ai_content: false,
  crm_enabled: false,
  broadcast_enabled: false,
  loyalty_enabled: false,
  subscriptions_enabled: false,
  consultations_enabled: false,
  portfolio_enabled: false,
  locations_enabled: false,
  analytics_enabled: false,
  waitlist_enabled: false,
  custom_branding: false,
  widget_enabled: false,
  client_subscriptions: false,
};

export function useFeatureFlags() {
  const { token, role } = useAuthStore();
  const isMaster = role === 'master' || role === 'superadmin';

  const { data, isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => featureFlagsApi.get().then((r) => r.data as FeatureFlags),
    enabled: !!token && isMaster,
    staleTime: 0, // Всегда refetch — критично для реактивного обновления при смене тарифа
    refetchOnWindowFocus: true,
  });

  if (role === 'superadmin') {
    const allEnabled: FeatureFlags = {
      tariff_plan: 'business',
      ai_advisor: true,
      ai_voice: true,
      ai_content: true,
      crm_enabled: true,
      broadcast_enabled: true,
      loyalty_enabled: true,
      subscriptions_enabled: true,
      consultations_enabled: true,
      portfolio_enabled: true,
      locations_enabled: true,
      analytics_enabled: true,
      waitlist_enabled: true,
      custom_branding: true,
      widget_enabled: true,
      client_subscriptions: true,
    };
    return { flags: allEnabled, isLoading: false };
  }

  return {
    flags: data || FREE_FLAGS,
    isLoading,
  };
}

export function useFeatureFlag(flag: keyof Omit<FeatureFlags, 'tariff_plan'>): boolean {
  const { flags } = useFeatureFlags();
  return flags[flag] === true;
}
