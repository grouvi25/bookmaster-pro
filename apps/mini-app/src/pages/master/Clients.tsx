import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clientsApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { ClientCardSkeleton } from '@/shared/ui/Skeleton';
import PageHeader from '@/shared/ui/PageHeader';
import SearchInput from '@/shared/ui/SearchInput';
import EmptyState from '@/shared/ui/EmptyState';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import { User, X, ChevronRight } from 'lucide-react';
import type { ClientCRM } from '@/shared/types/api';
import FeatureGate from '@/shared/ui/FeatureGate';

export default function Clients() {
  return (
    <FeatureGate flag="crm_enabled">
      <ClientsList />
    </FeatureGate>
  );
}

function ClientsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => clientsApi.list({ q: search }).then((r) => r.data),
  });

  if (isLoading) return <div className="px-screen-x py-section-y"><ClientCardSkeleton count={5} /></div>;

  const clients = toArray<ClientCRM>(data);
  const selected = clients.find((c) => (c.client_id ?? c.id) === selectedId);

  return (
    <div className="px-screen-x">
      <PageHeader title="Клиенты" />

      <div className="mb-5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по имени или телефону"
        />
      </div>

      {selected ? (
        <Card className="mb-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-brand-500/10 rounded-card flex items-center justify-center">
                <User className="w-6 h-6 text-brand-500" strokeWidth={1.8} />
              </div>
              <div>
                <div className="font-bold">{selected.name ?? selected.display_name}</div>
                <div className="text-xs text-tg-hint">{selected.phone}</div>
              </div>
            </div>
            <button onClick={() => setSelectedId(null)} className="text-tg-hint p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <Card padding="sm" className="text-center">
              <div className="font-bold text-sm">{selected.visits_count ?? selected.visit_count ?? 0}</div>
              <div className="text-2xs text-tg-hint mt-0.5">Визитов</div>
            </Card>
            <Card padding="sm" className="text-center">
              <div className="font-bold text-sm">{selected.loyalty_points ?? 0}</div>
              <div className="text-2xs text-tg-hint mt-0.5">Баллов</div>
            </Card>
            <Card padding="sm" className="text-center">
              <div className="font-bold text-sm">
                {Number(selected.total_revenue ?? selected.total_spent ?? 0).toLocaleString('ru')}
              </div>
              <div className="text-2xs text-tg-hint mt-0.5">Выручка</div>
            </Card>
          </div>

          {selected.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {selected.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-brand-500/10 text-brand-600 text-xs rounded-lg"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {(selected.notes || selected.master_notes) ? (
            <p className="text-xs text-tg-hint mt-2">
              {String(selected.notes ?? selected.master_notes)}
            </p>
          ) : null}

          <Button
            onClick={() => navigate(`/master/clients/${selectedId}`)}
            fullWidth
            size="sm"
            className="mt-3"
          >
            Подробнее <ChevronRight className="w-4 h-4" />
          </Button>
        </Card>
      ) : null}

      {clients.length === 0 ? (
        <EmptyState emoji="👤" title="Клиенты не найдены" />
      ) : (
        <div className="flex flex-col gap-1">
          {clients.map((c) => (
            <button
              key={c.client_id ?? c.id}
              onClick={() => setSelectedId(c.client_id ?? c.id)}
              className="flex items-center gap-3 p-3.5 bg-surface-elevated rounded-card text-left active:scale-[0.98] transition-all duration-200"
            >
              <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-brand-500" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{c.name ?? c.display_name}</div>
                <div className="text-xs text-tg-hint mt-0.5">
                  {c.phone || 'Нет телефона'}
                  {(c.visits_count ?? c.visit_count) ? ` · ${c.visits_count ?? c.visit_count} визитов` : ''}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-tg-hint" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
