import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { superadminApi } from '@/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import EmptyState from '@/shared/ui/EmptyState';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import ConfirmDialog from '@/shared/ui/ConfirmDialog';
import { UserPlus, Shield, Trash2 } from 'lucide-react';

interface Moderator {
  id: number;
  platform: string;
  platform_id: string;
  role: string;
  created_at: string;
}

export default function TeamTab() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [platformId, setPlatformId] = useState('');
  const [removeTarget, setRemoveTarget] = useState<Moderator | null>(null);

  const { data: moderators, isLoading } = useQuery<Moderator[]>({
    queryKey: ['superadmin-moderators'],
    queryFn: () => superadminApi.moderators().then((r) => r.data),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      superadminApi.addModerator({ platform_id: platformId.trim() }),
    onSuccess: () => {
      toast.success('Модератор назначен');
      setPlatformId('');
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ['superadmin-moderators'] });
    },
    onError: (err: { response?: { data?: { detail?: string } } }) =>
      toast.error(err?.response?.data?.detail || 'Ошибка назначения'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => superadminApi.removeModerator(id),
    onSuccess: () => {
      toast.success('Роль модератора снята');
      setRemoveTarget(null);
      queryClient.invalidateQueries({ queryKey: ['superadmin-moderators'] });
    },
    onError: () => toast.error('Ошибка при снятии роли'),
  });

  if (isLoading) return <ListSkeleton count={3} />;

  const list = moderators || [];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h2">Модераторы</h2>
          <p className="text-aux text-tg-hint">
            Обрабатывают тикеты, модерируют отзывы, верифицируют мастеров
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(!showAdd)}
          variant={showAdd ? 'secondary' : 'primary'}
          size="sm"
        >
          <UserPlus className="w-4 h-4" />
          {showAdd ? 'Отмена' : 'Добавить'}
        </Button>
      </div>

      {/* Форма добавления */}
      {showAdd && (
        <Card>
          <h3 className="text-body font-medium mb-2 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-tg-link" />
            Назначить модератора
          </h3>
          <p className="text-aux text-tg-hint mb-3">
            Введите Telegram ID пользователя. Он получит push-уведомление
            и при следующем входе в Mini-App увидит панель модератора.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={platformId}
              onChange={(e) => setPlatformId(e.target.value)}
              placeholder="Telegram ID (напр. 123456789)"
              className="input-field flex-1"
            />
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!platformId.trim() || addMutation.isPending}
              loading={addMutation.isPending}
              size="md"
            >
              Назначить
            </Button>
          </div>
          <p className="text-[11px] text-tg-hint mt-2">
            Как узнать ID: пользователь отправляет /start боту @userinfobot
          </p>
        </Card>
      )}

      {/* Список модераторов */}
      {list.length === 0 ? (
        <EmptyState
          emoji="👮"
          title="Нет модераторов"
          description="Назначьте помощника для работы с тикетами и отзывами"
        />
      ) : (
        <div className="flex flex-col gap-card-gap">
          {list.map((mod) => (
            <Card key={mod.id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-tg-link/10 flex items-center justify-center text-tg-link">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body font-medium">
                  {mod.platform === 'telegram' ? 'TG' : 'MAX'}: {mod.platform_id}
                </div>
                <div className="text-aux text-tg-hint">
                  ID: {mod.id} · c {mod.created_at?.slice(0, 10)}
                </div>
              </div>
              <button
                onClick={() => setRemoveTarget(mod)}
                className="p-2 text-status-danger interactive"
                aria-label="Снять роль"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Подтверждение удаления */}
      <ConfirmDialog
        isOpen={removeTarget != null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)}
        title="Снять роль модератора?"
        description={
          removeTarget
            ? `Пользователь ${removeTarget.platform_id} потеряет доступ к панели модератора и будет переведён в роль "клиент".`
            : undefined
        }
        confirmLabel="Снять роль"
        variant="danger"
        loading={removeMutation.isPending}
      />
    </div>
  );
}
