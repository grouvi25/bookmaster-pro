import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { superadminApi } from '@/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import { toArray } from '@/shared/lib/normalize';
import { ClientCardSkeleton } from '@/shared/ui/Skeleton';
import StatusBadge from '@/shared/ui/StatusBadge';
import EmptyState from '@/shared/ui/EmptyState';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import SearchInput from '@/shared/ui/SearchInput';
import type { MasterProfile } from '@/shared/types/api';

type AdminMaster = MasterProfile & {
  is_active?: boolean;
  is_verified?: boolean;
};

export default function MastersTab() {
  const [search, setSearch] = useState('');
  const [grantMasterId, setGrantMasterId] = useState<number | null>(null);
  const [grantPlan, setGrantPlan] = useState('pro');
  const [grantDays, setGrantDays] = useState('30');
  const [grantNote, setGrantNote] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<AdminMaster | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-masters', search],
    queryFn: () =>
      superadminApi
        .masters({ search: search || undefined })
        .then((r) => r.data),
  });

  const grantMutation = useMutation({
    mutationFn: ({
      masterId,
      plan,
      days,
      note,
    }: {
      masterId: number;
      plan: string;
      days: number;
      note: string;
    }) =>
      superadminApi.grantAccess(masterId, {
        plan,
        duration_days: days,
        note: note || undefined,
      }),
    onSuccess: () => {
      toast.success('Доступ выдан');
      setGrantMasterId(null);
      setGrantNote('');
      queryClient.invalidateQueries({ queryKey: ['superadmin-masters'] });
    },
    onError: () => toast.error('Ошибка выдачи доступа'),
  });

  const verifyMutation = useMutation({
    mutationFn: (masterId: number) => superadminApi.verifyMaster(masterId),
    onSuccess: () => {
      toast.success('Мастер верифицирован');
      queryClient.invalidateQueries({ queryKey: ['superadmin-masters'] });
    },
  });

  const blockMutation = useMutation({
    mutationFn: ({ masterId, isActive }: { masterId: number; isActive: boolean }) =>
      superadminApi.updateMaster(masterId, { is_active: isActive }),
    onSuccess: () => {
      toast.success('Статус обновлён');
      queryClient.invalidateQueries({ queryKey: ['superadmin-masters'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (masterId: number) => superadminApi.deleteMaster(masterId),
    onSuccess: () => {
      toast.success('Мастер удалён');
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['superadmin-masters'] });
    },
    onError: () => toast.error('Ошибка удаления'),
  });

  if (isLoading) return <ClientCardSkeleton count={5} />;

  const masters = (data?.masters ?? toArray<MasterProfile>(data)) as AdminMaster[];

  return (
    <div>
      <div className="mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Поиск мастеров..." />
      </div>

      <div className="flex flex-col gap-2">
        {masters.length === 0 && (
          <EmptyState
            emoji="👥"
            title="Нет мастеров"
            description="Никто не подходит под фильтр"
          />
        )}
        {masters.map((m) => (
          <Card key={m.id}>
            <div className="flex justify-between items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{m.display_name}</div>
                <div className="text-xs text-tg-hint truncate">
                  {m.specialization || '—'} · {m.current_plan} · {m.city || '—'}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <StatusBadge
                  label={m.is_active ? 'Активен' : 'Заблокирован'}
                  variant={m.is_active ? 'success' : 'danger'}
                />
                {m.is_verified && (
                  <StatusBadge label="✓ Верифицирован" variant="info" />
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  setGrantMasterId(grantMasterId === m.id ? null : m.id)
                }
                className="text-xs bg-tg-button text-tg-button-text px-2.5 py-1.5 rounded-lg"
              >
                Выдать доступ
              </button>
              {!m.is_verified && (
                <button
                  onClick={() => verifyMutation.mutate(m.id)}
                  className="text-xs bg-status-info/10 text-status-info px-2.5 py-1.5 rounded-lg"
                >
                  Верифицировать
                </button>
              )}
              <button
                onClick={() =>
                  blockMutation.mutate({ masterId: m.id, isActive: !m.is_active })
                }
                className={`text-xs px-2.5 py-1.5 rounded-lg ${
                  m.is_active
                    ? 'bg-status-danger/10 text-status-danger'
                    : 'bg-status-success/10 text-status-success'
                }`}
              >
                {m.is_active ? 'Блокировать' : 'Разблокировать'}
              </button>
              <button
                onClick={() => setDeleteConfirm(m)}
                className="text-xs bg-status-danger/10 text-status-danger px-2.5 py-1.5 rounded-lg"
              >
                Удалить
              </button>
            </div>

            {grantMasterId === m.id && (
              <div className="mt-3 pt-3 border-t border-tg-secondary/50 flex flex-col gap-2">
                <div className="flex gap-2">
                  <select
                    value={grantPlan}
                    onChange={(e) => setGrantPlan(e.target.value)}
                    className="flex-1 input-field !h-auto !py-2"
                  >
                    <option value="start">Start</option>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="pro_ai">Pro+AI</option>
                    <option value="business">Business</option>
                  </select>
                  <input
                    type="number"
                    value={grantDays}
                    onChange={(e) => setGrantDays(e.target.value)}
                    placeholder="Дней"
                    className="w-20 input-field !h-auto !py-2"
                  />
                </div>
                <input
                  type="text"
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                  placeholder="Комментарий (необязательно)"
                  className="input-field !h-auto !py-2"
                />
                <Button
                  onClick={() =>
                    grantMutation.mutate({
                      masterId: m.id,
                      plan: grantPlan,
                      days: parseInt(grantDays) || 30,
                      note: grantNote,
                    })
                  }
                  loading={grantMutation.isPending}
                  fullWidth
                  size="sm"
                >
                  Подтвердить выдачу
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Модалка подтверждения удаления */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-tg-bg rounded-2xl p-5 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">⚠️</div>
              <h3 className="text-h3 font-bold">Удалить мастера?</h3>
              <p className="text-sm text-tg-hint mt-2">
                <span className="font-medium text-tg-text">{deleteConfirm.display_name}</span>
                {' '}будет удалён из базы данных вместе со всеми записями, платежами
                и историей. Это действие *необратимо*.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setDeleteConfirm(null)}
                fullWidth
                size="sm"
                variant="secondary"
              >
                Отмена
              </Button>
              <Button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                loading={deleteMutation.isPending}
                fullWidth
                size="sm"
                variant="danger"
              >
                Удалить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
