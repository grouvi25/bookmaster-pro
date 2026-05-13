import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { servicesApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import Loading from '@/components/common/Loading';
import { Clock, ChevronRight } from 'lucide-react';

export default function SelectService() {
  const navigate = useNavigate();
  const { masterId, setService } = useBookingStore();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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

  const categories: string[] = Array.from(new Set(
    (services || []).map((s: Record<string, unknown>) => String((s.category as string) || 'Основные'))
  ));
  const filteredServices = activeCategory
    ? (services || []).filter((s: Record<string, unknown>) => ((s.category as string) || 'Основные') === activeCategory)
    : services || [];

  return (
    <div className="p-5 pb-24 animate-slide-up">
      <BackButton />
      <h1 className="text-2xl font-bold tracking-tight mb-1">Выберите услугу</h1>
      <p className="text-tg-hint text-sm mb-5">Шаг 1 из 5</p>

      {categories.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={`chip whitespace-nowrap ${
              !activeCategory ? 'chip-active' : 'chip-inactive'
            }`}
          >
            Все
          </button>
          {categories.map((cat: string) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`chip whitespace-nowrap ${
                activeCategory === cat ? 'chip-active' : 'chip-inactive'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filteredServices.map((svc: Record<string, unknown>) => (
          <button
            key={svc.id as number}
            onClick={() => handleSelect(svc)}
            className="flex items-center p-4 bg-surface-elevated shadow-card rounded-2xl text-left active:scale-[0.98] transition-all duration-200"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-tg-text">{String(svc.name)}</div>
              <div className="text-xs text-tg-hint mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {Number(svc.duration_min)} мин
                {svc.description ? ` \u00b7 ${String(svc.description)}` : null}
              </div>
            </div>
            <div className="font-bold text-brand-600 ml-3 text-sm whitespace-nowrap">
              {svc.price
                ? `${Number(svc.price).toLocaleString('ru')} \u20bd`
                : svc.price_from
                  ? `от ${Number(svc.price_from).toLocaleString('ru')} \u20bd`
                  : 'Дог.'}
            </div>
            <ChevronRight className="w-4 h-4 text-tg-hint ml-2 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
