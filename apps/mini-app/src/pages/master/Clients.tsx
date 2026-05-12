import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clientsApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import { User, X, Search } from 'lucide-react';

export default function Clients() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => clientsApi.list({ q: search }).then((r) => r.data),
  });

  if (isLoading) return <Loading />;

  const clients = data?.items || [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = clients.find(
    (c: Record<string, unknown>) => c.id === selectedId
  );

  return (
    <div className="p-4 pb-20 animate-fade-in">
      <h1 className="text-xl font-bold mb-3">Клиенты</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tg-hint" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени или телефону"
          className="w-full pl-9 pr-4 py-2.5 bg-tg-secondary rounded-xl text-sm outline-none"
        />
      </div>

      {selected ? (
        <div className="bg-tg-secondary rounded-2xl p-4 mb-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-brand-400" strokeWidth={1.8} />
              </div>
              <div>
                <div className="font-bold">{selected.name as string}</div>
                <div className="text-xs text-tg-hint">
                  {selected.phone as string}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-tg-hint p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 bg-white rounded-lg">
              <div className="font-bold text-sm">{selected.visits_count as number}</div>
              <div className="text-xs text-tg-hint">Визитов</div>
            </div>
            <div className="text-center p-2 bg-white rounded-lg">
              <div className="font-bold text-sm">{selected.loyalty_points as number}</div>
              <div className="text-xs text-tg-hint">Баллов</div>
            </div>
            <div className="text-center p-2 bg-white rounded-lg">
              <div className="font-bold text-sm">
                {Number(selected.total_revenue ?? 0).toLocaleString('ru')}
              </div>
              <div className="text-xs text-tg-hint">Выручка</div>
            </div>
          </div>

          {(selected.tags as string[])?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {(selected.tags as string[]).map((tag: string) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-brand-50 text-brand-600 text-xs rounded-lg"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {selected.notes && (
            <p className="text-xs text-tg-hint mt-2">
              {selected.notes as string}
            </p>
          )}
        </div>
      ) : null}

      {clients.length === 0 ? (
        <div className="text-center py-8">
          <User className="w-8 h-8 text-tg-hint mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-tg-hint">Клиенты не найдены</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {clients.map((c: Record<string, unknown>) => (
            <button
              key={c.id as number}
              onClick={() => setSelectedId(c.id as number)}
              className="flex items-center gap-3 p-3 bg-tg-secondary rounded-xl text-left active:scale-[0.98] transition-transform"
            >
              <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-brand-400" strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">{c.name as string}</div>
                <div className="text-xs text-tg-hint">
                  {c.visits_count as number} визитов
                  {(c.loyalty_points as number) > 0 &&
                    ` \u00b7 ${c.loyalty_points} баллов`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
