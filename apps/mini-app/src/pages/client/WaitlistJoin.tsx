import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { waitlistApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { Bell, Clock, CheckCircle } from 'lucide-react';

export default function WaitlistJoin() {
  const navigate = useNavigate();
  const { masterId, masterName, serviceId, serviceName } = useBookingStore();
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);

  const handleJoin = async () => {
    if (!masterId || !serviceId) {
      toast.error('Выберите мастера и услугу');
      return;
    }

    setLoading(true);
    try {
      await waitlistApi.join({
        master_id: masterId,
        service_id: serviceId,
        phone: phone || undefined,
        comment: comment || undefined,
      });
      setJoined(true);
      toast.success('Вы в листе ожидания!');
    } catch {
      toast.error('Ошибка. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  if (joined) {
    return (
      <div className="px-screen-x pt-section-y pb-24 animate-fade-in">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-16 h-16 bg-accent-emerald/10 rounded-card flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-accent-emerald" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Вы в листе ожидания!</h1>
          <p className="text-tg-hint text-sm mb-6 max-w-[280px]">
            Мы уведомим вас, когда появится свободное окошко к мастеру {masterName}
          </p>
          <Button onClick={() => navigate('/')} variant="secondary">
            На главную
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-screen-x pt-section-y pb-24 animate-slide-up">
      <BackButton to="/book/date" />
      <h1 className="text-2xl font-bold tracking-tight mb-1">Лист ожидания</h1>
      <p className="text-tg-hint text-sm mb-5">
        Нет свободных дат? Мы уведомим, когда появится окошко
      </p>

      <Card className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <Bell className="w-5 h-5 text-brand-500" />
          <div>
            <div className="font-medium text-sm">Как это работает</div>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm text-tg-hint">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Когда у мастера освободится слот — вы получите уведомление</span>
          </div>
          <div className="flex items-start gap-2">
            <Bell className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>У вас будет 30 минут, чтобы подтвердить запись</span>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="text-sm text-tg-hint mb-1">Мастер</div>
        <div className="font-medium">{masterName || 'Не выбран'}</div>
        <div className="text-sm text-tg-hint mt-2 mb-1">Услуга</div>
        <div className="font-medium">{serviceName || 'Не выбрана'}</div>
      </Card>

      <div className="mb-4">
        <label className="text-sm font-medium mb-1.5 block">Телефон (необязательно)</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+7 (___) ___-__-__"
          type="tel"
                  className="input-field"
                />
      </div>

      <div className="mb-6">
        <label className="text-sm font-medium mb-1.5 block">Комментарий (необязательно)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Пожелания по времени или дате..."
          rows={3}
          className="input-field !h-auto resize-none"
        />
      </div>

      <Button onClick={handleJoin} loading={loading} fullWidth size="lg">
        Встать в лист ожидания
      </Button>
    </div>
  );
}
