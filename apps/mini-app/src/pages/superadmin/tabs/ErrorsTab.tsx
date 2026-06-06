/**
 * ErrorsTab — суперадмин-таб для просмотра и управления ошибками.
 * Таблица с фильтрами по статусу и severity, поиск, bulk-действия.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { monitoringApi } from '@/api/endpoints';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import StatusBadge from '@/shared/ui/StatusBadge';
import EmptyState from '@/shared/ui/EmptyState';
import { CheckCircle, Eye, EyeOff, ChevronDown, ChevronUp, Search, Sparkles } from 'lucide-react';
import clsx from 'clsx';

interface ErrorEvent {
  id: number;
  fingerprint: string;
  error_type: string;
  error_msg: string;
  module: string | null;
  stack_trace: string | null;
  first_seen: string | null;
  last_seen: string | null;
  count: number;
  status: string;
  severity: string;
  request_id: string | null;
}

interface ErrorsResponse {
  items: ErrorEvent[];
  total: number;
}

const STATUS_FILTERS = [
  { key: '', label: 'Все' },
  { key: 'new', label: 'Новые' },
  { key: 'acknowledged', label: 'Ознакомлены' },
  { key: 'resolved', label: 'Решённые' },
  { key: 'ignored', label: 'Игнор' },
];

const SEVERITY_FILTERS = [
  { key: '', label: 'Все' },
  { key: 'critical', label: '🔴 Critical' },
  { key: 'error', label: '🟠 Error' },
  { key: 'warning', label: '🟡 Warning' },
];

function severityVariant(s: string): 'danger' | 'warning' | 'neutral' {
  if (s === 'critical') return 'danger';
  if (s === 'error') return 'warning';
  return 'neutral';
}

function statusVariant(s: string): 'success' | 'warning' | 'neutral' | 'danger' {
  if (s === 'resolved') return 'success';
  if (s === 'acknowledged') return 'warning';
  if (s === 'ignored') return 'neutral';
  return 'danger';
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function ErrorRow({
  error,
  isExpanded,
  onToggle,
  onStatusChange,
  isUpdating,
}: {
  error: ErrorEvent;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: number, status: string) => void;
  isUpdating: boolean;
}) {
  const [aiSolution, setAiSolution] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleAiSuggest = async () => {
    setAiLoading(true);
    try {
      const res = await monitoringApi.suggestSolution(error.id);
      setAiSolution(res.data.solution);
    } catch (e: any) {
      setAiSolution(`Ошибка: ${e.response?.data?.detail || e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Card className="text-left">
      <button
        onClick={onToggle}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge label={error.severity} variant={severityVariant(error.severity)} />
              <StatusBadge label={error.status} variant={statusVariant(error.status)} />
              {error.count > 1 && (
                <span className="text-[10px] font-bold bg-brand-500/10 text-brand-600 px-1.5 py-0.5 rounded-full">
                  ×{error.count}
                </span>
              )}
            </div>
            <div className="text-sm font-semibold truncate">{error.error_type}</div>
            <div className="text-xs text-tg-hint mt-0.5 truncate">{error.error_msg}</div>
            <div className="flex gap-3 mt-1 text-[10px] text-tg-hint">
              {error.module && <span>📦 {error.module}</span>}
              <span>🕐 {fmtDate(error.last_seen)}</span>
            </div>
          </div>
          <div className="shrink-0 mt-1">
            {isExpanded
              ? <ChevronUp className="w-4 h-4 text-tg-hint" />
              : <ChevronDown className="w-4 h-4 text-tg-hint" />}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-tg-secondary">
          {/* Details */}
          <div className="flex flex-col gap-1.5 mb-3">
            <div className="flex justify-between text-xs">
              <span className="text-tg-hint">Fingerprint</span>
              <span className="font-mono text-[10px] max-w-[60%] truncate">{error.fingerprint}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tg-hint">Первая</span>
              <span>{fmtDate(error.first_seen)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tg-hint">Последняя</span>
              <span>{fmtDate(error.last_seen)}</span>
            </div>
            {error.request_id && (
              <div className="flex justify-between text-xs">
                <span className="text-tg-hint">Request ID</span>
                <span className="font-mono text-[10px]">{error.request_id}</span>
              </div>
            )}
          </div>

          {/* Stack trace */}
          {error.stack_trace && (
            <div className="mb-3">
              <div className="text-[10px] text-tg-hint mb-1">Stack trace:</div>
              <pre className="text-[9px] leading-relaxed bg-black/90 text-red-300 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                {error.stack_trace}
              </pre>
            </div>
          )}

          {/* AI suggestion */}
          {aiSolution && (
            <div className="mb-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI-подсказка
              </div>
              <div className="text-xs text-tg-text whitespace-pre-wrap leading-relaxed">
                {aiSolution}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {error.status !== 'resolved' && (
              <Button
                size="sm"
                loading={isUpdating}
                onClick={() => onStatusChange(error.id, 'resolved')}
                className="flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Решена
              </Button>
            )}
            {error.status === 'new' && (
              <Button
                size="sm"
                variant="secondary"
                loading={isUpdating}
                onClick={() => onStatusChange(error.id, 'acknowledged')}
                className="flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" /> Ознакомлен
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              loading={aiLoading}
              onClick={handleAiSuggest}
              className="flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI
            </Button>
            {error.status !== 'ignored' && (
              <Button
                size="sm"
                variant="secondary"
                loading={isUpdating}
                onClick={() => onStatusChange(error.id, 'ignored')}
                className="flex items-center gap-1"
              >
                <EyeOff className="w-3.5 h-3.5" /> Игнорировать
              </Button>
            )}
            {error.status !== 'new' && (
              <Button
                size="sm"
                variant="secondary"
                loading={isUpdating}
                onClick={() => onStatusChange(error.id, 'new')}
              >
                Переоткрыть
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function ErrorsTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery<ErrorsResponse>({
    queryKey: ['monitoring-errors', statusFilter, severityFilter],
    queryFn: async () => {
      const r = await monitoringApi.listErrors({
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        limit: 100,
      });
      return r.data as ErrorsResponse;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      setUpdatingId(id);
      return monitoringApi.updateErrorStatus(id, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-errors'] });
      setUpdatingId(null);
    },
    onError: () => {
      setUpdatingId(null);
    },
  });

  const items = data?.items ?? [];
  const filtered = search
    ? items.filter(
        (e) =>
          e.error_type.toLowerCase().includes(search.toLowerCase()) ||
          e.error_msg.toLowerCase().includes(search.toLowerCase()) ||
          (e.module && e.module.toLowerCase().includes(search.toLowerCase()))
      )
    : items;

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tg-hint" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по ошибкам…"
          className="w-full pl-9 pr-3 py-2.5 rounded-card bg-tg-secondary text-sm text-tg-text outline-none placeholder:text-tg-hint/50"
        />
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={clsx(
              'px-3 py-1.5 rounded-btn text-xs font-medium whitespace-nowrap transition-all',
              statusFilter === f.key
                ? 'bg-brand-500 text-white'
                : 'bg-tg-secondary text-tg-hint'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Severity filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3">
        {SEVERITY_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setSeverityFilter(f.key)}
            className={clsx(
              'px-3 py-1.5 rounded-btn text-xs font-medium whitespace-nowrap transition-all',
              severityFilter === f.key
                ? 'bg-brand-500 text-white'
                : 'bg-tg-secondary text-tg-hint'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Stats header */}
      {data && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-tg-hint">
            {filtered.length} из {data.total} ошибок
          </span>
          <Button size="sm" variant="secondary" onClick={() => refetch()} loading={isLoading}>
            🔄 Обновить
          </Button>
        </div>
      )}

      {/* Error list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-tg-secondary rounded-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji="✨"
          title={search ? 'Ничего не найдено' : 'Ошибок нет'}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((error) => (
            <ErrorRow
              key={error.id}
              error={error}
              isExpanded={expandedId === error.id}
              onToggle={() => setExpandedId(expandedId === error.id ? null : error.id)}
              onStatusChange={(id, status) => updateMutation.mutate({ id, status })}
              isUpdating={updatingId === error.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
