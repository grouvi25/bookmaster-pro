import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promoApi, loyaltyApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { useAuthStore } from '@/stores/auth';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import PageHeader from '@/shared/ui/PageHeader';
import ChipTabs from '@/shared/ui/ChipTabs';
import EmptyState from '@/shared/ui/EmptyState';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import type { Promo, LoyaltyTransaction } from '@/shared/types/api';
import FeatureGate from '@/shared/ui/FeatureGate';

type ToolsTab = 'promo' | 'loyalty';

const TABS: { key: ToolsTab; label: string; emoji?: string }[] = [
  { key: 'promo', label: 'Промокоды', emoji: '🎫' },
  { key: 'loyalty', label: 'Лояльность', emoji: '⭐' },
];

export default function Tools() {
  const [tab, setTab] = useState<ToolsTab>('promo');

  return (
    <div className="px-screen-x py-section-y pb-24 screen-enter">
      <PageHeader title="Инструменты" />

      <div className="mb-section-y">
        <ChipTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'promo' ? (
        <PromoSection />
      ) : (
        <FeatureGate flag="loyalty_enabled">
          <LoyaltySection />
        </FeatureGate>
      )}
    </div>
  );
}

function PromoSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['promos'],
    queryFn: () => promoApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { code: string; discount_percent?: number; discount_amount?: number }) =>
      promoApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promos'] });
      setShowForm(false);
      setCode('');
      setDiscount('');
    },
  });

  if (isLoading) return <div className="px-screen-x"><ListSkeleton count={3} /></div>;

  const promos = toArray<Promo>(data);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-h3">Активные промокоды</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-tg-link text-body interactive"
        >
          {showForm ? 'Отмена' : '➕ Создать'}
        </button>
      </div>

      {showForm && (
        <Card className="mb-3 screen-enter">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Код (например WELCOME)"
            className="input-field mb-2"
          />
          <input
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="Скидка (10% или 500)"
            className="input-field mb-2"
          />
          <Button
            onClick={() =>
              createMutation.mutate({
                code,
                discount_percent: discount.includes('%')
                  ? parseInt(discount)
                  : undefined,
                discount_amount: !discount.includes('%')
                  ? parseInt(discount)
                  : undefined,
              })
            }
            disabled={!code || !discount}
            fullWidth
            size="sm"
          >
            Создать
          </Button>
        </Card>
      )}

      {promos.length === 0 ? (
        <EmptyState emoji={'🏷️'} title="Нет активных промокодов" />
      ) : (
        <div className="flex flex-col gap-card-gap">
          {promos.map((p) => (
            <Card key={p.id} className="flex justify-between items-center">
              <div>
                <div className="font-mono font-bold text-body">{p.code}</div>
                <div className="text-aux text-tg-hint">
                  Использований: {p.usage_count ?? p.used_count ?? 0}
                  {p.max_uses ? ` / ${p.max_uses}` : null}
                </div>
              </div>
              <div className="font-medium text-tg-link text-body">
                {p.discount_percent
                  ? `-${p.discount_percent}%`
                  : `-${Number(p.discount_amount ?? p.discount_value).toLocaleString('ru')} ₽`}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LoyaltySection() {
  const { masterId } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['loyalty-history', masterId],
    queryFn: () => loyaltyApi.getHistory(masterId!).then((r) => r.data),
    enabled: !!masterId,
  });

  if (isLoading) return <div className="px-screen-x"><ListSkeleton count={3} /></div>;

  const history = toArray<LoyaltyTransaction>(data);

  return (
    <div>
      <Card className="mb-4">
        <div className="text-body text-tg-text mb-1">{'⭐'} Программа лояльности</div>
        <p className="text-aux text-tg-hint">
          Клиенты получают баллы за каждый визит и могут оплачивать ими услуги.
        </p>
      </Card>

      {history.length === 0 ? (
        <EmptyState emoji={'⭐'} title="История начислений пуста" />
      ) : (
        <div className="flex flex-col gap-card-gap">
          {history.map((h) => (
            <Card key={h.id} className="flex justify-between items-center">
              <div>
                <div className="text-body font-medium">{h.description}</div>
                <div className="text-aux text-tg-hint">{h.type}</div>
              </div>
              <span className={`font-bold text-body ${h.amount > 0 ? 'text-status-success' : 'text-status-danger'}`}>
                {h.amount > 0 ? '+' : ''}{h.amount}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
