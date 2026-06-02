import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeaderBackButton } from "@/components/common/BackButton";
import { billingApi, mastersApi } from '@/api/endpoints';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';
import { Check, Crown, Zap, Sparkles, Rocket, Building2, Clock } from 'lucide-react';
import PageHeader from '@/shared/ui/PageHeader';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useFeatureFlags } from '@/hooks/useFeatureFlag';

interface Plan {
  key: string;
  name: string;
  price: number;
  Icon: LucideIcon;
  color: string;
  commission: number;
  features: string[];
  trial_days?: number;
}

const PLANS: Plan[] = [
  {
    key: 'start',
    name: 'Старт',
    price: 590,
    Icon: Zap,
    color: 'text-status-info',
    commission: 7,
    features: [
      'До 30 записей/мес',
      'До 3 услуг',
      'Онлайн-запись клиентов',
      'Автонапоминания (24ч + 2ч)',
      'Страница-визитка + QR-код',
    ],
    trial_days: 14,
  },
  {
    key: 'basic',
    name: 'Базовый',
    price: 990,
    Icon: Crown,
    color: 'text-brand-500',
    commission: 7,
    features: [
      'До 150 записей/мес',
      'До 10 услуг',
      'CRM — карточки клиентов',
      'Отзывы и рейтинг',
      'Промо-акции и скидки',
      'Лист ожидания',
      'Маркетплейс + виджет',
    ],
  },
  {
    key: 'pro',
    name: 'Про',
    price: 1990,
    Icon: Sparkles,
    color: 'text-purple-500',
    commission: 6,
    features: [
      'Без лимита записей и услуг',
      'CRM расширенный + сегменты',
      'Программа лояльности',
      'Абонементы клиентов',
      'Аналитика и дашборд',
      'AI-советник (чат)',
      'Портфолио и консультации',
      'До 2 локаций · 200K AI-токенов',
    ],
  },
  {
    key: 'pro_ai',
    name: 'Про + AI',
    price: 2990,
    Icon: Rocket,
    color: 'text-orange-500',
    commission: 5.5,
    features: [
      'Всё из Про',
      'AI-клиентский бот',
      'AI-контент (посты, FAQ, отзывы)',
      'Голосовой дневник',
      'Рассылки по сегментам',
      'До 3 локаций · 1M AI-токенов',
    ],
  },
  {
    key: 'business',
    name: 'Бизнес',
    price: 4990,
    Icon: Building2,
    color: 'text-emerald-600',
    commission: 5,
    features: [
      'Всё из Про + AI',
      'Featured в маркетплейсе',
      'Безлимит локаций · 3M AI-токенов',
      'Персональный менеджер',
    ],
  },
];

function PaymentModeCard({ commission }: { commission: number }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data: profile } = useQuery({
    queryKey: ['master-profile'],
    queryFn: () => mastersApi.getProfile().then((r) => r.data),
  });

  const enabled = !!profile?.accept_online_payment;

  const toggle = async () => {
    setSaving(true);
    try {
      await mastersApi.updateProfile({ accept_online_payment: !enabled });
      await queryClient.invalidateQueries({ queryKey: ['master-profile'] });
      toast.success(enabled ? 'Онлайн-оплата выключена' : 'Онлайн-оплата включена');
    } catch {
      toast.error('Не удалось изменить режим оплаты');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">Онлайн-оплата от клиентов</div>
          <div className="text-xs text-tg-hint mt-0.5">
            {enabled
              ? 'Включена — клиенты платят картой при записи'
              : 'Выключена — клиенты платят вам лично (наличные, перевод, СБП)'}
          </div>
          {enabled && (
            <div className="text-xs text-orange-600 mt-1">
              Комиссия сервиса: {commission}%
            </div>
          )}
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={clsx(
            'relative w-12 h-6 rounded-full transition-colors flex-shrink-0',
            enabled ? 'bg-brand-500' : 'bg-gray-300',
            saving && 'opacity-60'
          )}
          aria-label="Переключить онлайн-оплату"
        >
          <div
            className={clsx(
              'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
              enabled ? 'translate-x-6' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
      <div className="text-2xs text-tg-hint mt-2 leading-relaxed">
        Без онлайн-оплаты комиссия сервиса 0% — платите только абонемент. Для приёма
        картой нужна регистрация ИП/самозанятости и верификация в ЮKassa.
      </div>
    </Card>
  );
}

export default function Billing() {
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: async () => {
      try {
        const resp = await billingApi.current();
        return resp.data;
      } catch (err: unknown) {
        // 404 = нет активной подписки — это нормально
        if ((err as { response?: { status?: number } })?.response?.status === 404) {
          return null;
        }
        throw err;
      }
    },
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
      queryClient.invalidateQueries({ queryKey: ['feature-flags'], refetchType: 'all' });
      toast.success('Подписка оформлена!');
      setSelectedPlan(null);
    },
    onError: () => {
      toast.error('Ошибка оформления подписки');
    },
  });

  if (isLoading) return <div className="px-screen-x py-section-y"><ListSkeleton count={4} /></div>;

  const currentPlan = subscription?.plan || null;
  const yearlyDiscount = 0.8;
  const currentCommission = PLANS.find((p) => p.key === currentPlan)?.commission ?? 7;
  const { flags } = useFeatureFlags();
  const trial = flags.trial;
  const isTrialActive = !!trial?.is_trial && (trial?.grant_days_left ?? 0) >= 0;
  const trialPlanName = trial?.grant_plan ? (PLANS.find((p) => p.key === trial.grant_plan)?.name || trial.grant_plan) : null;

  const handleSubscribe = (planKey: string) => {
    subscribeMutation.mutate({
      plan: planKey,
      billing_period: billingPeriod,
    });
  };

  return (
    <div >
      <PageHeader
        title="Тарифы и подписка"
        left={<HeaderBackButton to="/master/settings" />}
      />

      <div className="px-screen-x">
      <p className="text-tg-hint text-sm mb-5">Выберите подходящий тариф</p>

      {isTrialActive && (
        <Card className="mb-5 !bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-orange-600 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Пробный период
              </div>
              <div className="font-bold text-lg text-orange-700">
                {trialPlanName ? `Тариф «${trialPlanName}»` : 'Активен'}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-lg text-orange-700">
                {trial?.grant_days_left ?? 0}
              </div>
              <div className="text-2xs text-tg-hint">
                {(() => {
                  const d = trial?.grant_days_left ?? 0;
                  const n = d % 100;
                  if (n >= 11 && n <= 14) return 'дней осталось';
                  const k = d % 10;
                  if (k === 1) return 'день остался';
                  if (k >= 2 && k <= 4) return 'дня осталось';
                  return 'дней осталось';
                })()}
              </div>
            </div>
          </div>
          {trial?.grant_valid_until && (
            <div className="text-xs text-tg-hint mt-2">
              Действует до: {new Date(trial.grant_valid_until).toLocaleDateString('ru-RU')}
            </div>
          )}
          <div className="text-2xs text-tg-hint mt-2 leading-relaxed">
            После окончания пробного периода выберите тариф ниже, иначе доступ
            переключится на «Старт».
          </div>
        </Card>
      )}

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

      {/* Режим монетизации: онлайн-оплата (Тариф A) vs абонемент (Тариф B) */}
      <PaymentModeCard commission={currentCommission} />

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
                    <div className="flex items-center gap-1.5 text-xs text-tg-hint">
                      <Check className="w-3 h-3 text-accent-emerald flex-shrink-0" />
                      Комиссия онлайн-оплат: {plan.commission}%
                    </div>
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
