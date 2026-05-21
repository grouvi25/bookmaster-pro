import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeaderBackButton } from "@/components/common/BackButton";
import { loyaltyApi } from '@/api/endpoints';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import PageHeader from '@/shared/ui/PageHeader';
import Button from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';
import { Star, Users, Gift, Clock, Percent, Edit3, Save, X } from 'lucide-react';

interface TierInfo {
  threshold: number;
  cashback_percent: number;
}

interface LoyaltySettingsData {
  tiers: Record<string, TierInfo>;
  points_expiry_months: number;
  streak_threshold: number;
  streak_bonus: number;
  referral_bonus: number;
  earn_rate: number;
  first_visit_bonus: number;
  review_bonus: number;
  birthday_bonus: number;
  max_spend_percent: number;
}

const TIER_ICONS: Record<string, string> = {
  new: '🌱',
  regular: '⭐',
  vip: '💎',
};

const TIER_NAMES: Record<string, string> = {
  new: 'Новый',
  regular: 'Постоянный',
  vip: 'VIP',
};

interface BonusFormState {
  earn_rate: string;
  first_visit_bonus: string;
  review_bonus: string;
  birthday_bonus: string;
  referral_bonus: string;
  max_spend_percent: string;
}

export default function LoyaltySettings() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BonusFormState>({
    earn_rate: '',
    first_visit_bonus: '',
    review_bonus: '',
    birthday_bonus: '',
    referral_bonus: '',
    max_spend_percent: '',
  });

  const { data: settings, isLoading } = useQuery<LoyaltySettingsData>({
    queryKey: ['loyalty-settings'],
    queryFn: () => loyaltyApi.getSettings().then((r) => r.data),
  });

  useEffect(() => {
    if (settings && !editing) {
      setForm({
        earn_rate: String(settings.earn_rate ?? 10),
        first_visit_bonus: String(settings.first_visit_bonus ?? 200),
        review_bonus: String(settings.review_bonus ?? 50),
        birthday_bonus: String(settings.birthday_bonus ?? 300),
        referral_bonus: String(settings.referral_bonus ?? 500),
        max_spend_percent: String(settings.max_spend_percent ?? 30),
      });
    }
  }, [settings, editing]);

  const saveMutation = useMutation({
    mutationFn: () =>
      loyaltyApi.updateSettings({
        earn_rate: Number(form.earn_rate) || 10,
        first_visit_bonus: Number(form.first_visit_bonus) || 0,
        review_bonus: Number(form.review_bonus) || 0,
        birthday_bonus: Number(form.birthday_bonus) || 0,
        referral_bonus: Number(form.referral_bonus) || 0,
        max_spend_percent: Math.max(0, Math.min(100, Number(form.max_spend_percent) || 30)),
      }),
    onSuccess: () => {
      toast.success('Настройки сохранены');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['loyalty-settings'] });
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  if (isLoading) return <div className="px-screen-x py-section-y"><ListSkeleton count={3} /></div>;
  if (!settings) return null;

  return (
    <div>
      <PageHeader
        title="Настройки лояльности"
        left={<HeaderBackButton to="/master/settings" />}
        right={
          editing ? (
            <button
              onClick={() => setEditing(false)}
              className="text-tg-hint p-1.5"
              aria-label="Отмена"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-brand-500 p-1.5"
              aria-label="Редактировать"
            >
              <Edit3 className="w-5 h-5" />
            </button>
          )
        }
      />

      <div className="px-screen-x">
        {/* Уровни клиентов (read-only — глобальные) */}
        <Card className="mb-4">
          <h2 className="font-medium text-sm mb-3 flex items-center gap-1.5">
            <Star className="w-4 h-4 text-status-warning" />
            Уровни клиентов
          </h2>
          <div className="flex flex-col gap-3">
            {Object.entries(settings.tiers).map(([key, tier]) => (
              <div
                key={key}
                className="flex items-center justify-between bg-surface-elevated rounded-card p-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{TIER_ICONS[key] ?? '🏷'}</span>
                  <div>
                    <div className="font-medium text-sm">{TIER_NAMES[key] ?? key}</div>
                    {tier.threshold > 0 && (
                      <div className="text-xs text-tg-hint">от {tier.threshold} баллов</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-brand-600">{tier.cashback_percent}%</div>
                  <div className="text-[10px] text-tg-hint">кешбэк</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Начисление баллов */}
        <Card className="mb-4">
          <h2 className="font-medium text-sm mb-3 flex items-center gap-1.5">
            <Percent className="w-4 h-4 text-brand-500" />
            Начисление баллов
          </h2>
          <BonusRow
            label="Курс начисления"
            hint="1 балл за каждые N рублей"
            field="earn_rate"
            form={form}
            setForm={setForm}
            editing={editing}
            unit="₽"
          />
          <BonusRow
            label="Макс. оплата баллами"
            hint="% от стоимости заказа, который можно покрыть"
            field="max_spend_percent"
            form={form}
            setForm={setForm}
            editing={editing}
            unit="%"
          />
        </Card>

        {/* Бонусы за события */}
        <Card className="mb-4">
          <h2 className="font-medium text-sm mb-3 flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-status-success" />
            Бонусы за события
          </h2>
          <BonusRow
            label="За первый визит"
            field="first_visit_bonus"
            form={form}
            setForm={setForm}
            editing={editing}
            unit="баллов"
          />
          <BonusRow
            label="За отзыв"
            field="review_bonus"
            form={form}
            setForm={setForm}
            editing={editing}
            unit="баллов"
          />
          <BonusRow
            label="Ко дню рождения"
            field="birthday_bonus"
            form={form}
            setForm={setForm}
            editing={editing}
            unit="баллов"
          />
          <BonusRow
            label="За приглашение друга"
            field="referral_bonus"
            form={form}
            setForm={setForm}
            editing={editing}
            unit="баллов"
          />
        </Card>

        {/* Серия и срок */}
        <Card className="mb-4">
          <h2 className="font-medium text-sm mb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-brand-500" />
            Стрик и срок действия
          </h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-tg-hint">Серия визитов подряд</span>
              <span>
                {settings.streak_threshold} визитов = +{settings.streak_bonus} баллов
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-tg-hint">Баллы сгорают через</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-tg-hint" />
                {settings.points_expiry_months} мес.
              </span>
            </div>
          </div>
          <p className="text-[11px] text-tg-hint mt-2">
            Эти параметры одинаковы для всех мастеров на платформе
          </p>
        </Card>

        {editing && (
          <Button
            variant="primary"
            className="w-full mb-6"
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            icon={<Save className="w-4 h-4" />}
          >
            Сохранить настройки
          </Button>
        )}
      </div>
    </div>
  );
}

interface BonusRowProps {
  label: string;
  hint?: string;
  field: keyof BonusFormState;
  form: BonusFormState;
  setForm: React.Dispatch<React.SetStateAction<BonusFormState>>;
  editing: boolean;
  unit: string;
}

function BonusRow({ label, hint, field, form, setForm, editing, unit }: BonusRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-tg-section-separator last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-[11px] text-tg-hint mt-0.5">{hint}</div>}
      </div>
      <div className="flex items-center gap-1.5 ml-3">
        {editing ? (
          <input
            type="number"
            inputMode="numeric"
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            className="input-field !w-20 !py-1.5 !px-2 text-right text-sm"
          />
        ) : (
          <span className="font-medium text-sm tabular-nums">{form[field]}</span>
        )}
        <span className="text-xs text-tg-hint w-14 shrink-0">{unit}</span>
      </div>
    </div>
  );
}
