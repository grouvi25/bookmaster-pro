import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promoApi, loyaltyApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { useAuthStore } from '@/stores/auth';
import Loading from '@/components/common/Loading';
import PageHeader from '@/shared/ui/PageHeader';
import ChipTabs from '@/shared/ui/ChipTabs';
import EmptyState from '@/shared/ui/EmptyState';
import { Ticket, Star, Plus, Tag } from 'lucide-react';
import type { Promo, LoyaltyTransaction } from '@/shared/types/api';

type ToolsTab = 'promo' | 'loyalty';

const TABS: { key: ToolsTab; label: string; Icon: typeof Ticket }[] = [
  { key: 'promo', label: 'Промокоды', Icon: Ticket },
  { key: 'loyalty', label: 'Лояльность', Icon: Star },
];

export default function Tools() {
  const [tab, setTab] = useState<ToolsTab>('promo');

  return (
    <div className="p-5 pb-24 animate-fade-in">
      <PageHeader title="Инструменты" />

      <div className="mb-5">
        <ChipTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'promo' ? <PromoSection /> : <LoyaltySection />}
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

  if (isLoading) return <Loading />;

  const promos = toArray<Promo>(data);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-medium">Активные промокоды</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-tg-link text-sm"
        >
          {showForm ? 'Отмена' : <><Plus className="w-4 h-4" /> Создать</>}
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-elevated shadow-card-lg rounded-2xl p-4 mb-3 animate-slide-up">
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
          <button
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
            className="w-full bg-brand-500 text-white py-2.5 rounded-xl text-sm font-semibold shadow-button disabled:opacity-40 active:scale-[0.97] transition-all"
          >
            Создать
          </button>
        </div>
      )}

      {promos.length === 0 ? (
        <EmptyState Icon={Tag} title="Нет активных промокодов" />
      ) : (
        <div className="flex flex-col gap-2">
          {promos.map((p) => (
            <div
              key={p.id}
              className="bg-surface-elevated shadow-card rounded-2xl p-3.5 flex justify-between items-center"
            >
              <div>
                <div className="font-mono font-bold text-sm">{p.code}</div>
                <div className="text-xs text-tg-hint">
                  Использований: {p.usage_count ?? p.used_count ?? 0}
                  {p.max_uses ? ` / ${p.max_uses}` : null}
                </div>
              </div>
              <div className="font-medium text-brand-600 text-sm">
                {p.discount_percent
                  ? `-${p.discount_percent}%`
                  : `-${Number(p.discount_amount ?? p.discount_value).toLocaleString('ru')} ₽`}
              </div>
            </div>
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

  if (isLoading) return <Loading />;

  const history = toArray<LoyaltyTransaction>(data);

  return (
    <div>
      <div className="bg-brand-500/10 rounded-xl p-4 mb-4">
        <div className="text-sm text-brand-700 mb-1">Программа лояльности</div>
        <p className="text-xs text-brand-600">
          Клиенты получают баллы за каждый визит и могут оплачивать ими услуги.
        </p>
      </div>

      {history.length === 0 ? (
        <EmptyState Icon={Star} title="История начислений пуста" />
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((h) => (
            <div key={h.id} className="bg-surface-elevated shadow-card rounded-2xl p-3.5 flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{h.description}</div>
                <div className="text-xs text-tg-hint">{h.type}</div>
              </div>
              <span className={`font-bold text-sm ${h.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {h.amount > 0 ? '+' : ''}{h.amount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
