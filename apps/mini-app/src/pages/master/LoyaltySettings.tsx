import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { loyaltyApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import Card from '@/shared/ui/Card';
import { ChevronLeft, Star, Users, Gift, Clock } from 'lucide-react';

interface TierInfo {
  threshold: number;
  cashback_percent: number;
}

interface LoyaltySettingsData {
  tiers: Record<string, TierInfo>;
  points_expiry_months: number;
  streak_threshold: number;
  streak_bonus: number;
  referral_bonus: number;
}

const TIER_ICONS: Record<string, string> = {
  new: '🌱',
  regular: '⭐',
  vip: '💎',
};

const TIER_NAMES: Record<string, string> = {
  new: 'Новый',
  regular: 'Постоянный',
  vip: 'VIP',
};

export default function LoyaltySettings() {
  const navigate = useNavigate();

  const { data: settings, isLoading } = useQuery<LoyaltySettingsData>({
    queryKey: ['loyalty-settings'],
    queryFn: () => loyaltyApi.getSettings().then((r) => r.data),
  });

  if (isLoading) return <Loading />;
  if (!settings) return null;

  return (
    <div className="p-4 pb-20 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-0.5 text-tg-link text-sm mb-3"
      >
        <ChevronLeft className="w-4 h-4" /> Назад
      </button>

      <h1 className="text-xl font-bold mb-4">Настройки лояльности</h1>

      <Card className="mb-4">
        <h2 className="font-medium text-sm mb-3 flex items-center gap-1.5">
          <Star className="w-4 h-4 text-yellow-500" />
          Уровни клиентов
        </h2>
        <div className="flex flex-col gap-3">
          {Object.entries(settings.tiers).map(([key, tier]) => (
            <div key={key} className="flex items-center justify-between bg-tg-secondary rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{TIER_ICONS[key] ?? '🏷'}</span>
                <div>
                  <div className="font-medium text-sm">{TIER_NAMES[key] ?? key}</div>
                  {tier.threshold > 0 && (
                    <div className="text-xs text-tg-hint">от {tier.threshold} баллов</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-brand-600">{tier.cashback_percent}%</div>
                <div className="text-[10px] text-tg-hint">кешбэк</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="font-medium text-sm mb-3 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-brand-500" />
          Бонусы
        </h2>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-tg-hint">Серия визитов</span>
            <span>{settings.streak_threshold} визитов подряд = +{settings.streak_bonus} баллов</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tg-hint">Реферальный бонус</span>
            <span>+{settings.referral_bonus} баллов</span>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-medium text-sm mb-3 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-tg-hint" />
          Срок действия
        </h2>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-tg-hint">Баллы сгорают через</span>
            <span>{settings.points_expiry_months} мес.</span>
          </div>
        </div>
      </Card>

      <p className="text-xs text-tg-hint text-center mt-4">
        <Gift className="w-3 h-3 inline mr-1" />
        Настройки лояльности применяются ко всем клиентам
      </p>
    </div>
  );
}
