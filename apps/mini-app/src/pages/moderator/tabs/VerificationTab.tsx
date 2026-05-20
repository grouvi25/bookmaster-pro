import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCheck } from 'lucide-react';
import { moderationApi } from '@/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import EmptyState from '@/shared/ui/EmptyState';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import ConfirmDialog from '@/shared/ui/ConfirmDialog';
import { ClientCardSkeleton } from '@/shared/ui/Skeleton';

interface PendingMaster {
  id: number;
  display_name?: string;
  name?: string;
  specialization?: string;
}

export default function VerificationTab() {
  const queryClient = useQueryClient();
  const [verifyTarget, setVerifyTarget] = useState<PendingMaster | null>(null);

  const { data: pendingMasters = [], isLoading } = useQuery<PendingMaster[]>({
    queryKey: ['pending-masters'],
    queryFn: async () => {
      const resp = await moderationApi.mastersList({ verified: 'false' });
      return resp.data?.items || resp.data?.masters || resp.data || [];
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (masterId: number) => moderationApi.masterVerify(masterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-masters'] });
      setVerifyTarget(null);
      toast.success('Мастер верифицирован');
    },
    onError: () => toast.error('Не удалось верифицировать'),
  });

  if (isLoading) return <ClientCardSkeleton count={3} />;

  return (
    <div className="space-y-4">
      {pendingMasters.length === 0 ? (
        <EmptyState
          emoji="✅"
          title="Нет заявок"
          description="Все мастера верифицированы"
        />
      ) : (
        <div className="flex flex-col gap-card-gap">
          {pendingMasters.map((master) => {
            const name = master.display_name || master.name || 'Мастер';
            return (
              <Card key={master.id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-tg-link/10 flex items-center justify-center text-tg-link font-bold">
                  {name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium truncate">{name}</p>
                  <p className="text-aux text-tg-hint truncate">
                    {master.specialization || 'Без специализации'}
                  </p>
                </div>
                <Button
                  onClick={() => setVerifyTarget(master)}
                  size="sm"
                  className="shrink-0"
                >
                  <UserCheck className="w-4 h-4" />
                  Верифицировать
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={verifyTarget != null}
        onClose={() => setVerifyTarget(null)}
        onConfirm={() =>
          verifyTarget && verifyMutation.mutate(verifyTarget.id)
        }
        title="Верифицировать мастера?"
        description={
          verifyTarget
            ? `«${verifyTarget.display_name || verifyTarget.name}» получит галочку «Подтверждён» на маркетплейсе.`
            : undefined
        }
        confirmLabel="Верифицировать"
        loading={verifyMutation.isPending}
      />
    </div>
  );
}
