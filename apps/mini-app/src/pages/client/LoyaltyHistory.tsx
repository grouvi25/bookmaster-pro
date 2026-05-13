import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { loyaltyApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import Card from '@/shared/ui/Card';
import { ChevronLeft, Star, TrendingUp, TrendingDown, Gift } from 'lucide-react';

interface LoyaltyBalance {
  master_id: number;
  client_id: number;
  balance: number;
  tier: string;
  total_earned: number;
}

interface LoyaltyTransaction {
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
  spend: { label: 'Списание', icon: 'down' },
  expire: { label: 'Сгорание', icon: 'down' },
};

export default function LoyaltyHistory() {
  const { masterId } = useParams<{ masterId: string }>();
  const navigate = useNavigate();

  const { data: balance, isLoading: balLoading } = useQuery<LoyaltyBalance>({
    queryKey: ['loyalty-balance', masterId],
    queryFn: () => loyaltyApi.getBalance(Number(masterId)).then((r) => r.data),
    enabled: !!masterId,
  });

  const { data: history, isLoading: histLoading } = useQuery<LoyaltyTransaction[]>({
    queryKey: ['loyalty-history', masterId],
    queryFn: () => loyaltyApi.getHistory(Number(masterId)).then((r) => r.data),
    enabled: !!masterId,
  });

  if (balLoading || histLoading) return <Loading />;

  const tier = balance ? TIER_CONFIG[balance.tier] ?? TIER_CONFIG.new : TIER_CONFIG.new;

  return (
    <div className="p-5 pb-24 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-0.5 text-tg-link text-sm mb-3"
      >
        <ChevronLeft className="w-4 h-4" /> Назад
      </button>

      <h1 className="text-2xl font-bold tracking-tight mb-5">Программа лояльности</h1>

      {balance && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-3xl font-bold">{balance.balance}</div>
              <div className="text-sm text-tg-hint">доступных баллов</div>
            </div>
            <div className="text-right">
              <div className={`flex items-center gap-1 font-medium ${tier.color}`}>
                <Star className="w-4 h-4" />
                {tier.label}
              </div>
              <div className="text-xs text-tg-hint">кешбэк {tier.cashback}%</div>
            </div>
          </div>
          <div className="bg-tg-secondary rounded-2xl p-2.5 text-center">
            <span className="text-xs text-tg-hint">
              Всего заработано: <span className="font-medium text-tg-text">{balance.total_earned}</span>
            </span>
          </div>
        </Card>
      )}

      <h2 className="font-bold text-sm mb-2">История баллов</h2>

      {!history || history.length === 0 ? (
        <p className="text-center text-sm text-tg-hint py-8">Нет операций</p>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((tx) => {
            const config = TYPE_LABELS[tx.type] ?? { label: tx.type, icon: 'up' as const };
            const isPositive = tx.points > 0;
            return (
              <Card key={tx.id} className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isPositive ? 'bg-green-500/15' : 'bg-red-500/15'
                  }`}
                >
                  {config.icon === 'gift' ? (
                    <Gift className="w-4 h-4 text-yellow-500" />
                  ) : isPositive ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{config.label}</div>
                  {tx.note && (
                    <div className="text-xs text-tg-hint truncate">{tx.note}</div>
                  )}
                </div>
                <span
                  className={`font-bold text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}
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
