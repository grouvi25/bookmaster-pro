import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { servicesApi, clientsApi, bookingApi, mastersApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import BottomSheet from '@/shared/ui/BottomSheet';
import Button from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';
import { format, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';
import type { MasterProfile } from '@/shared/types/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Предзаполненная дата (yyyy-MM-dd), напр. из календаря расписания. */
  initialDate?: string;
}

interface ServiceItem {
  id: number;
  name: string;
  price: number;
  duration_min: number;
}

interface ClientItem {
  client_id: number;
  display_name: string;
  phone: string | null;
}

interface Slot {
  start: string;
  available: boolean;
}

export default function NewBookingModal({ isOpen, onClose, initialDate }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [pickedClientId, setPickedClientId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [pickedDate, setPickedDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [pickedTime, setPickedTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: master } = useQuery<MasterProfile>({
    queryKey: ['master-profile'],
    queryFn: () => mastersApi.getProfile().then((r) => r.data),
    enabled: isOpen,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['my-services'],
    queryFn: () => servicesApi.list().then((r) => r.data),
    enabled: isOpen,
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients', clientName],
    queryFn: () => clientsApi.list({ q: clientName }).then((r) => r.data),
    enabled: isOpen && clientName.length >= 2 && pickedClientId === null,
  });

  const masterId = master?.id ?? null;

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', masterId, pickedDate, serviceId],
    queryFn: () => bookingApi.getSlots(masterId!, pickedDate, serviceId!).then((r) => r.data),
    enabled: isOpen && !!masterId && !!serviceId && !!pickedDate,
  });

  const services = toArray<ServiceItem>(servicesData);
  const clients = toArray<ClientItem>(clientsData);
  const slots = toArray<Slot>(slotsData).filter((s) => s.available);
  const selectedService = services.find((s) => s.id === serviceId);

  const dateOptions = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  const reset = () => {
    setClientName('');
    setClientPhone('');
    setPickedClientId(null);
    setServiceId(null);
    setPickedDate(initialDate || format(new Date(), 'yyyy-MM-dd'));
    setPickedTime(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const goCreateService = () => {
    handleClose();
    navigate('/master/services');
  };

  const handleSubmit = async () => {
    if (!clientName.trim()) {
      toast.error('Укажите имя клиента');
      return;
    }
    if (!serviceId) {
      toast.error('Выберите услугу');
      return;
    }
    if (!pickedTime) {
      toast.error('Выберите время');
      return;
    }
    setSubmitting(true);
    try {
      await bookingApi.create({
        master_id: masterId,
        service_id: serviceId,
        date: pickedDate,
        time_start: pickedTime,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() || undefined,
      });
      toast.success('Запись создана');
      queryClient.invalidateQueries({ queryKey: ['master-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['master-bookings-today'] });
      handleClose();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Не удалось создать запись';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!clientName.trim() && !!serviceId && !!pickedTime;

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Новая запись" fullHeight>
      <div className="flex flex-col gap-5 px-screen-x pt-1 pb-4">
        {/* Клиент */}
        <div>
          <div className="text-aux text-tg-hint mb-2">Клиент</div>
          <input
            type="text"
            value={clientName}
            onChange={(e) => {
              setClientName(e.target.value);
              setPickedClientId(null);
            }}
            placeholder="Имя клиента"
            className="w-full h-[52px] px-4 rounded-btn bg-tg-secondary text-tg-text outline-none"
          />
          {clients.length > 0 && pickedClientId === null && (
            <div className="mt-1.5 flex flex-col gap-1">
              {clients.slice(0, 4).map((c) => (
                <button
                  key={c.client_id}
                  onClick={() => {
                    setClientName(c.display_name);
                    setClientPhone(c.phone || '');
                    setPickedClientId(c.client_id);
                  }}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-card bg-surface-elevated text-left active:scale-[0.98] transition-all"
                >
                  <span className="font-medium text-sm">{c.display_name}</span>
                  <span className="text-xs text-tg-hint">{c.phone || ''}</span>
                </button>
              ))}
            </div>
          )}
          <input
            type="tel"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            placeholder="Телефон (необязательно)"
            className="w-full h-[52px] px-4 mt-2 rounded-btn bg-tg-secondary text-tg-text outline-none"
          />
        </div>

        {/* Услуга */}
        <div>
          <div className="text-aux text-tg-hint mb-2">Услуга</div>
          {services.length === 0 ? (
            <button
              onClick={goCreateService}
              className="w-full text-left px-4 py-3.5 rounded-card bg-tg-secondary text-sm active:scale-[0.98] transition-all"
            >
              У вас пока нет услуг.{' '}
              <span className="text-tg-link font-semibold underline">Создать услугу →</span>
            </button>
          ) : (
            <div className="flex flex-col gap-1.5">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setServiceId(s.id);
                    setPickedTime(null);
                  }}
                  className={clsx(
                    'flex items-center justify-between px-4 py-3 rounded-card text-left transition-all active:scale-[0.98]',
                    serviceId === s.id
                      ? 'bg-brand-500 text-white'
                      : 'bg-tg-secondary text-tg-text'
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{s.name}</div>
                    <div
                      className={clsx(
                        'text-xs mt-0.5',
                        serviceId === s.id ? 'text-white/80' : 'text-tg-hint'
                      )}
                    >
                      {s.duration_min} мин
                    </div>
                  </div>
                  <span className="font-semibold text-sm whitespace-nowrap ml-3">
                    {Number(s.price).toLocaleString('ru')} ₽
                  </span>
                </button>
              ))}
              <button
                onClick={goCreateService}
                className="text-tg-link text-sm font-medium text-left px-1 pt-1"
              >
                + Создать новую услугу
              </button>
            </div>
          )}
        </div>

        {/* Дата */}
        {serviceId && (
          <div>
            <div className="text-aux text-tg-hint mb-2">Дата</div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {dateOptions.map((d) => {
                const key = format(d, 'yyyy-MM-dd');
                const isSel = key === pickedDate;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setPickedDate(key);
                      setPickedTime(null);
                    }}
                    className={clsx(
                      'flex flex-col items-center min-w-[52px] py-2 px-1.5 rounded-card transition-all',
                      isSel ? 'bg-brand-500 text-white' : 'bg-tg-secondary text-tg-text'
                    )}
                  >
                    <span className="text-2xs uppercase">
                      {format(d, 'EEE', { locale: ru })}
                    </span>
                    <span className="text-lg font-bold mt-0.5">{format(d, 'd')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Время */}
        {serviceId && (
          <div>
            <div className="text-aux text-tg-hint mb-2">Время</div>
            {slotsLoading ? (
              <div className="text-sm text-tg-hint py-2">Загрузка слотов…</div>
            ) : slots.length === 0 ? (
              <div className="text-sm text-tg-hint py-2">
                Нет свободных слотов на этот день
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {slots.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => setPickedTime(slot.start)}
                    className={clsx(
                      'py-2.5 rounded-card text-sm font-medium transition-all active:scale-95',
                      pickedTime === slot.start
                        ? 'bg-brand-500 text-white'
                        : 'bg-tg-secondary text-tg-text'
                    )}
                  >
                    {slot.start}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky-футер: всегда виден, не перекрывается */}
      <div className="sticky bottom-0 bg-surface-primary border-t border-tg-secondary px-screen-x pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        {selectedService && pickedTime && (
          <div className="text-xs text-tg-hint mb-2 text-center">
            {selectedService.name} · {format(new Date(pickedDate), 'd MMM', { locale: ru })} ·{' '}
            {pickedTime} · {Number(selectedService.price).toLocaleString('ru')} ₽
          </div>
        )}
        <Button fullWidth size="lg" loading={submitting} disabled={!canSubmit} onClick={handleSubmit}>
          Создать запись
        </Button>
      </div>
    </BottomSheet>
  );
}
