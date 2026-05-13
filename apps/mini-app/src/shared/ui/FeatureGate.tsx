import type { ReactNode } from 'react';
import { useFeatureFlag, type FeatureFlags } from '@/hooks/useFeatureFlag';
import { Lock } from 'lucide-react';
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-tg-bg text-tg-text p-6">
      <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4">
        <Lock className="w-8 h-8 text-amber-500" strokeWidth={1.5} />
      </div>
      <h2 className="text-xl font-bold mb-2">Доступно на тарифе «{tariff}»</h2>
      <p className="text-tg-hint text-center text-sm mb-6">
        Эта функция недоступна на вашем текущем тарифе.
        Перейдите на тариф «{tariff}» или выше.
      </p>
      <button
        onClick={() => navigate('/billing')}
        className="px-6 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-semibold"
      >
        Посмотреть тарифы
      </button>
    </div>
  );
}
