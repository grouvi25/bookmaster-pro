import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { subscriptionsApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import Card from '@/shared/ui/Card';
import { ChevronLeft, CreditCard, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

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

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  active: { label: 'Активен', icon: CheckCircle, color: 'text-green-500' },
  exhausted: { label: 'Использован', icon: AlertCircle, color: 'text-yellow-500' },
  expired: { label: 'Истёк', icon: XCircle, color: 'text-red-400' },
  refunded: { label: 'Возврат', icon: XCircle, color: 'text-gray-400' },
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
    <div className="p-5 pb-24 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-0.5 text-tg-link text-sm mb-3"
      >
        <ChevronLeft className="w-4 h-4" /> Назад
      </button>

      <h1 className="text-2xl font-bold tracking-tight mb-5">
        <CreditCard className="w-5 h-5 inline mr-1.5" />
        Мои абонементы
      </h1>

      {subscriptions.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="w-12 h-12 text-tg-hint mx-auto mb-3" strokeWidth={1} />
          <p className="text-tg-hint mb-1">Нет абонементов</p>
          <p className="text-xs text-tg-hint">Абонементы появятся после покупки у мастера</p>
        </div>
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

function SubscriptionCard({ sub }: { sub: { id: number; total_visits: number; used_visits: number; price_paid: number; status: string; expires_at: string | null } }) {
  const config = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.active;
  const StatusIcon = config.icon;
  const remaining = sub.total_visits - sub.used_visits;
  const progress = sub.total_visits > 0 ? (sub.used_visits / sub.total_visits) * 100 : 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <StatusIcon className={`w-4 h-4 ${config.color}`} />
          <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
        </div>
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
