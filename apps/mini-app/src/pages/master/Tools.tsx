import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { promoApi, loyaltyApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { useAuthStore } from '@/stores/auth';
import { ServiceCardSkeleton } from '@/shared/ui/Skeleton';
import PageHeader from '@/shared/ui/PageHeader';
import ChipTabs from '@/shared/ui/ChipTabs';
import EmptyState from '@/shared/ui/EmptyState';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import ConfirmDialog from '@/shared/ui/ConfirmDialog';
import type { Promo, LoyaltyTransaction } from '@/shared/types/api';
import FeatureGate from '@/shared/ui/FeatureGate';
import { Plus, Pencil, Trash2, X, Check, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type ToolsTab = 'promo' | 'loyalty' | 'referrals';

const TABS: { key: ToolsTab; label: string; emoji?: string }[] = [
  { key: 'promo', label: 'Промокоды', emoji: '🎫' },
  { key: 'loyalty', label: 'Лояльность', emoji: '⭐' },
  { key: 'referrals', label: 'Рефералы', emoji: '👥' },
];

export default function Tools() {
  const [tab, setTab] = useState<ToolsTab>('promo');
  const navigate = useNavigate();

  return (
    <div className="px-screen-x">
      <PageHeader title="Инструменты" />

      <div className="mb-section-y">
        <ChipTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'promo' ? (
        <PromoSection />
      ) : tab === 'loyalty' ? (
        <FeatureGate flag="loyalty_enabled">
          <LoyaltySection />
        </FeatureGate>
      ) : (
        (() => { navigate('/master/referrals'); return null; })()
      )}
    </div>
  );
}

/* ─── Promo Section ─── */

type DiscountType = 'percent' | 'fixed';

function PromoSection() {
  const queryClient = useQueryClient();

  /* ── form state ── */
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formDiscountType, setFormDiscountType] = useState<DiscountType>('percent');
  const [formDiscountValue, setFormDiscountValue] = useState('');
  const [formMaxUses, setFormMaxUses] = useState('');
  const [formValidUntil, setFormValidUntil] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  /* ── delete state ── */
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  /* ── copy feedback ── */
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['promos'],
    queryFn: () => promoApi.list().then((r) => r.data),
  });

  const promos = toArray<Promo>(data);

  /* ── helpers ── */
  const resetForm = () => {
    setFormCode('');
    setFormDiscountType('percent');
    setFormDiscountValue('');
    setFormMaxUses('');
    setFormValidUntil('');
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (p: Promo) => {
    setEditingId(p.id);
    setFormCode(p.code ?? '');
    setFormDiscountType((p.discount_type as DiscountType) ?? 'percent');
    setFormDiscountValue(String(Number(p.discount_value)));
    setFormMaxUses(p.max_uses ? String(p.max_uses) : '');
    setFormValidUntil('');
    setShowForm(true);
  };

  const handleCopy = async (p: Promo) => {
    if (!p.code) return;
    try {
      await navigator.clipboard.writeText(p.code);
      setCopiedId(p.id);
      toast.success('Код скопирован');
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  const handleSubmit = async () => {
    if (!formCode.trim()) {
      toast.error('Введите код');
      return;
    }
    if (!formDiscountValue || Number(formDiscountValue) <= 0) {
      toast.error('Введите скидку');
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        promo_type: 'code' as const,
        code: formCode.trim().toUpperCase(),
        discount_type: formDiscountType,
        discount_value: Number(formDiscountValue),
        max_uses: formMaxUses ? Number(formMaxUses) : undefined,
        valid_until: formValidUntil || undefined,
      };

      if (editingId) {
        await promoApi.update(editingId, payload);
        toast.success('Промокод обновлён');
      } else {
        await promoApi.create(payload);
        toast.success('Промокод создан');
      }
      await queryClient.invalidateQueries({ queryKey: ['promos'] });
      resetForm();
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);

    const prev = queryClient.getQueryData(['promos']);
    queryClient.setQueryData(['promos'], (old: unknown) => {
      if (Array.isArray(old)) return old.filter((p: Promo) => p.id !== id);
      return old;
    });
    try {
      await promoApi.delete(id);
      await queryClient.invalidateQueries({ queryKey: ['promos'] });
      toast.success('Промокод удалён');
    } catch {
      queryClient.setQueryData(['promos'], prev);
      toast.error('Ошибка при удалении');
    }
  };

  if (isLoading) return <ServiceCardSkeleton count={3} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-h3">Промокоды</h2>
        <button
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
          className="flex items-center gap-1 text-tg-link text-sm"
        >
          {showForm ? (
            <>
              <X className="w-4 h-4" /> Отмена
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Создать
            </>
          )}
        </button>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <Card className="mb-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-sm">
              {editingId ? 'Редактирование' : 'Новый промокод'}
            </span>
            <button onClick={resetForm} className="text-tg-hint p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <input
              value={formCode}
              onChange={(e) => setFormCode(e.target.value.toUpperCase())}
              placeholder="Код (например WELCOME)"
              className="input-field"
            />

            <div className="flex gap-2">
              <div className="flex rounded-lg overflow-hidden border"
                style={{ borderColor: 'color-mix(in srgb, var(--tg-theme-hint-color, #999) 35%, transparent)' }}>
                <button
                  onClick={() => setFormDiscountType('percent')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    formDiscountType === 'percent'
                      ? 'bg-tg-button text-tg-button-text'
                      : 'text-tg-hint'
                  }`}
                >
                  %
                </button>
                <button
                  onClick={() => setFormDiscountType('fixed')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    formDiscountType === 'fixed'
                      ? 'bg-tg-button text-tg-button-text'
                      : 'text-tg-hint'
                  }`}
                >
                  ₽
                </button>
              </div>
              <input
                value={formDiscountValue}
                onChange={(e) => setFormDiscountValue(e.target.value)}
                placeholder={formDiscountType === 'percent' ? 'Скидка %' : 'Сумма ₽'}
                type="number"
                className="flex-1 input-field"
              />
            </div>

            <div className="flex gap-2">
              <input
                value={formMaxUses}
                onChange={(e) => setFormMaxUses(e.target.value)}
                placeholder="Лимит (∞)"
                type="number"
                className="flex-1 input-field"
              />
              <input
                value={formValidUntil}
                onChange={(e) => setFormValidUntil(e.target.value)}
                placeholder="До (дата)"
                type="date"
                className="flex-1 input-field"
              />
            </div>

            <Button onClick={handleSubmit} loading={formLoading} fullWidth size="sm">
              <Check className="w-4 h-4 mr-1" />
              {editingId ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </Card>
      )}

      {/* ── List ── */}
      {promos.length === 0 ? (
        <EmptyState emoji="🏷️" title="Нет промокодов" description="Создайте первый промокод" />
      ) : (
        <div className="flex flex-col gap-2">
          {promos.map((p) => (
            <Card key={p.id} className="flex items-center gap-2">
              {/* Copy button */}
              <button
                onClick={() => handleCopy(p)}
                className="text-tg-hint active:text-tg-link p-1"
              >
                {copiedId === p.id ? (
                  <Check className="w-4 h-4 text-status-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-mono font-bold text-sm truncate">{p.code}</div>
                <div className="text-xs text-tg-hint">
                  Исп: {p.usage_count ?? p.used_count ?? 0}
                  {p.max_uses ? ` / ${p.max_uses}` : ' / ∞'}
                </div>
              </div>

              {/* Discount badge */}
              <span className="font-bold text-sm text-brand-600 whitespace-nowrap">
                {p.discount_type === 'percent'
                  ? `-${Number(p.discount_value)}%`
                  : `-${Number(p.discount_value).toLocaleString('ru')} ₽`}
              </span>

              {/* Edit */}
              <button
                onClick={() => startEdit(p)}
                className="text-tg-hint active:text-brand-500 p-1"
              >
                <Pencil className="w-4 h-4" />
              </button>

              {/* Delete */}
              <button
                onClick={() => setDeleteConfirmId(p.id)}
                className="text-status-danger active:text-status-danger p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmDelete}
        title="Удалить промокод?"
        description={
          deleteConfirmId
            ? `«${promos.find((p) => p.id === deleteConfirmId)?.code ?? ''}» — будет удалён без возможности восстановления.`
            : undefined
        }
        confirmLabel="Удалить"
        variant="danger"
      />
    </div>
  );
}

/* ─── Loyalty Section ─── */

function LoyaltySection() {
  const { masterId } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['loyalty-history', masterId],
    queryFn: () => loyaltyApi.getHistory(masterId!).then((r) => r.data),
    enabled: !!masterId,
  });

  if (isLoading) return <ServiceCardSkeleton count={3} />;

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