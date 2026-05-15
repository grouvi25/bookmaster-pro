import type { ReactNode } from 'react';
import { useFeatureFlag, type FeatureFlags } from '@/hooks/useFeatureFlag';
import { useNavigate } from 'react-router-dom';

const TARIFF_LABELS: Record<string, string> = {
  crm_enabled: 'Базовый',
  broadcast_enabled: 'Профи',
  loyalty_enabled: 'Профи',
  subscriptions_enabled: 'Профи',
  consultations_enabled: 'Профи',
  portfolio_enabled: 'Профи',
  locations_enabled: 'Профи',
  analytics_enabled: 'Профи',
  waitlist_enabled: 'Базовый',
  ai_advisor: 'Профи',
  ai_voice: 'Профи+AI',
  ai_content: 'Профи',
  custom_branding: 'Бизнес',
  widget_enabled: 'Бизнес',
  client_subscriptions: 'Профи',
};

interface FeatureGateProps {
  flag: keyof Omit<FeatureFlags, 'tariff_plan'>;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function FeatureGate({ flag, children, fallback }: FeatureGateProps) {
  const enabled = useFeatureFlag(flag);

  if (enabled) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return <FeatureLockedScreen flag={flag} />;
}

function FeatureLockedScreen({ flag }: { flag: string }) {
  const navigate = useNavigate();
  const tariff = TARIFF_LABELS[flag] || 'Профи';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-tg-bg text-tg-text px-screen-x">
      <div className="text-[48px] mb-4">{'🔒'}</div>
      <h2 className="text-h1 mb-2 text-center">Доступно на тарифе «{tariff}»</h2>
      <p className="text-tg-hint text-center text-body mb-6">
        Эта функция недоступна на вашем текущем тарифе.
        Перейдите на тариф «{tariff}» или выше.
      </p>
      <button
        onClick={() => navigate('/billing')}
        className="h-[52px] px-6 bg-tg-button text-tg-button-text rounded-btn text-[16px] font-semibold interactive"
      >
        Посмотреть тарифы
      </button>
    </div>
  );
}
