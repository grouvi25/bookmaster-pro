
import { useQuery } from '@tanstack/react-query';
import { loyaltyApi } from '@/api/endpoints';
import { HeaderBackButton } from '@/components/common/BackButton';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import PageHeader from '@/shared/ui/PageHeader';
import EmptyState from '@/shared/ui/EmptyState';
import { Users, Gift, TrendingUp } from 'lucide-react';
interface ReferralItem {
  id: number;
  referrer_client: number;
  referrer_name: string;
  referred_client: number;
  referred_name: string;
  bonus_applied: number | null;
  created_at: string;
}

interface ReferralStats {
  total_referrals: number;
  total_bonus_given: number;
  referrals: ReferralItem[];
}

export default function ReferralProgram() {

  const { data: stats, isLoading } = useQuery<ReferralStats>({
    queryKey: ['referral-stats'],
    queryFn: () => loyaltyApi.getReferralStats().then((r: { data: ReferralStats }) => r.data),
  });

  const { data: settings } = useQuery({
    queryKey: ['loyalty-settings'],
    queryFn: () => loyaltyApi.getSettings().then((r: { data: { referral_bonus: number } }) => r.data),
  });

  const referralBonus = settings?.referral_bonus ?? 500;
  if (isLoading) {
    return (
      <div className="px-screen-x py-section-y">
        <PageHeader title="Реферальная программа" left={<HeaderBackButton to="/master/tools" />} />
        <ListSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="px-screen-x pb-8">
      <PageHeader
        title="Реферальная программа"
        left={<HeaderBackButton to="/master/tools" />}
      />

      <p className="text-tg-hint text-sm mb-5">
        Клиенты приглашают друзей по реферальной ссылке и получают бонусные баллы.
      </p>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-tg-hint">Приглашено</span>
          </div>
          <div className="font-bold text-2xl">{stats?.total_referrals ?? 0}</div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-4 h-4 text-accent-emerald" />
            <span className="text-xs text-tg-hint">Баллов выдано</span>
          </div>
          <div className="font-bold text-2xl">{stats?.total_bonus_given ?? 0}</div>
        </Card>
      </div>

      {/* How it works */}
      <Card className="mb-5">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-brand-500" />
          Как это работает
        </h3>
        <div className="flex flex-col gap-2.5 text-sm text-tg-hint">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-500">1</span>
            <span>Клиент открывает свой профиль лояльности у вас</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-500">2</span>
            <span>Копирует персональную реферальную ссылку</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-500">3</span>
            <span>Друг переходит по ссылке и записывается</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-500">4</span>
            <span>Пригласивший получает <strong className="text-tg-text">{referralBonus} баллов</strong></span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-tg-secondary">
          <div className="text-xs text-tg-hint">
            Размер бонуса настраивается в{' '}
            <a href="/master/loyalty-settings" className="text-brand-500 hover:underline">
              настройках лояльности
            </a>
          </div>
        </div>
      </Card>

      {/* Referral list */}
      <h2 className="font-bold text-base mb-3">История приглашений</h2>

      {!stats?.referrals?.length ? (
        <EmptyState
          emoji="👥"
          title="Пока нет рефералов"
          description="Когда клиенты начнут приглашать друзей, здесь появится статистика"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {stats.referrals.map((ref) => (
            <Card key={ref.id}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">
                    {ref.referrer_name} → {ref.referred_name}
                  </div>
                  <div className="text-xs text-tg-hint mt-0.5">
                    {new Date(ref.created_at).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                {ref.bonus_applied ? (
                  <div className="text-sm font-bold text-accent-emerald">
                    +{ref.bonus_applied} ⭐
                  </div>
                ) : (
                  <div className="text-xs text-tg-hint">Ожидание</div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
