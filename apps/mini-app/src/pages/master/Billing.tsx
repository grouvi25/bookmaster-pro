import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { billingApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';
import { ArrowLeft, Check, Crown, Zap, Sparkles, Rocket, Building2 } from 'lucide-react';
import PageHeader from '@/shared/ui/PageHeader';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface Plan {
  key: string;
  name: string;
  price: number;
  Icon: LucideIcon;
  color: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    key: 'start',
    name: 'Старт',
    price: 590,
    Icon: Zap,
    color: 'text-blue-500',
    features: [
      'До 30 записей/мес',
      'Онлайн-запись',
      'Уведомления',
      'Промокоды',
    ],
  },
  {
    key: 'basic',
    name: 'Базовый',
    price: 990,
    Icon: Crown,
    color: 'text-brand-500',
    features: [
      'До 100 записей/мес',
      'CRM-модуль',
      'Аналитика',
      'Лояльность',
      'Рассылки',
    ],
  },
  {
    key: 'pro',
    name: 'Про',
    price: 1990,
    Icon: Sparkles,
    color: 'text-purple-500',
    features: [
      'Без лимита записей',
      'AI-советник',
      'Голосовой ввод',
      'Портфолио',
      'Абонементы',
      'Консультации',
    ],
  },
  {
    key: 'pro_ai',
    name: 'Про + AI',
    price: 2990,
    Icon: Rocket,
    color: 'text-orange-500',
    features: [
      'Все фичи Про',
      'AI контент-мастер',
      'AI клиентский бот',
      'Голосовой дневник',
      'RAG по базе знаний',
    ],
  },
  {
    key: 'business',
    name: 'Бизнес',
    price: 4990,
    Icon: Building2,
    color: 'text-emerald-600',
    features: [
      'Все фичи Про+AI',
      'Мульти-локации',
      'Виджет для сайта',
      'Приоритетная поддержка',
      'Персональный менеджер',
    ],
  },
];

export default function Billing() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => billingApi.current().then((r) => r.data),
  });

  const subscribeMutation = useMutation({
    mutationFn: (data: { plan: string; billing_period: string }) =>
      billingApi.subscribe(data),
    onSuccess: (resp) => {
      const data = resp.data;
      if (data.confirmation_url) {
        window.location.href = data.confirmation_url;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast.success('Подписка оформлена!');
      setSelectedPlan(null);
    },
    onError: () => {
      toast.error('Ошибка оформления подписки');
    },
  });

  if (isLoading) return <Loading />;

  const currentPlan = subscription?.plan || null;
  const yearlyDiscount = 0.8;

  const handleSubscribe = (planKey: string) => {
    subscribeMutation.mutate({
      plan: planKey,
      billing_period: billingPeriod,
    });
  };

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text pb-24 animate-fade-in">
      <PageHeader
        title="Тарифы и подписка"
        left={
          <button onClick={() => navigate('/master/settings')} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
        }
      />

      <div className="px-screen-x">
      <p className="text-tg-hint text-sm mb-5">Выберите подходящий тариф</p>

      {currentPlan && (
        <Card className="mb-5 !bg-brand-500/10 border border-brand-500/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-brand-600 font-medium">Текущий тариф</div>
              <div className="font-bold text-lg text-brand-700 capitalize">
                {PLANS.find((p) => p.key === currentPlan)?.name || currentPlan}
              </div>
            </div>
            <div className="text-sm text-tg-hint">
              {subscription?.status === 'active' ? 'Активен' : subscription?.status}
            </div>
          </div>
          {subscription?.next_billing && (
            <div className="text-xs text-tg-hint mt-2">
              Следующее списание: {new Date(subscription.next_billing).toLocaleDateString('ru-RU')}
            </div>
          )}
        </Card>
      )}

      {/* Billing period toggle */}
      <div className="flex bg-tg-secondary rounded-btn p-1 mb-5">
        {(['monthly', 'yearly'] as const).map((period) => (
          <button
            key={period}
            onClick={() => setBillingPeriod(period)}
            className={clsx(
              'flex-1 py-2 rounded-xl text-sm font-semibold transition-all',
              billingPeriod === period
                ? 'bg-tg-bg text-tg-text'
                : 'text-tg-hint'
            )}
          >
            {period === 'monthly' ? 'Ежемесячно' : 'Годовой −20%'}
          </button>
        ))}
      </div>

      {/* Plans */}
      <div className="flex flex-col gap-3">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.key;
          const price = billingPeriod === 'yearly'
            ? Math.round(plan.price * yearlyDiscount)
            : plan.price;

          return (
            <Card
              key={plan.key}
              className={clsx(
                'transition-all',
                isCurrent && 'ring-2 ring-brand-500',
                selectedPlan === plan.key && !isCurrent && 'ring-2 ring-brand-300'
              )}
              onClick={() => !isCurrent && setSelectedPlan(plan.key)}
            >
              <div className="flex items-start gap-3">
                <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', `${plan.color.replace('text-', 'bg-')}/10`)}>
                  <plan.Icon className={clsx('w-5 h-5', plan.color)} strokeWidth={1.8} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-bold">{plan.name}</div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{price.toLocaleString('ru')} ₽</div>
                      <div className="text-2xs text-tg-hint">
                        / {billingPeriod === 'yearly' ? 'мес (годовой)' : 'мес'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-center gap-1.5 text-xs text-tg-hint">
                        <Check className="w-3 h-3 text-accent-emerald flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                  {isCurrent && (
                    <div className="mt-2 text-xs text-brand-600 font-medium">Текущий тариф</div>
                  )}
                </div>
              </div>

              {selectedPlan === plan.key && !isCurrent && (
                <div className="mt-3 pt-3 border-t border-tg-secondary">
                  <Button
                    onClick={() => handleSubscribe(plan.key)}
                    loading={subscribeMutation.isPending}
                    fullWidth
                    size="sm"
                  >
                    {currentPlan ? 'Сменить тариф' : 'Подключить'}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      </div>
    </div>
  );
}
