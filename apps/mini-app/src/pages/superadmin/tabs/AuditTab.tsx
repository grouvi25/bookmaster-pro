import { useQuery } from '@tanstack/react-query';
import { superadminApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { CardSkeleton } from '@/shared/ui/Skeleton';
import EmptyState from '@/shared/ui/EmptyState';
import Card from '@/shared/ui/Card';
import type { AuditLogEntry } from '@/shared/types/api';

export default function AuditTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-audit'],
    queryFn: () => superadminApi.auditLog().then((r) => r.data),
  });

  if (isLoading) return (
    <div className="flex flex-col gap-card-gap">
      {[0,1,2,3].map(i => <CardSkeleton key={i} />)}
    </div>
  );
  const logs = toArray<AuditLogEntry>(data);

  return (
    <div className="flex flex-col gap-2">
      {logs.length === 0 ? (
        <EmptyState
          emoji="📜"
          title="Нет записей"
          description="Действия администраторов появятся здесь"
        />
      ) : (
        logs.map((log) => (
          <Card key={log.id}>
            <div className="flex justify-between text-sm">
              <span className="font-medium">{log.action}</span>
              <span className="text-[11px] text-tg-hint">{log.created_at}</span>
            </div>
            <div className="text-xs text-tg-hint mt-0.5">
              admin: {log.admin_id || '—'}
              {log.entity_type && (
                <>
                  {' '}· {log.entity_type}#{log.entity_id ?? '—'}
                </>
              )}
            </div>
            {log.payload && (
              <pre className="text-[11px] text-tg-hint mt-1 bg-tg-bg rounded p-2 overflow-x-auto">
                {JSON.stringify(log.payload, null, 2)}
              </pre>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
