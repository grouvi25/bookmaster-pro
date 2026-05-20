import { useQuery } from '@tanstack/react-query';
import { superadminApi } from '@/api/endpoints';
import { StatGridSkeleton } from '@/shared/ui/Skeleton';
import StatCard from '@/shared/ui/StatCard';
import Card from '@/shared/ui/Card';
import { BarChart3, Users, DollarSign, Ticket } from 'lucide-react';
import { fmtRub } from '../shared';

interface DashboardData {
  mrr?: number;
  arr?: number;
  month_revenue?: number;
  total_revenue?: number;
  transaction_revenue_month?: number;
  avg_revenue_per_master?: number;
  ltv_avg?: number;
  total_masters?: number;
  active_masters?: number;
  new_masters_30d?: number;
  new_masters_week?: number;
  total_clients?: number;
  total_appointments?: number;
  today_bookings?: number;
  churn_rate_30d?: number;
  conversion_rate?: number;
  open_tickets?: number;
  sla_breached_tickets?: number;
  nps_score?: number | null;
  nps_quarter?: string;
  nps_responses?: number;
  plan_distribution?: Record<string, number>;
  appointments_by_day?: { date: string; count: number }[];
}

export default function DashboardTab() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['superadmin-dashboard'],
    queryFn: () => superadminApi.dashboard().then((r) => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <StatGridSkeleton count={8} />;
  const s = data || {};

  return (
    <div className="flex flex-col gap-4">
      {/* Финансы (MRR/ARR/LTV/Transaction) */}
      <div>
        <h3 className="text-h3 font-semibold mb-2 flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-tg-hint" /> Финансы
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="MRR" value={fmtRub(s.mrr)} />
          <StatCard label="ARR" value={fmtRub(s.arr)} />
          <StatCard label="Выручка (мес)" value={fmtRub(s.month_revenue)} />
          <StatCard label="Комиссия (мес)" value={fmtRub(s.transaction_revenue_month)} />
          <StatCard label="LTV среднее" value={fmtRub(s.ltv_avg)} />
          <StatCard label="Total revenue" value={fmtRub(s.total_revenue)} />
        </div>
      </div>

      {/* Мастера / клиенты */}
      <div>
        <h3 className="text-h3 font-semibold mb-2 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-tg-hint" /> Аудитория
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Всего мастеров" value={s.total_masters ?? 0} />
          <StatCard label="Активных (30д)" value={s.active_masters ?? 0} />
          <StatCard label="Новых (7д)" value={s.new_masters_week ?? 0} />
          <StatCard label="Новых (30д)" value={s.new_masters_30d ?? 0} />
          <StatCard label="Клиентов" value={s.total_clients ?? 0} />
          <StatCard label="Конверсия в запись" value={`${s.conversion_rate ?? 0}%`} />
        </div>
      </div>

      {/* Записи / Churn */}
      <div>
        <h3 className="text-h3 font-semibold mb-2 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-tg-hint" /> Активность
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Записей сегодня" value={s.today_bookings ?? 0} />
          <StatCard label="Записей всего" value={s.total_appointments ?? 0} />
          <StatCard label="Churn (30д)" value={`${s.churn_rate_30d ?? 0}%`} />
        </div>
      </div>

      {/* Поддержка + NPS */}
      <div>
        <h3 className="text-h3 font-semibold mb-2 flex items-center gap-1.5">
          <Ticket className="w-4 h-4 text-tg-hint" /> Поддержка и NPS
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Открытых тикетов" value={s.open_tickets ?? 0} />
          <StatCard label="SLA нарушений" value={s.sla_breached_tickets ?? 0} />
          <StatCard
            label={`NPS ${s.nps_quarter || ''}`}
            value={s.nps_score == null ? '—' : `${s.nps_score}`}
          />
          <StatCard label="Ответов на NPS" value={s.nps_responses ?? 0} />
        </div>
      </div>

      {/* Plan distribution */}
      {s.plan_distribution && Object.keys(s.plan_distribution).length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold mb-2">Распределение по тарифам</h3>
          <div className="flex flex-col gap-1">
            {Object.entries(s.plan_distribution).map(([plan, count]) => (
              <div key={plan} className="flex justify-between text-xs">
                <span className="capitalize">{plan}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
