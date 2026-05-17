import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { loyaltyApi } from '@/api/endpoints';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import BackButton from '@/components/common/BackButton';
import EmptyState from '@/shared/ui/EmptyState';


interface LoyaltyBalance {
  master_id: number;
  client_id: number;
  balance: number;
  tier: string;
  total_earned: number;
  streak_count?: number;
  streak_threshold?: number;
  streak_bonus?: number;
}

interface LoyaltyTx {
  id: number;
  type: string;
  points: number;
  note: string | null;
}

const TIER_CONFIG: Record<string, { label: string; color: string; cashback: number }> = {
  new: { label: 'Новый', color: 'text-gray-500', cashback: 3 },
  regular: { label: 'Постоянный', color: 'text-blue-500', cashback: 5 },
  vip: { label: 'VIP', color: 'text-yellow-500', cashback: 10 },
};

const TYPE_LABELS: Record<string, { label: string; icon: 'up' | 'down' | 'gift' }> = {
  earn_visit: { label: 'За визит', icon: 'up' },
  earn_review: { label: 'За отзыв', icon: 'up' },
  earn_birthday: { label: 'День рождения', icon: 'gift' },
  earn_referral: { label: 'Реферал', icon: 'gift' },
  earn_streak: { label: 'Стрик-бонус', icon: 'gift' },
  spend: { label: 'Списание', icon: 'down' },
  expire: { label: 'Сгорание', icon: 'down' },
};

const EMOJI_MAP = {
  up: '⬆️',
  down: '⬇️',
  gift: '🎁',
} as const;

export default function LoyaltyHistory() {
  const { masterId } = useParams<{ masterId: string }>();

  const { data: balance, isLoading: balLoading } = useQuery<LoyaltyBalance>({
    queryKey: ['loyalty-balance', masterId],
    queryFn: () => loyaltyApi.getBalance(Number(masterId)).then((r) => r.data),
    enabled: !!masterId,
  });

  const { data: history, isLoading: histLoading } = useQuery<LoyaltyTx[]>({
    queryKey: ['loyalty-history', masterId],
    queryFn: () => loyaltyApi.getHistory(Number(masterId)).then((r) => r.data),
    enabled: !!masterId,
  });

  if (balLoading || histLoading) return <div className="px-screen-x py-section-y"><ListSkeleton count={4} /></div>;

  const tier = balance ? TIER_CONFIG[balance.tier] ?? TIER_CONFIG.new : TIER_CONFIG.new;

  return (
    <div className="px-screen-x py-section-y pb-24 animate-fade-in">
      <BackButton />

      <h1 className="text-h1 mb-section-y">Программа лояльности</h1>

      {balance && (
        <>
          <Card className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-3xl font-bold">{balance.balance}</div>
                <div className="text-sm text-tg-hint">доступных баллов</div>
              </div>
              <div className="text-right">
                <div className={`flex items-center gap-1 font-medium ${tier.color}`}>
                  {'⭐'} {tier.label}
                </div>
                <div className="text-xs text-tg-hint">кешбэк {tier.cashback}%</div>
              </div>
            </div>
            <div className="bg-tg-secondary rounded-card p-2.5 text-center">
              <span className="text-xs text-tg-hint">
                Всего заработано: <span className="font-medium text-tg-text">{balance.total_earned}</span>
              </span>
            </div>
          </Card>

          {/* Streak */}
          {balance.streak_threshold && (
            <Card className="mb-4 !bg-[#FF9500]/10 border border-[#FF9500]/20">
              <div className="flex items-center gap-3">
                <span className="text-[24px]">{'🔥'}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    Серия визитов: {balance.streak_count || 0}/{balance.streak_threshold}
                  </div>
                  <div className="text-xs text-tg-hint">
                    {(balance.streak_count || 0) >= balance.streak_threshold
                      ? `Стрик выполнен! +${balance.streak_bonus} баллов`
                      : `Ещё ${balance.streak_threshold - (balance.streak_count || 0)} визит(а) до бонуса +${balance.streak_bonus}`}
                  </div>
                </div>
              </div>
              <div className="mt-2 w-full bg-[#FF9500]/20 rounded-full h-1.5">
                <div
                  className="bg-[#FF9500] h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(((balance.streak_count || 0) / balance.streak_threshold) * 100, 100)}%` }}
                />
              </div>
            </Card>
          )}
        </>
      )}

      <h2 className="text-h3 mb-2">История баллов</h2>

      {!history || history.length === 0 ? (
        <EmptyState emoji="📜" title="Нет операций" />
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((tx) => {
            const config = TYPE_LABELS[tx.type] ?? { label: tx.type, icon: 'up' as const };
            const isPositive = tx.points > 0;
            return (
              <Card key={tx.id} className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isPositive ? 'bg-status-success/15' : 'bg-status-danger/15'
                  }`}
                >
                  <span className="text-[16px]">{EMOJI_MAP[config.icon]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{config.label}</div>
                  {tx.note && (
                    <div className="text-xs text-tg-hint truncate">{tx.note}</div>
                  )}
                </div>
                <span
                  className={`font-bold text-body ${isPositive ? 'text-status-success' : 'text-status-danger'}`}
                >
                  {isPositive ? '+' : ''}{tx.points}
                </span>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
