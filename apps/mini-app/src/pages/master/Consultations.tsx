import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeaderBackButton } from "@/components/common/BackButton";
import { consultationsApi } from '@/api/endpoints';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import PageHeader from '@/shared/ui/PageHeader';
import Card from '@/shared/ui/Card';
import EmptyState from '@/shared/ui/EmptyState';
import {} from 'lucide-react';

interface ConsultationItem {
  id: number;
  slot_start: string;
  slot_end: string;
  status: string;
  meeting_url: string | null;
  client_note: string | null;
  master_note: string | null;
  price: number | null;
  converted_appointment_id: number | null;
}

interface ConsultationStatsData {
  total: number;
  completed: number;
  cancelled: number;
  conversion_rate: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  confirmed: 'Подтверждена',
  in_progress: 'Идёт',
  completed: 'Завершена',
  cancelled: 'Отменена',
  no_show: 'Не пришёл',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-600',
  confirmed: 'bg-blue-500/15 text-blue-600',
  in_progress: 'bg-green-500/15 text-green-600',
  completed: 'bg-tg-secondary text-tg-hint',
  cancelled: 'bg-red-500/15 text-red-500',
  no_show: 'bg-red-500/15 text-red-500',
};

export default function Consultations() {
  const [tab, setTab] = useState<'list' | 'stats'>('list');

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text pb-24 animate-fade-in">
      <PageHeader
        title="Консультации"
        left={<HeaderBackButton />}
      />

      <div className="px-screen-x">
        <div className="flex gap-2 mb-4">
          {[
            { key: 'list' as const, label: 'Записи' },
            { key: 'stats' as const, label: 'Статистика' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-tg-button text-tg-button-text'
                  : 'bg-tg-secondary text-tg-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'list' ? <ConsultationsList /> : <ConsultationStatsSection />}
      </div>
    </div>
  );
}

function ConsultationsList() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['consultations', statusFilter],
    queryFn: () =>
      consultationsApi
        .masterList(statusFilter ? { status: statusFilter } : undefined)
        .then((r) => r.data),
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) =>
      consultationsApi.update(id, { status: 'completed' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['consultations'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => consultationsApi.cancel(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['consultations'] }),
  });

  if (isLoading) return <ListSkeleton count={3} />;

  const items: ConsultationItem[] = Array.isArray(data) ? data : [];

  return (
    <div>
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {['', 'confirmed', 'completed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap ${
              statusFilter === s
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-secondary text-tg-hint'
            }`}
          >
            {s ? STATUS_LABELS[s] : 'Все'}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          emoji="📞"
          title="Нет консультаций"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((c) => (
            <Card key={c.id}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-sm font-medium">
                    {new Date(c.slot_start).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    {new Date(c.slot_start).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' \– '}
                    {new Date(c.slot_end).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {c.price != null && (
                    <div className="text-xs text-tg-hint">
                      {c.price.toLocaleString('ru')} \₽
                    </div>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-lg ${
                    STATUS_COLORS[c.status] || 'bg-tg-secondary text-tg-hint'
                  }`}
                >
                  {STATUS_LABELS[c.status] || c.status}
                </span>
              </div>

              {c.meeting_url && (
                <a
                  href={c.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-tg-link text-xs block mb-2"
                >
                  Ссылка на звонок
                </a>
              )}

              {c.client_note && (
                <p className="text-xs text-tg-hint mb-2">
                  Клиент: {c.client_note}
                </p>
              )}

              {c.converted_appointment_id && (
                <div className="text-xs text-green-600 mb-2">
                  Конвертирована в запись #{c.converted_appointment_id}
                </div>
              )}

              {(c.status === 'confirmed' || c.status === 'in_progress') && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => completeMutation.mutate(c.id)}
                    className="flex-1 bg-green-500 text-white text-xs py-1.5 rounded-lg"
                  >
                    Завершить
                  </button>
                  <button
                    onClick={() => cancelMutation.mutate(c.id)}
                    className="flex-1 bg-red-500/15 text-red-500 text-xs py-1.5 rounded-lg"
                  >
                    Отменить
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ConsultationStatsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['consultation-stats'],
    queryFn: () => consultationsApi.stats().then((r) => r.data),
  });

  if (isLoading) return <ListSkeleton count={2} />;

  const stats = data as ConsultationStatsData | undefined;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Всего" value={stats?.total ?? 0} />
        <StatCard label="Завершено" value={stats?.completed ?? 0} />
        <StatCard label="Отменено" value={stats?.cancelled ?? 0} />
        <StatCard
          label="Конверсия"
          value={`${stats?.conversion_rate ?? 0}%`}
          highlight
        />
      </div>

      <Card>
        <h3 className="text-sm font-medium mb-2">Что такое конверсия?</h3>
        <p className="text-xs text-tg-hint">
          Процент завершённых консультаций, которые привели к записи на услугу.
          Чем выше, тем эффективнее ваши онлайн-консультации.
        </p>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${
        highlight ? 'bg-brand-500/10' : 'bg-tg-secondary'
      }`}
    >
      <div className="text-xs text-tg-hint mb-1">{label}</div>
      <div
        className={`text-lg font-bold ${
          highlight ? 'text-brand-600' : 'text-tg-text'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
