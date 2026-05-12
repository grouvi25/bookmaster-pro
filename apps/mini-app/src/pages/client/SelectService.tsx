import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { servicesApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import Loading from '@/components/common/Loading';

export default function SelectService() {
  const navigate = useNavigate();
  const { masterId, setService } = useBookingStore();

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', masterId],
    queryFn: () => servicesApi.list(masterId!).then((r) => r.data),
    enabled: !!masterId,
  });

  if (isLoading) return <Loading />;

  const handleSelect = (svc: Record<string, unknown>) => {
    setService(
      svc.id as number,
      svc.name as string,
      Number(svc.price || svc.price_from || 0),
      svc.duration_min as number
    );
    navigate('/book/date');
  };

  return (
    <div className="p-4 animate-slide-up">
      <BackButton />
      <h1 className="text-xl font-bold mb-1">Выберите услугу</h1>
      <p className="text-tg-hint text-sm mb-4">Шаг 1 из 5</p>

      <div className="flex flex-col gap-2">
        {services?.map((svc: Record<string, unknown>) => (
          <button
            key={svc.id as number}
            onClick={() => handleSelect(svc)}
            className="flex justify-between items-center p-4 bg-tg-secondary rounded-xl text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex-1">
              <div className="font-medium text-tg-text">{String(svc.name)}</div>
              <div className="text-xs text-tg-hint mt-0.5">
                {Number(svc.duration_min)} мин
                {svc.description ? ` \u00b7 ${String(svc.description)}` : null}
              </div>
            </div>
            <div className="font-bold text-brand-600 ml-3">
              {svc.price
                ? `${Number(svc.price).toLocaleString('ru')} \u20bd`
                : svc.price_from
                  ? `от ${Number(svc.price_from).toLocaleString('ru')} \u20bd`
                  : 'Дог.'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
