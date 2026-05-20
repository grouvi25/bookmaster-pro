import { useMutation } from '@tanstack/react-query';
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

export default function HealthTab() {
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
                      <div className="text-[11px] text-red-500 mt-1 break-words">
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
