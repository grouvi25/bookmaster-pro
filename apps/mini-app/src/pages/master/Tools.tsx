import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promoApi, loyaltyApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import { Ticket, Star, Plus, Tag } from 'lucide-react';

export default function Tools() {
  const [tab, setTab] = useState<'promo' | 'loyalty'>('promo');

  return (
    <div className="p-4 pb-20 animate-fade-in">
      <h1 className="text-xl font-bold mb-3">Инструменты</h1>

      <div className="flex gap-2 mb-4">
        {[
          { key: 'promo' as const, label: 'Промокоды', Icon: Ticket },
          { key: 'loyalty' as const, label: 'Лояльность', Icon: Star },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-secondary text-tg-text'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
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
    mutationFn: (data: Record<string, unknown>) => promoApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promos'] });
      setShowForm(false);
      setCode('');
      setDiscount('');
    },
  });

  if (isLoading) return <Loading />;

  const promos = data?.items || [];

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
        <div className="bg-tg-secondary rounded-xl p-4 mb-3 animate-slide-up">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Код (например WELCOME)"
            className="w-full px-3 py-2 bg-white rounded-lg text-sm outline-none mb-2"
          />
          <input
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="Скидка (10% или 500)"
            className="w-full px-3 py-2 bg-white rounded-lg text-sm outline-none mb-2"
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
            className="w-full bg-tg-button text-tg-button-text py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Создать
          </button>
        </div>
      )}

      {promos.length === 0 ? (
        <div className="text-center py-6">
          <Tag className="w-8 h-8 text-tg-hint mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-tg-hint text-sm">Нет активных промокодов</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {promos.map((p: Record<string, unknown>) => (
            <div
              key={p.id as number}
              className="bg-tg-secondary rounded-xl p-3 flex justify-between items-center"
            >
              <div>
                <div className="font-mono font-bold text-sm">{String(p.code)}</div>
                <div className="text-xs text-tg-hint">
                  Использований: {Number(p.usage_count)}
                  {p.max_uses ? ` / ${Number(p.max_uses)}` : null}
                </div>
              </div>
              <div className="font-medium text-brand-600 text-sm">
                {p.discount_percent
                  ? `-${p.discount_percent}%`
                  : `-${Number(p.discount_amount).toLocaleString('ru')} \u20bd`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoyaltySection() {
  const { data, isLoading } = useQuery({
    queryKey: ['loyalty-history'],
    queryFn: () => loyaltyApi.getHistory().then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  const history = data?.items || [];

  return (
    <div>
      <div className="bg-brand-50 rounded-xl p-4 mb-4">
        <div className="text-sm text-brand-700 mb-1">Программа лояльности</div>
        <p className="text-xs text-brand-600">
          Клиенты получают баллы за каждый визит и могут оплачивать ими услуги.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-6">
          <Star className="w-8 h-8 text-tg-hint mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-tg-hint text-sm">История начислений пуста</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((h: Record<string, unknown>, i: number) => (
            <div key={i} className="bg-tg-secondary rounded-xl p-3 flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{h.client_name as string}</div>
                <div className="text-xs text-tg-hint">{h.reason as string}</div>
              </div>
              <span className={`font-bold text-sm ${(h.amount as number) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {(h.amount as number) > 0 ? '+' : ''}{h.amount as number}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
