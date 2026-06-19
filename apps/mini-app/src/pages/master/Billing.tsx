import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeaderBackButton } from "@/components/common/BackButton";
import { billingApi } from '@/api/endpoints';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';
import { Check, Crown, Zap, Sparkles, Rocket, Building2, Clock, CreditCard, ChevronRight, RefreshCw, XCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import PageHeader from '@/shared/ui/PageHeader';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useFeatureFlags } from '@/hooks/useFeatureFlag';
import { useNavigate, Link } from 'react-router-dom';

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

export default function Billing() {
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const { flags } = useFeatureFlags();
  const navigate = useNavigate();

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

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const cancelAutoRenewMutation = useMutation({
    mutationFn: () => billingApi.cancelAutoRenew(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      toast.success('Автопродление отключено');
      setShowCancelConfirm(false);
    },
    onError: () => {
      toast.error('Не удалось отключить автопродление');
    },
  });

  const resumeAutoRenewMutation = useMutation({
    mutationFn: () => billingApi.resumeAutoRenew(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      toast.success('Автопродление включено');
    },
    onError: () => {
      toast.error('Не удалось включить автопродление');
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: (data: { plan: string; billing_period: string }) =>
      billingApi.subscribe(data),
    onSuccess: (resp) => {
      const data = resp.data;
      if (data.confirmation_url) {
        // MAX desktop webview: YooMoney блокирует загрузку внутри webview (X-Frame-Options)
        // Открываем в новой вкладке/системном браузере
        const w = window as unknown as Record<string, unknown>;
        if (w.WebApp && !(w as { Telegram?: unknown }).Telegram) {
          window.open(data.confirmation_url, '_blank');
        } else {
          window.location.href = data.confirmation_url;
        }
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'], refetchType: 'all' });
      toast.success('Подписка оформлена!');
      setSelectedPlan(null);
      setConfirmPlan(null);
    },
    onError: () => {
      toast.error('Ошибка оформления подписки');
    },
  });

  if (isLoading) return <div className="px-screen-x py-section-y"><ListSkeleton count={4} /></div>;

  const currentPlan = subscription?.plan || null;
  const yearlyDiscount = 0.8;
  const currentCommission = PLANS.find((p) => p.key === currentPlan)?.commission ?? 7;
  const trial = flags.trial;
  // Плашку пробного периода показываем только пока нет купленной подписки
  // (первый вход / триал). После покупки тарифа — скрываем.
  const isTrialActive =
    !currentPlan && !!trial?.is_trial && (trial?.grant_days_left ?? 0) >= 0;
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

      {/* Приём оплаты — настраивается на отдельном экране */}
      <Card
        onClick={() => navigate('/master/settings?tab=payments')}
        className="mb-5 cursor-pointer active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-brand-500" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">Приём оплаты от клиентов</div>
            <div className="text-xs text-tg-hint mt-0.5">
              Онлайн-оплата, свой счёт ЮKassa · комиссия {currentCommission}%
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-tg-hint flex-shrink-0" />
        </div>
      </Card>

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
                    onClick={() => setConfirmPlan(plan.key)}
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

      {/* ── Управление подпиской ── */}
      {currentPlan && subscription && (
        <div className="mt-6 mb-8">
          <div className="text-xs text-tg-hint font-medium uppercase tracking-wider mb-3">
            Управление подпиской
          </div>
          <Card>
            <div className="flex items-center gap-3">
              <div className={clsx(
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                subscription.auto_renew !== false
                  ? 'bg-accent-emerald/10'
                  : 'bg-red-500/10'
              )}>
                <RefreshCw className={clsx(
                  'w-5 h-5',
                  subscription.auto_renew !== false
                    ? 'text-accent-emerald'
                    : 'text-red-500'
                )} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">Автопродление</div>
                <div className="text-xs text-tg-hint mt-0.5">
                  {subscription.auto_renew !== false
                    ? `Включено · следующее списание ${new Date(subscription.next_billing).toLocaleDateString('ru-RU')}`
                    : `Отключено · подписка активна до ${new Date(subscription.next_billing).toLocaleDateString('ru-RU')}`
                  }
                </div>
              </div>
            </div>

            {subscription.auto_renew !== false ? (
              <>
                {!showCancelConfirm ? (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="mt-3 w-full py-2.5 text-sm text-red-500 hover:text-red-600 font-medium rounded-xl border border-red-200 hover:bg-red-50 transition-all"
                  >
                    Отключить автопродление
                  </button>
                ) : (
                  <div className="mt-3 pt-3 border-t border-tg-secondary">
                    <div className="flex items-start gap-2 mb-3">
                      <XCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-tg-hint leading-relaxed">
                        После отключения подписка останется активной до{' '}
                        <span className="font-medium text-tg-text">
                          {new Date(subscription.next_billing).toLocaleDateString('ru-RU')}
                        </span>
                        . Автоматическое списание больше не будет происходить. Вы сможете
                        включить автопродление обратно в любой момент.
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => cancelAutoRenewMutation.mutate()}
                        loading={cancelAutoRenewMutation.isPending}
                        fullWidth
                        size="sm"
                        className="!bg-red-500 hover:!bg-red-600"
                      >
                        Подтвердить отключение
                      </Button>
                      <Button
                        onClick={() => setShowCancelConfirm(false)}
                        fullWidth
                        size="sm"
                        className="!bg-tg-secondary !text-tg-text"
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Button
                onClick={() => resumeAutoRenewMutation.mutate()}
                loading={resumeAutoRenewMutation.isPending}
                fullWidth
                size="sm"
                className="mt-3"
              >
                Включить автопродление
              </Button>
            )}
          </Card>
        </div>
      )}
      </div>

      {/* ── Экран подтверждения покупки ── */}
      {confirmPlan && (() => {
        const plan = PLANS.find((p) => p.key === confirmPlan);
        if (!plan) return null;
        const price = billingPeriod === 'yearly'
          ? Math.round(plan.price * yearlyDiscount)
          : plan.price;
        const totalYearly = billingPeriod === 'yearly' ? price * 12 : null;
        const isUpgrade = !!currentPlan;
        const currentPlanObj = PLANS.find((p) => p.key === currentPlan);

        return (
          <div className="fixed inset-0 z-50 bg-tg-bg flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-screen-x py-3 border-b border-tg-secondary">
              <button
                onClick={() => setConfirmPlan(null)}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-tg-secondary active:scale-95 transition-transform"
              >
                <ArrowLeft className="w-5 h-5 text-tg-text" />
              </button>
              <div className="font-bold text-lg">Подтверждение</div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-screen-x py-5">
              {/* Plan hero card */}
              <div className="text-center mb-5">
                <div className={clsx(
                  'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3',
                  `${plan.color.replace('text-', 'bg-')}/10`
                )}>
                  <plan.Icon className={clsx('w-8 h-8', plan.color)} strokeWidth={1.5} />
                </div>
                <div className="font-bold text-xl">{plan.name}</div>
                <div className="text-tg-hint text-sm mt-1">
                  {isUpgrade
                    ? `Смена тарифа${currentPlanObj ? ` с «${currentPlanObj.name}»` : ''}`
                    : 'Подключение тарифа'}
                </div>
              </div>

              {/* Price breakdown */}
              <Card className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-tg-hint">Тариф</div>
                  <div className="font-bold">{plan.name}</div>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-tg-hint">Период</div>
                  <div className="font-semibold">
                    {billingPeriod === 'yearly' ? 'Годовой (−20%)' : 'Ежемесячный'}
                  </div>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-tg-hint">Стоимость</div>
                  <div className="font-bold text-lg">
                    {price.toLocaleString('ru')} ₽ / мес
                  </div>
                </div>
                {totalYearly && (
                  <div className="flex items-center justify-between pt-3 border-t border-tg-secondary/50">
                    <div className="text-sm text-tg-hint">Итого за год</div>
                    <div className="font-bold text-lg">
                      {totalYearly.toLocaleString('ru')} ₽
                    </div>
                  </div>
                )}
              </Card>

              {/* What's included */}
              <div className="text-xs text-tg-hint font-medium uppercase tracking-wider mb-3">
                Что входит в тариф
              </div>
              <Card className="mb-4">
                <div className="flex flex-col gap-2.5">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-accent-emerald/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-accent-emerald" strokeWidth={2.5} />
                      </div>
                      <span className="text-sm">{f}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-accent-emerald/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-accent-emerald" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm">Комиссия онлайн-оплат: {plan.commission}%</span>
                  </div>
                </div>
              </Card>

              {/* Security note */}
              <div className="flex items-start gap-2.5 px-1 mb-6">
                <ShieldCheck className="w-4 h-4 text-accent-emerald flex-shrink-0 mt-0.5" />
                <div className="text-xs text-tg-hint leading-relaxed">
                  Безопасная оплата через ЮKassa. Вы будете перенаправлены на страницу платёжной системы.
                  Подписка продлевается автоматически, отменить можно в любой момент.
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="px-screen-x pb-6 pt-3 border-t border-tg-secondary flex flex-col gap-2.5">
              <p className="text-[11px] text-tg-hint text-center">
                Оплачивая, вы соглашаетесь с{' '}
                <Link to="/legal/terms" className="text-tg-link underline">
                  условиями сервиса
                </Link>{' '}
                и{' '}
                <Link to="/legal/payment" className="text-tg-link underline">
                  условиями оплаты и возврата
                </Link>
              </p>
              <Button
                onClick={() => {
                  handleSubscribe(confirmPlan);
                }}
                loading={subscribeMutation.isPending}
                fullWidth
                size="lg"
              >
                Перейти к оплате · {price.toLocaleString('ru')} ₽
              </Button>
              <Button
                onClick={() => setConfirmPlan(null)}
                variant="ghost"
                fullWidth
              >
                Назад к тарифам
              </Button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
