import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { subscriptionsApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import Card from '@/shared/ui/Card';
import SectionBack from '@/shared/ui/SectionBack';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import { CreditCard } from 'lucide-react';

interface ClientSubscription {
  id: number;
  master_id: number;
  client_id: number;
  service_id: number | null;
  total_visits: number;
  used_visits: number;
  price_paid: number;
  status: string;
  expires_at: string | null;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  exhausted: 'warning',
  expired: 'danger',
  refunded: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Активен',
  exhausted: 'Использован',
  expired: 'Истёк',
  refunded: 'Возврат',
};

export default function Subscriptions() {
  const navigate = useNavigate();

  const { data: subs, isLoading } = useQuery<ClientSubscription[]>({
    queryKey: ['client-subscriptions'],
    queryFn: () => subscriptionsApi.list().then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  const subscriptions = subs ?? [];
  const active = subscriptions.filter((s) => s.status === 'active');
  const past = subscriptions.filter((s) => s.status !== 'active');

  return (
    <div className="px-screen-x pt-section-y pb-24 animate-fade-in">
      <SectionBack onBack={() => navigate(-1)} />

      <h1 className="text-2xl font-bold tracking-tight mb-5">
        <CreditCard className="w-5 h-5 inline mr-1.5" />
        Мои абонементы
      </h1>

      {subscriptions.length === 0 ? (
        <EmptyState
          emoji="💳"
          title="Нет абонементов"
          description="Абонементы появятся после покупки у мастера"
        />
      ) : (
        <>
          {active.length > 0 && (
            <>
              <h2 className="font-medium text-sm text-tg-hint mb-2">Активные</h2>
              <div className="flex flex-col gap-2 mb-4">
                {active.map((sub) => (
                  <SubscriptionCard key={sub.id} sub={sub} />
                ))}
              </div>
            </>
          )}
          {past.length > 0 && (
            <>
              <h2 className="font-medium text-sm text-tg-hint mb-2">Завершённые</h2>
              <div className="flex flex-col gap-2">
                {past.map((sub) => (
                  <SubscriptionCard key={sub.id} sub={sub} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SubscriptionCard({ sub }: { sub: ClientSubscription }) {
  const remaining = sub.total_visits - sub.used_visits;
  const progress = sub.total_visits > 0 ? (sub.used_visits / sub.total_visits) * 100 : 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <StatusBadge
          label={STATUS_LABEL[sub.status] || sub.status}
          variant={STATUS_VARIANT[sub.status] || 'neutral'}
        />
        <span className="text-sm font-bold">{Number(sub.price_paid).toLocaleString('ru')} ₽</span>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-xs text-tg-hint mb-1">
          <span>Использовано {sub.used_visits} из {sub.total_visits}</span>
          <span>Осталось: {remaining}</span>
        </div>
        <div className="w-full bg-tg-secondary rounded-full h-2">
          <div
            className="bg-brand-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {sub.expires_at && (
        <div className="text-xs text-tg-hint">
          До {new Date(sub.expires_at).toLocaleDateString('ru-RU')}
        </div>
      )}
    </Card>
  );
}
