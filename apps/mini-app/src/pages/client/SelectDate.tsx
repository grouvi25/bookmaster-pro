import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import Loading from '@/components/common/Loading';
import { format, addDays, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import clsx from 'clsx';

export default function SelectDate() {
  const navigate = useNavigate();
  const { masterId, serviceId, selectedDate, setDate } = useBookingStore();

  const { data: availableDates, isLoading } = useQuery({
    queryKey: ['available-dates', masterId, serviceId],
    queryFn: () =>
      bookingApi.getAvailableDates(masterId!, serviceId!).then((r) => r.data),
    enabled: !!masterId && !!serviceId,
  });

  if (isLoading) return <Loading />;

  const dates: Date[] = [];
  for (let i = 0; i < 30; i++) {
    dates.push(addDays(new Date(), i));
  }

  const availableSet = new Set(
    (availableDates?.dates || []).map((d: string) =>
      format(parseISO(d), 'yyyy-MM-dd')
    )
  );

  const handleSelectDate = (date: Date) => {
    const formatted = format(date, 'yyyy-MM-dd');
    if (!availableSet.has(formatted)) return;
    setDate(formatted);
    navigate('/book/time');
  };

  return (
    <div className="p-4 animate-slide-up">
      <BackButton to="/book/service" />
      <h1 className="text-xl font-bold mb-1">Выберите дату</h1>
      <p className="text-tg-hint text-sm mb-4">Шаг 2 из 5</p>

      {/* Горизонтальный календарь */}
      <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 scrollbar-hide">
        {dates.map((date) => {
          const key = format(date, 'yyyy-MM-dd');
          const available = availableSet.has(key);
          const selected = selectedDate === key;
          return (
            <button
              key={key}
              onClick={() => handleSelectDate(date)}
              disabled={!available}
              className={clsx(
                'flex flex-col items-center min-w-[56px] py-3 px-2 rounded-xl transition-all',
                selected
                  ? 'bg-tg-button text-tg-button-text'
                  : available
                    ? 'bg-tg-secondary text-tg-text active:scale-95'
                    : 'bg-gray-100 text-gray-300'
              )}
            >
              <span className="text-xs uppercase">
                {format(date, 'EEE', { locale: ru })}
              </span>
              <span className="text-lg font-bold">{format(date, 'd')}</span>
              <span className="text-xs">
                {format(date, 'MMM', { locale: ru })}
              </span>
            </button>
          );
        })}
      </div>

      {!availableDates?.dates?.length && (
        <div className="text-center py-8">
          <p className="text-tg-hint">Нет доступных дат</p>
          <button
            onClick={() => navigate('/book/waitlist')}
            className="mt-3 text-tg-link text-sm"
          >
            Встать в лист ожидания
          </button>
        </div>
      )}
    </div>
  );
}
