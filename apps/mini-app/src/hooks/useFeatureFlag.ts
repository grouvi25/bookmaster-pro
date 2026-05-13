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
};

export function useFeatureFlags() {
  const { token, role } = useAuthStore();
  const isMaster = role === 'master' || role === 'superadmin';

  const { data, isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => featureFlagsApi.get().then((r) => r.data as FeatureFlags),
    enabled: !!token && isMaster,
    staleTime: 60_000,
  });

  // Superadmin gets all features
  if (role === 'superadmin') {
    const allEnabled = { ...FREE_FLAGS };
    for (const key of Object.keys(allEnabled)) {
      if (typeof allEnabled[key as keyof FeatureFlags] === 'boolean') {
        (allEnabled as Record<string, unknown>)[key] = true;
      }
    }
    allEnabled.tariff_plan = 'business';
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
