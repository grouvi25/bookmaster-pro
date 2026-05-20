import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { superadminApi } from '@/api/endpoints';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import StatCard from '@/shared/ui/StatCard';
import Card from '@/shared/ui/Card';
import { fmtRub } from '../shared';

interface FinanceData {
  mrr?: number;
  arr?: number;
  period_revenue?: number;
  period_commission?: number;
  total_refunds?: number;
  transaction_count?: number;
  mrr_forecast_3m?: number;
  overdue_subscriptions?: number;
  revenue_by_day?: { date: string; revenue: number; count: number }[];
}

const PERIOD_OPTIONS = [7, 30, 90, 365] as const;

export default function FinanceTab() {
  const [periodDays, setPeriodDays] = useState<number>(30);
  const { data, isLoading } = useQuery<FinanceData>({
    queryKey: ['superadmin-finance', periodDays],
    queryFn: () => superadminApi.finance(periodDays).then((r) => r.data),
  });

  if (isLoading) return <ListSkeleton count={4} />;
  const f = data || {};

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
        <StatCard label="MRR" value={fmtRub(f.mrr)} />
        <StatCard label="ARR" value={fmtRub(f.arr)} />
        <StatCard label="Выручка (период)" value={fmtRub(f.period_revenue)} />
        <StatCard label="Комиссия (период)" value={fmtRub(f.period_commission)} />
        <StatCard label="Возвраты" value={fmtRub(f.total_refunds)} />
        <StatCard label="Транзакций" value={f.transaction_count ?? 0} />
        <StatCard label="Прогноз 3м" value={fmtRub(f.mrr_forecast_3m)} />
        <StatCard label="Просрочено подписок" value={f.overdue_subscriptions ?? 0} />
      </div>

      {f.revenue_by_day && f.revenue_by_day.length > 0 && (
        <Card>
          <h3 className="text-sm font-medium mb-2">Выручка по дням</h3>
          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {f.revenue_by_day.map((d) => (
              <div key={d.date} className="flex justify-between text-xs">
                <span className="text-tg-hint">{d.date}</span>
                <span>
                  {d.revenue.toLocaleString('ru')} ₽ ({d.count})
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
