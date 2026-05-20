import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bookingApi, portfolioApi, uploadsApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import { fmtRub } from '@/shared/lib/format';
import {
  bookingStatusLabel,
  bookingStatusVariant,
} from '@/shared/lib/bookingStatus';
import { BookingCardSkeleton } from '@/shared/ui/Skeleton';
import PageHeader from '@/shared/ui/PageHeader';
import StatusBadge from '@/shared/ui/StatusBadge';
import BottomSheet from '@/shared/ui/BottomSheet';
import Button from '@/shared/ui/Button';
import EmptyState from '@/shared/ui/EmptyState';
import { toast } from '@/shared/ui/Toast';
import {
  format, addDays, startOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, addMonths, subMonths,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, CalendarOff, Camera } from 'lucide-react';
import type { Booking } from '@/shared/types/api';

export default function Schedule() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [photoPromptBooking, setPhotoPromptBooking] = useState<Booking | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['master-schedule', selectedDate],
    queryFn: () =>
      bookingApi.masterBookings({ date_from: selectedDate, date_to: selectedDate }).then((r) => r.data),
  });

  if (isLoading) return <div className="px-screen-x py-section-y"><BookingCardSkeleton count={5} /></div>;

  const bookings = toArray<Booking>(data);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handleAction = async (action: 'confirm' | 'complete' | 'cancel' | 'no_show') => {
    if (!selectedBooking) return;
    setActionLoading(true);
    try {
      switch (action) {
        case 'confirm':
          await bookingApi.confirm(selectedBooking.id);
          toast.success('Запись подтверждена');
          break;
        case 'complete':
          await bookingApi.complete(selectedBooking.id);
          toast.success('Визит завершён');
          setPhotoPromptBooking(selectedBooking);
          break;
        case 'cancel':
          await bookingApi.cancelByMaster(selectedBooking.id, cancelReason || undefined);
          toast.success('Запись отменена');
          break;
        case 'no_show':
          await bookingApi.noShow(selectedBooking.id);
          toast.success('Отмечен как не пришёл');
          break;
      }
      await queryClient.invalidateQueries({ queryKey: ['master-schedule', selectedDate] });
      setSelectedBooking(null);
      setCancelReason('');
    } catch {
      toast.error('Ошибка при обновлении статуса');
    } finally {
      setActionLoading(false);
    }
  };

  const isPending = selectedBooking?.status === 'pending';
  const isConfirmed = selectedBooking?.status === 'confirmed' || selectedBooking?.status === 'paid';
  const isActive = isPending || isConfirmed;

  return (
    <div className="px-screen-x">
      <PageHeader
        title="Расписание"
        right={
          <div className="flex bg-tg-secondary rounded-card p-1">
            {(['week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={clsx(
                  'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                  viewMode === mode
                    ? 'bg-tg-bg text-tg-text shadow-sm'
                    : 'text-tg-hint'
                )}
              >
                {mode === 'week' ? 'Неделя' : 'Месяц'}
              </button>
            ))}
          </div>
        }
      />

      {viewMode === 'week' ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="w-8 h-8 rounded-xl bg-tg-secondary flex items-center justify-center active:scale-90 transition-transform"
            >
              <ChevronLeft className="w-4 h-4 text-tg-hint" />
            </button>
            <span className="font-semibold text-sm">
              {format(weekStart, 'd MMM', { locale: ru })} &mdash;{' '}
              {format(addDays(weekStart, 6), 'd MMM', { locale: ru })}
            </span>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="w-8 h-8 rounded-xl bg-tg-secondary flex items-center justify-center active:scale-90 transition-transform"
            >
              <ChevronRight className="w-4 h-4 text-tg-hint" />
            </button>
          </div>

          <div className="flex gap-1.5 mb-5 overflow-x-auto">
            {weekDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const isSelected = key === selectedDate;
              const isToday = key === format(new Date(), 'yyyy-MM-dd');
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={clsx(
                    'flex flex-col items-center min-w-[46px] py-2 px-1.5 rounded-card transition-all duration-200',
                    isSelected
                      ? 'bg-brand-500 text-white shadow-button'
                      : isToday
                        ? 'bg-brand-500/10 text-brand-600'
                        : 'bg-tg-secondary text-tg-text'
                  )}
                >
                  <span className="text-2xs font-medium uppercase">
                    {format(day, 'EEE', { locale: ru })}
                  </span>
                  <span className="text-lg font-bold mt-0.5">{format(day, 'd')}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="w-8 h-8 rounded-xl bg-tg-secondary flex items-center justify-center active:scale-90 transition-transform"
            >
              <ChevronLeft className="w-4 h-4 text-tg-hint" />
            </button>
            <span className="font-semibold text-sm capitalize">
              {format(currentMonth, 'LLLL yyyy', { locale: ru })}
            </span>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="w-8 h-8 rounded-xl bg-tg-secondary flex items-center justify-center active:scale-90 transition-transform"
            >
              <ChevronRight className="w-4 h-4 text-tg-hint" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-5">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
              <div key={d} className="text-center text-2xs font-medium text-tg-hint py-1">{d}</div>
            ))}
            {(() => {
              const monthStart = startOfMonth(currentMonth);
              const monthEnd = endOfMonth(currentMonth);
              const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
              const startPad = (getDay(monthStart) + 6) % 7;
              const cells: React.ReactNode[] = [];
              for (let i = 0; i < startPad; i++) {
                cells.push(<div key={`pad-${i}`} />);
              }
              days.forEach((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const isSelected = key === selectedDate;
                const isToday = key === format(new Date(), 'yyyy-MM-dd');
                cells.push(
                  <button
                    key={key}
                    onClick={() => setSelectedDate(key)}
                    className={clsx(
                      'aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200',
                      isSelected
                        ? 'bg-brand-500 text-white shadow-button'
                        : isToday
                          ? 'bg-brand-500/10 text-brand-600'
                          : 'text-tg-text hover:bg-tg-secondary'
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                );
              });
              return cells;
            })()}
          </div>
        </>
      )}

      <button
        onClick={() => navigate('/master/blocked-slots')}
        className="w-full mb-4 flex items-center gap-2.5 px-4 py-3 bg-surface-elevated rounded-card text-sm font-medium active:scale-[0.98] transition-transform"
      >
        <CalendarOff className="w-4 h-4 text-tg-hint" />
        Выходные и перерывы
      </button>

      <div className="section-title">
        {format(new Date(selectedDate + 'T00:00:00'), 'd MMMM, EEEE', { locale: ru })}
      </div>

      {bookings.length === 0 ? (
        <EmptyState emoji="📅" title="Нет записей" />
      ) : (
        <div className="flex flex-col gap-2.5">
          {bookings.map((b) => {
            const canAct = ['pending', 'confirmed', 'paid'].includes(b.status);
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBooking(b)}
                className="bg-surface-elevated rounded-card p-3.5 text-left active:scale-[0.98] transition-transform w-full"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className="w-1 h-10 rounded-full bg-brand-400 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm">
                        {b.time} — {b.client_name || 'Клиент'}
                      </div>
                      <div className="text-xs text-tg-hint mt-1">
                        {b.service_name} · {b.duration_min} мин
                        {b.price_final ? ` · ${fmtRub(b.price_final)}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={bookingStatusLabel(b.status)}
                      variant={bookingStatusVariant(b.status)}
                    />
                    {canAct && <span className="text-tg-hint text-xs">›</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Booking Detail Bottom Sheet */}
      <BottomSheet
        isOpen={!!selectedBooking}
        onClose={() => { setSelectedBooking(null); setCancelReason(''); }}
        title="Детали записи"
      >
        {selectedBooking && (
          <div className="px-screen-x pb-8">
            <div className="flex flex-col gap-3 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-tg-hint">Статус</span>
                <StatusBadge
                  label={bookingStatusLabel(selectedBooking.status)}
                  variant={bookingStatusVariant(selectedBooking.status)}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-tg-hint">Клиент</span>
                <span className="text-sm font-medium">{selectedBooking.client_name || 'Не указан'}</span>
              </div>
              {selectedBooking.client_phone && (
                <div className="flex justify-between">
                  <span className="text-sm text-tg-hint">Телефон</span>
                  <a href={`tel:${selectedBooking.client_phone}`} className="text-sm font-medium text-tg-link">
                    {selectedBooking.client_phone}
                  </a>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-tg-hint">Услуга</span>
                <span className="text-sm font-medium">{selectedBooking.service_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-tg-hint">Время</span>
                <span className="text-sm font-medium">
                  {selectedBooking.time} · {selectedBooking.duration_min} мин
                </span>
              </div>
              {selectedBooking.price_final != null && (
                <div className="flex justify-between">
                  <span className="text-sm text-tg-hint">Стоимость</span>
                  <span className="text-sm font-bold">
                    {fmtRub(selectedBooking.price_final)}
                  </span>
                </div>
              )}
              {selectedBooking.client_comment && (
                <div className="flex justify-between">
                  <span className="text-sm text-tg-hint">Комментарий</span>
                  <span className="text-sm text-right max-w-[60%]">{selectedBooking.client_comment}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {isActive && (
              <div className="flex flex-col gap-2">
                {isPending && (
                  <Button
                    onClick={() => handleAction('confirm')}
                    loading={actionLoading}
                    fullWidth
                  >
                    Подтвердить
                  </Button>
                )}
                {isConfirmed && (
                  <Button
                    onClick={() => handleAction('complete')}
                    loading={actionLoading}
                    fullWidth
                  >
                    Завершить визит
                  </Button>
                )}
                {isConfirmed && (
                  <Button
                    onClick={() => handleAction('no_show')}
                    loading={actionLoading}
                    variant="secondary"
                    fullWidth
                  >
                    Не пришёл
                  </Button>
                )}
                <div className="mt-1">
                  <input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Причина отмены (необязательно)"
                    className="input-field mb-2"
                  />
                  <Button
                    onClick={() => handleAction('cancel')}
                    loading={actionLoading}
                    variant="danger"
                    fullWidth
                  >
                    Отменить запись
                  </Button>
                </div>
              </div>
            )}

            {!isActive && (
              <div className="text-center text-sm text-tg-hint py-4">
                Запись {bookingStatusLabel(selectedBooking.status).toLowerCase()}
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Photo prompt after completing a visit */}
      <BottomSheet
        isOpen={!!photoPromptBooking}
        onClose={() => setPhotoPromptBooking(null)}
        title="Добавить фото работы?"
      >
        {photoPromptBooking && (
          <div className="px-screen-x pb-8">
            <p className="text-sm text-tg-hint mb-4">
              Добавьте фото результата в портфолио — клиенты смогут увидеть вашу работу
            </p>
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPhotoUploading(true);
                    try {
                      const uploadResp = await uploadsApi.uploadFile(file, 'portfolio');
                      const fileKey = uploadResp.data?.file_key || uploadResp.data?.s3_key;
                      await portfolioApi.upload({
                        s3_key: fileKey,
                        appointment_id: photoPromptBooking.id,
                      });
                      toast.success('Фото добавлено в портфолио');
                      setPhotoPromptBooking(null);
                    } catch {
                      toast.error('Ошибка загрузки фото');
                    } finally {
                      setPhotoUploading(false);
                    }
                  }}
                />
                <Button
                  fullWidth
                  loading={photoUploading}
                  onClick={() => {}}
                  className="pointer-events-none"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Выбрать фото
                </Button>
              </label>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setPhotoPromptBooking(null)}
              >
                Пропустить
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
