import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeaderBackButton } from "@/components/common/BackButton";
import { mastersApi } from '@/api/endpoints';
import { FormSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import PageHeader from '@/shared/ui/PageHeader';
import Button from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';
import { Clock, Save } from 'lucide-react';
import clsx from 'clsx';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
const DAY_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

interface DaySchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_step_min: number;
  is_active: boolean;
}

const DEFAULT_SCHEDULE: DaySchedule[] = DAYS.map((_, i) => ({
  day_of_week: i,
  start_time: '09:00',
  end_time: '18:00',
  break_start: '13:00',
  break_end: '14:00',
  slot_step_min: 30,
  is_active: i < 5,
}));

export default function WorkSchedule() {
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [initialized, setInitialized] = useState(false);

  const { data: serverData, isLoading } = useQuery({
    queryKey: ['my-schedule'],
    queryFn: () => mastersApi.getSchedule().then((r) => r.data),
  });

  useEffect(() => {
    if (serverData && !initialized) {
      if (Array.isArray(serverData) && serverData.length > 0) {
        const merged = DEFAULT_SCHEDULE.map((def) => {
          const existing = (serverData as DaySchedule[]).find(
            (d) => d.day_of_week === def.day_of_week,
          );
          return existing
            ? { ...def, ...existing, is_active: existing.is_active ?? true }
            : def;
        });
        setSchedule(merged);
      }
      setInitialized(true);
    }
  }, [serverData, initialized]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const active = schedule.filter((d) => d.is_active).map((d) => ({
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
        break_start: d.break_start || undefined,
        break_end: d.break_end || undefined,
        slot_step_min: d.slot_step_min || 30,
      }));
      return mastersApi.updateSchedule(active);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-schedule'] });
      toast.success('Расписание сохранено');
    },
    onError: () => toast.error('Ошибка сохранения'),
  });

  const updateDay = (dayIdx: number, patch: Partial<DaySchedule>) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day_of_week === dayIdx ? { ...d, ...patch } : d))
    );
  };

  if (isLoading && !initialized) return <div className="px-screen-x py-section-y"><FormSkeleton rows={7} /></div>;

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text pb-24 animate-fade-in">
      <PageHeader
        title="Рабочее расписание"
        left={<HeaderBackButton to="/master/settings" />}
      />
      <div className="px-screen-x">
      <p className="text-sm text-tg-hint mb-5">Настройте рабочие часы по дням недели</p>

      <div className="flex flex-col gap-3">
        {schedule.map((day) => (
          <Card key={day.day_of_week} className={clsx(!day.is_active && 'opacity-50')}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateDay(day.day_of_week, { is_active: !day.is_active })}
                  className={clsx(
                    'w-10 h-6 rounded-full transition-all relative',
                    day.is_active ? 'bg-brand-500' : 'bg-tg-secondary'
                  )}
                >
                  <div className={clsx(
                    'w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all',
                    day.is_active ? 'left-[18px]' : 'left-0.5'
                  )} />
                </button>
                <span className="font-medium text-sm">{DAY_FULL[day.day_of_week]}</span>
              </div>
              <span className="text-xs text-tg-hint">{DAYS[day.day_of_week]}</span>
            </div>

            {day.is_active && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-tg-hint" />
                  <span className="text-xs text-tg-hint w-16">Работа:</span>
                  <input
                    type="time"
                    value={day.start_time}
                    onChange={(e) => updateDay(day.day_of_week, { start_time: e.target.value })}
                    className="input-field !h-auto !py-1 !px-2 !text-sm flex-1"
                  />
                  <span className="text-tg-hint text-xs">—</span>
                  <input
                    type="time"
                    value={day.end_time}
                    onChange={(e) => updateDay(day.day_of_week, { end_time: e.target.value })}
                    className="input-field !h-auto !py-1 !px-2 !text-sm flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-tg-hint opacity-50" />
                  <span className="text-xs text-tg-hint w-16">Перерыв:</span>
                  <input
                    type="time"
                    value={day.break_start || ''}
                    onChange={(e) => updateDay(day.day_of_week, { break_start: e.target.value || null })}
                    className="input-field !h-auto !py-1 !px-2 !text-sm flex-1"
                  />
                  <span className="text-tg-hint text-xs">—</span>
                  <input
                    type="time"
                    value={day.break_end || ''}
                    onChange={(e) => updateDay(day.day_of_week, { break_end: e.target.value || null })}
                    className="input-field !h-auto !py-1 !px-2 !text-sm flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-tg-hint opacity-30" />
                  <span className="text-xs text-tg-hint w-16">Шаг:</span>
                  <select
                    value={day.slot_step_min}
                    onChange={(e) => updateDay(day.day_of_week, { slot_step_min: Number(e.target.value) })}
                    className="input-field !h-auto !py-1 !px-2 !text-sm flex-1"
                  >
                    <option value={15}>15 мин</option>
                    <option value={30}>30 мин</option>
                    <option value={45}>45 мин</option>
                    <option value={60}>60 мин</option>
                  </select>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-5">
        <Button
          onClick={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
          className="w-full"
        >
          <Save className="w-4 h-4 mr-2" />
          Сохранить расписание
        </Button>
      </div>
      </div>
    </div>
  );
}
