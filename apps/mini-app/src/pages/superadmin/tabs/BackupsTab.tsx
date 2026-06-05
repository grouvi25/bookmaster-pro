/**
 * BackupsTab — суперадмин-таб для просмотра и управления бэкапами.
 * Список бэкапов из S3 с размером, статусом, составом.
 */
import { useQuery } from '@tanstack/react-query';
import { monitoringApi } from '@/api/endpoints';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import StatusBadge from '@/shared/ui/StatusBadge';
import EmptyState from '@/shared/ui/EmptyState';
import { Database, HardDrive, Calendar, RefreshCw } from 'lucide-react';

interface BackupInfo {
  date: string;
  size: string | null;
  status: string;
  postgres_file: string | null;
  redis_file: string | null;
}

function backupStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'complete') return 'success';
  if (status === 'partial') return 'warning';
  if (status === 'no_manifest') return 'neutral';
  return 'danger';
}

function backupStatusLabel(status: string): string {
  switch (status) {
    case 'complete': return 'Полный';
    case 'partial': return 'Частичный';
    case 'no_manifest': return 'Без манифеста';
    default: return status;
  }
}

function fmtDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('ru', {
      day: 'numeric', month: 'long', year: 'numeric', weekday: 'short',
    });
  } catch {
    return dateStr;
  }
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr === today;
}

function isYesterday(dateStr: string): boolean {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateStr === d.toISOString().slice(0, 10);
}

export default function BackupsTab() {
  const { data: backups, isLoading, refetch, isFetching } = useQuery<BackupInfo[]>({
    queryKey: ['monitoring-backups'],
    queryFn: async () => {
      const r = await monitoringApi.listBackups(30);
      return r.data as BackupInfo[];
    },
  });

  const items = backups ?? [];
  const completeCount = items.filter((b) => b.status === 'complete').length;

  return (
    <div>
      {/* Summary card */}
      {items.length > 0 && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">📦 Бэкапы</span>
            <Button size="sm" variant="secondary" onClick={() => refetch()} loading={isFetching}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-brand-600">{items.length}</div>
              <div className="text-[10px] text-tg-hint">Всего</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-status-success">{completeCount}</div>
              <div className="text-[10px] text-tg-hint">Полных</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-status-warning">{items.length - completeCount}</div>
              <div className="text-[10px] text-tg-hint">Неполных</div>
            </div>
          </div>
        </Card>
      )}

      {/* Info */}
      <Card className="mb-4 bg-brand-500/5">
        <div className="text-xs text-tg-hint">
          <span className="font-semibold text-tg-text">Расписание:</span> ежедневно в 03:00 MSK (pg_dump + Redis → YC S3)
        </div>
        <div className="text-xs text-tg-hint mt-1">
          <span className="font-semibold text-tg-text">Хранение:</span> 30 дн. ежедневные, 365 дн. ежемесячные
        </div>
      </Card>

      {/* Backup list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-tg-secondary rounded-card animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          emoji="📭"
          title="Бэкапов пока нет"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((b) => {
            const today = isToday(b.date);
            const yesterday = isYesterday(b.date);
            return (
              <Card
                key={b.date}
                className={today ? 'ring-1 ring-brand-500/30' : ''}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-tg-hint shrink-0" />
                      <span className="text-sm font-semibold">
                        {today ? '🟢 Сегодня' : yesterday ? 'Вчера' : fmtDate(b.date)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-tg-hint ml-5.5">
                      {b.size && (
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" /> {b.size}
                        </span>
                      )}
                      {b.postgres_file && (
                        <span className="flex items-center gap-1">
                          <Database className="w-3 h-3" /> PostgreSQL ✓
                        </span>
                      )}
                      {b.redis_file && (
                        <span className="flex items-center gap-1">
                          <Database className="w-3 h-3" /> Redis ✓
                        </span>
                      )}
                    </div>
                  </div>

                  <StatusBadge
                    label={backupStatusLabel(b.status)}
                    variant={backupStatusVariant(b.status)}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
