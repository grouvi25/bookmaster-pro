import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { superadminApi } from '@/api/endpoints';
import { StatGridSkeleton } from '@/shared/ui/Skeleton';
import StatCard from '@/shared/ui/StatCard';
import Card from '@/shared/ui/Card';

interface GrowthData {
  total_identities?: number;
  total_new_masters?: number;
  conversion_rate?: number;
  masters_by_week?: { week: string; count: number }[];
  retention_cohorts?: { month_offset: number; active_masters: number }[];
  revenue_by_plan?: Record<string, number>;
  top_cities?: { city: string; count: number }[];
  top_specializations?: { specialization: string; count: number }[];
}

const PERIOD_OPTIONS = [30, 90, 180, 365] as const;

export default function GrowthTab() {
  const [periodDays, setPeriodDays] = useState<number>(90);
  const { data, isLoading } = useQuery<GrowthData>({
    queryKey: ['superadmin-growth', periodDays],
    queryFn: () => superadminApi.growth(periodDays).then((r) => r.data),
  });

  if (isLoading) return <StatGridSkeleton count={3} />;
  const g = data || {};

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {PERIOD_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setPeriodDays(d)}
            className={`chip ${periodDays === d ? 'chip-active' : 'chip-inactive'}`}
          >
            {d} дн
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Регистрации" value={g.total_identities ?? 0} />
        <StatCard label="Новых мастеров" value={g.total_new_masters ?? 0} />
        <StatCard label="Конверсия в запись" value={`${g.conversion_rate ?? 0}%`} />
      </div>

      {g.masters_by_week && g.masters_by_week.length > 0 && (
        <Card className="mb-3">
          <h3 className="text-sm font-medium mb-2">Мастера по неделям</h3>
          <div className="flex flex-col gap-1">
            {g.masters_by_week.map((w) => (
              <div key={w.week} className="flex justify-between text-xs">
                <span className="text-tg-hint">{w.week}</span>
                <span className="font-medium">+{w.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {g.retention_cohorts && g.retention_cohorts.length > 0 && (
        <Card className="mb-3">
          <h3 className="text-sm font-semibold mb-2">Retention (активные мастера)</h3>
          <div className="flex flex-col gap-1">
            {g.retention_cohorts.map((c) => (
              <div key={c.month_offset} className="flex justify-between text-xs">
                <span className="text-tg-hint">
                  {c.month_offset === 0 ? 'Этот месяц' : `-${c.month_offset} мес`}
                </span>
                <span className="font-medium">{c.active_masters}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {g.revenue_by_plan && Object.keys(g.revenue_by_plan).length > 0 && (
        <Card className="mb-3">
          <h3 className="text-sm font-semibold mb-2">Revenue по тарифам</h3>
          <div className="flex flex-col gap-1">
            {Object.entries(g.revenue_by_plan).map(([plan, rev]) => (
              <div key={plan} className="flex justify-between text-xs">
                <span className="capitalize">{plan}</span>
                <span className="font-medium">{rev.toLocaleString('ru')} ₽</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {g.top_cities && g.top_cities.length > 0 && (
        <Card className="mb-3">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> Топ-города
          </h3>
          <div className="flex flex-col gap-1">
            {g.top_cities.map((c) => (
              <div key={c.city} className="flex justify-between text-xs">
                <span>{c.city}</span>
                <span className="font-medium">{c.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {g.top_specializations && g.top_specializations.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold mb-2">Топ-специализации</h3>
          <div className="flex flex-col gap-1">
            {g.top_specializations.map((s) => (
              <div key={s.specialization} className="flex justify-between text-xs">
                <span>{s.specialization}</span>
                <span className="font-medium">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
