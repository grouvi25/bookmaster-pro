import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { superadminApi } from '@/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import EmptyState from '@/shared/ui/EmptyState';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import StatusBadge from '@/shared/ui/StatusBadge';

interface PromoCode {
  id: number;
  code: string;
  plan: string;
  duration_days: number;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
}

export default function PromoCodesTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [plan, setPlan] = useState('pro');
  const [days, setDays] = useState('30');
  const [maxUses, setMaxUses] = useState('');
  const [note, setNote] = useState('');

  const { data, isLoading, refetch } = useQuery<PromoCode[]>({
    queryKey: ['superadmin-promo-codes'],
    queryFn: () => superadminApi.promoCodes().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      superadminApi.createPromoCode({
        code,
        plan,
        duration_days: parseInt(days) || 30,
        max_uses: maxUses ? parseInt(maxUses) : null,
        note: note || null,
      }),
    onSuccess: () => {
      toast.success('Промо-код создан');
      setShowCreate(false);
      setCode('');
      setNote('');
      setMaxUses('');
      refetch();
    },
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      toast.error(err?.response?.data?.detail || 'Ошибка создания'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => superadminApi.deactivatePromoCode(id),
    onSuccess: () => {
      toast.success('Промо-код деактивирован');
      refetch();
    },
  });

  if (isLoading) return <ListSkeleton count={3} />;
  const codes = data || [];

  return (
    <div>
      <Button
        onClick={() => setShowCreate(!showCreate)}
        fullWidth
        variant={showCreate ? 'secondary' : 'primary'}
        className="mb-4"
      >
        {showCreate ? 'Отмена' : '+ Создать промо-код'}
      </Button>

      {showCreate && (
        <Card className="mb-4 flex flex-col gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Код (напр. PARTNER30)"
            className="input-field !h-auto !py-2.5"
          />
          <div className="flex gap-2">
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="flex-1 input-field !h-auto !py-2.5"
            >
              <option value="start">Start</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="pro_ai">Pro+AI</option>
              <option value="business">Business</option>
            </select>
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="Дней"
              className="w-20 input-field !h-auto !py-2.5"
            />
          </div>
          <input
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Макс. использований (пусто = без лимита)"
            className="input-field !h-auto !py-2.5"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Заметка (для кого/зачем)"
            className="input-field !h-auto !py-2.5"
          />
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!code}
            loading={createMutation.isPending}
            fullWidth
            size="sm"
          >
            Создать
          </Button>
        </Card>
      )}

      {codes.length === 0 ? (
        <EmptyState
          emoji="🎫"
          title="Нет промо-кодов"
          description="Создайте первый промо-код"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {codes.map((c) => (
            <Card key={c.id}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-sm font-mono">{c.code}</div>
                  <div className="text-xs text-tg-hint mt-0.5">
                    {c.plan} · {c.duration_days} дней
                    {c.max_uses
                      ? ` · ${c.used_count}/${c.max_uses}`
                      : ` · ${c.used_count} исп.`}
                  </div>
                  {c.note && <div className="text-xs text-tg-hint mt-0.5">{c.note}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    label={c.is_active ? 'Активен' : 'Выкл'}
                    variant={c.is_active ? 'success' : 'neutral'}
                  />
                  {c.is_active && (
                    <button
                      onClick={() => deactivateMutation.mutate(c.id)}
                      className="text-xs text-red-500 underline"
                    >
                      Выкл
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
