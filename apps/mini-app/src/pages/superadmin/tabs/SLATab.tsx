import { useQuery } from '@tanstack/react-query';
import { superadminApi } from '@/api/endpoints';
import { StatGridSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import StatusBadge from '@/shared/ui/StatusBadge';
import { Gauge } from 'lucide-react';

interface SLAStats {
  by_priority: Record<
    string,
    {
      total: number;
      first_response_breach: number;
      resolve_breach: number;
      first_response_sla_hours: number;
      resolve_sla_hours: number;
    }
  >;
}

const PRIORITIES = ['high', 'medium', 'low'] as const;

export default function SLATab() {
  const { data, isLoading } = useQuery<SLAStats>({
    queryKey: ['superadmin-sla'],
    queryFn: () => superadminApi.slaStats().then((r) => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <StatGridSkeleton count={3} />;
  const byP = data?.by_priority || {};

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-tg-hint mb-1 flex items-center gap-1.5">
        <Gauge className="w-3.5 h-3.5" /> SLA нарушения по приоритетам
      </p>
      {PRIORITIES.map((priority) => {
        const stats = byP[priority];
        if (!stats) return null;
        const breaches = stats.first_response_breach + stats.resolve_breach;
        const variant: 'success' | 'warning' | 'danger' =
          breaches === 0
            ? 'success'
            : stats.first_response_breach > 0
            ? 'danger'
            : 'warning';
        return (
          <Card key={priority}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold capitalize">{priority}</span>
              <StatusBadge label={`${breaches} нарушений`} variant={variant} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-tg-hint">Всего тикетов</div>
                <div className="font-semibold">{stats.total}</div>
              </div>
              <div>
                <div className="text-tg-hint">First response SLA</div>
                <div className="font-semibold">{stats.first_response_sla_hours} ч</div>
              </div>
              <div>
                <div className="text-tg-hint">Без ответа &gt; SLA</div>
                <div
                  className={`font-semibold ${
                    stats.first_response_breach > 0 ? 'text-status-danger' : ''
                  }`}
                >
                  {stats.first_response_breach}
                </div>
              </div>
              <div>
                <div className="text-tg-hint">Не закрыто &gt; SLA</div>
                <div
                  className={`font-semibold ${
                    stats.resolve_breach > 0 ? 'text-status-danger' : ''
                  }`}
                >
                  {stats.resolve_breach}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
