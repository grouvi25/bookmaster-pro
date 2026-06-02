import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { superadminApi } from '@/api/endpoints';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import StatusBadge from '@/shared/ui/StatusBadge';
import { statusVariant } from '../shared';

interface HealthCheckResult {
  status: string;
  detail?: string | null;
  response_time_ms?: number;
  ping_ms?: number;
  roundtrip_ms?: number;
  jobs_count?: number;
  bucket?: string;
  model?: string;
  username?: string;
  shop_id?: string;
  test_mode?: boolean;
}

interface HealthResponse {
  status: string;
  checks: Record<string, HealthCheckResult>;
  checked_at?: string;
}

interface LogsResponse {
  service: string;
  container: string;
  lines: string[];
  count?: number;
  error?: string;
}

const HEALTH_LABELS: Record<string, string> = {
  database: 'PostgreSQL',
  redis: 'Redis',
  scheduler: 'Scheduler',
  s3: 'S3 (Object Storage)',
  openai: 'OpenAI',
  yandex_gpt: 'YandexGPT',
  yandex_stt: 'Yandex STT',
  yookassa: 'ЮKassa',
  telegram_bot: 'Telegram Bot',
  max_bot: 'MAX Bot',
};

// Сервисы, для которых можно смотреть логи контейнеров
const LOG_SERVICES: { key: string; label: string }[] = [
  { key: 'bot_max', label: 'MAX bot' },
  { key: 'bot_tg', label: 'Telegram bot' },
  { key: 'api', label: 'API' },
  { key: 'scheduler', label: 'Scheduler' },
  { key: 'mini_app', label: 'Mini-App' },
  { key: 'marketplace', label: 'Marketplace' },
];

function HealthView() {
  const mutation = useMutation<HealthResponse>({
    mutationFn: async () => {
      const r = await superadminApi.healthChecks();
      return r.data as HealthResponse;
    },
  });

  return (
    <div>
      <Button
        onClick={() => mutation.mutate()}
        loading={mutation.isPending}
        fullWidth
        className="mb-4"
      >
        🩺 Запустить проверку всех сервисов
      </Button>

      {mutation.data && (
        <>
          <Card className="mb-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Общий статус</span>
              <StatusBadge
                label={mutation.data.status}
                variant={
                  mutation.data.status === 'healthy' ? 'success' : 'warning'
                }
              />
            </div>
            {mutation.data.checked_at && (
              <p className="text-[11px] text-tg-hint mt-1">
                Проверено: {new Date(mutation.data.checked_at).toLocaleString('ru')}
              </p>
            )}
          </Card>

          <div className="flex flex-col gap-2">
            {Object.entries(mutation.data.checks).map(([service, result]) => (
              <Card key={service}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {HEALTH_LABELS[service] || service}
                    </div>
                    <div className="text-[11px] text-tg-hint mt-0.5 flex flex-wrap gap-x-3">
                      {result.response_time_ms != null && (
                        <span>⏱ {result.response_time_ms} ms</span>
                      )}
                      {result.ping_ms != null && (
                        <span>ping {result.ping_ms} ms</span>
                      )}
                      {result.roundtrip_ms != null && (
                        <span>roundtrip {result.roundtrip_ms} ms</span>
                      )}
                      {result.jobs_count != null && (
                        <span>jobs: {result.jobs_count}</span>
                      )}
                      {result.bucket && (
                        <span className="truncate">bucket: {result.bucket}</span>
                      )}
                      {result.username && <span>@{result.username}</span>}
                      {result.shop_id && <span>shop: {result.shop_id}</span>}
                      {result.test_mode != null && (
                        <span>{result.test_mode ? 'test mode' : 'live'}</span>
                      )}
                    </div>
                    {result.detail && (
                      <div className="text-[11px] text-status-danger mt-1 break-words">
                        {result.detail}
                      </div>
                    )}
                  </div>
                  <StatusBadge label={result.status} variant={statusVariant(result.status)} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LogsView() {
  const [service, setService] = useState('bot_max');
  const { data, isFetching, refetch, error } = useQuery<LogsResponse>({
    queryKey: ['superadmin-logs', service],
    queryFn: async () => {
      const r = await superadminApi.logs(service, 200);
      return r.data as LogsResponse;
    },
  });

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {LOG_SERVICES.map((s) => (
          <button
            key={s.key}
            onClick={() => setService(s.key)}
            className={`px-3 py-1.5 rounded-btn text-xs font-medium transition-all ${
              service === s.key
                ? 'bg-brand-500 text-white'
                : 'bg-tg-secondary text-tg-hint'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Button
        onClick={() => refetch()}
        loading={isFetching}
        fullWidth
        size="sm"
        className="mb-3"
      >
        🔄 Обновить логи
      </Button>

      {error && (
        <Card className="mb-2">
          <div className="text-[11px] text-status-danger break-words">
            Ошибка загрузки логов: {(error as Error).message}
          </div>
        </Card>
      )}

      {data?.error && (
        <Card className="mb-2">
          <div className="text-[11px] text-status-danger break-words">{data.error}</div>
        </Card>
      )}

      {data && !data.error && (
        <Card>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold">{data.container}</span>
            <span className="text-[11px] text-tg-hint">
              {data.count ?? data.lines.length} строк
            </span>
          </div>
          {data.lines.length === 0 ? (
            <p className="text-[11px] text-tg-hint">Логи пусты</p>
          ) : (
            <pre className="text-[10px] leading-relaxed bg-black/90 text-green-300 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto">
              {data.lines.join('\n')}
            </pre>
          )}
        </Card>
      )}
    </div>
  );
}

export default function HealthTab() {
  const [view, setView] = useState<'health' | 'logs'>('health');

  return (
    <div>
      <div className="flex bg-tg-secondary rounded-btn p-1 mb-4">
        {([
          { key: 'health', label: 'Здоровье' },
          { key: 'logs', label: 'Логи' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              view === t.key ? 'bg-tg-bg text-tg-text' : 'text-tg-hint'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'health' ? <HealthView /> : <LogsView />}
    </div>
  );
}
