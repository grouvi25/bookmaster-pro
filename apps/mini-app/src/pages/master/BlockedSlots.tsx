import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Loading from '@/components/common/Loading';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import SectionBack from '@/shared/ui/SectionBack';
import EmptyState from '@/shared/ui/EmptyState';
import { toast } from '@/shared/ui/Toast';
import { Plus, Trash2 } from 'lucide-react';
import api from '@/api/client';

interface BlockedSlot {
  id: number;
  date_from: string;
  date_to: string;
  time_from: string | null;
  time_to: string | null;
  reason: string | null;
}

export default function BlockedSlots() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery<BlockedSlot[]>({
    queryKey: ['blocked-slots'],
    queryFn: () => api.get('/booking/blocked').then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/booking/blocked/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-slots'] });
      toast.success('Блокировка удалена');
    },
  });

  if (isLoading) return <Loading />;

  const slots = data || [];

  return (
    <div className="px-screen-x pt-section-y pb-24 animate-fade-in">
      <SectionBack onBack={() => navigate(-1)} />
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold tracking-tight">Выходные и перерывы</h1>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-3.5 h-3.5" /> Добавить
        </Button>
      </div>

      {showCreate && (
        <CreateBlockedSlot onClose={() => setShowCreate(false)} />
      )}

      {slots.length === 0 ? (
        <Card className="!py-10">
          <EmptyState
            emoji="\uD83D\uDEAB"
            title="Нет блокировок"
            description="Добавьте выходные или перерывы"
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {slots.map((slot) => (
            <Card key={slot.id} className="flex justify-between items-center">
              <div>
                <div className="font-medium text-sm">
                  {new Date(slot.date_from).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  {slot.date_from !== slot.date_to && (
                    <> — {new Date(slot.date_to).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</>
                  )}
                </div>
                {slot.time_from && slot.time_to && (
                  <div className="text-xs text-tg-hint">{slot.time_from} — {slot.time_to}</div>
                )}
                {!slot.time_from && (
                  <div className="text-xs text-tg-hint">Весь день</div>
                )}
                {slot.reason && (
                  <div className="text-xs text-tg-hint mt-0.5">{slot.reason}</div>
                )}
              </div>
              <button
                onClick={() => deleteMutation.mutate(slot.id)}
                className="text-red-400 p-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateBlockedSlot({ onClose }: { onClose: () => void }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [reason, setReason] = useState('');
  const [allDay, setAllDay] = useState(true);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/booking/blocked', {
        date_from: dateFrom,
        date_to: dateTo || dateFrom,
        ...(allDay ? {} : { time_from: timeFrom, time_to: timeTo }),
        reason: reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-slots'] });
      toast.success('Блокировка создана');
      onClose();
    },
    onError: () => toast.error('Ошибка создания'),
  });

  return (
    <Card className="mb-4">
      <h3 className="text-sm font-semibold mb-3">Новая блокировка</h3>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-xs text-tg-hint mb-1 block">С</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="text-xs text-tg-hint mb-1 block">По</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="rounded"
        />
        Весь день
      </label>

      {!allDay && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            type="time"
            value={timeFrom}
            onChange={(e) => setTimeFrom(e.target.value)}
            className="input-field"
            placeholder="С"
          />
          <input
            type="time"
            value={timeTo}
            onChange={(e) => setTimeTo(e.target.value)}
            className="input-field"
            placeholder="По"
          />
        </div>
      )}

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Причина (необязательно)"
        className="input-field mb-3"
      />

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Отмена</Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => createMutation.mutate()}
          disabled={!dateFrom || createMutation.isPending}
        >
          Создать
        </Button>
      </div>
    </Card>
  );
}
