import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import Loading from '@/components/common/Loading';
import EmptyState from '@/shared/ui/EmptyState';
import { MapPin, Star, Navigation } from 'lucide-react';

interface NearbyMaster {
  id: number;
  display_name: string;
  specialization?: string;
  slug: string;
  avatar_url?: string;
  rating?: number;
  review_count?: number;
  distance_km: number;
}

export default function NearbyMasters() {
  const navigate = useNavigate();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(10);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const { data: masters, isLoading } = useQuery<NearbyMaster[]>({
    queryKey: ['nearby-masters', coords?.lat, coords?.lng, radius],
    queryFn: () =>
      api
        .get('/masters/search/nearby', {
          params: { lat: coords!.lat, lng: coords!.lng, radius_km: radius },
        })
        .then((r) => r.data),
    enabled: !!coords,
  });

  const requestLocation = () => {
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError('Не удалось определить местоположение');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="p-5 pb-24 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Мастера рядом</h1>
      <p className="text-tg-hint text-sm mb-5">Найдите специалиста поблизости</p>

      {!coords ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center">
            <Navigation className="w-8 h-8 text-brand-500" />
          </div>
          <p className="text-sm text-tg-hint text-center max-w-xs">
            Разрешите доступ к геолокации, чтобы найти мастеров рядом с вами
          </p>
          <button
            onClick={requestLocation}
            disabled={locating}
            className="px-6 py-3 bg-brand-500 text-white rounded-2xl font-semibold shadow-button disabled:opacity-50 active:scale-[0.97] transition-all"
          >
            {locating ? 'Определяем...' : 'Определить местоположение'}
          </button>
          {locationError && (
            <p className="text-sm text-red-500">{locationError}</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-tg-hint">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="ml-auto text-xs border border-gray-200 rounded-lg px-2 py-1"
            >
              <option value={5}>5 км</option>
              <option value={10}>10 км</option>
              <option value={25}>25 км</option>
              <option value={50}>50 км</option>
            </select>
          </div>

          {isLoading ? (
            <Loading />
          ) : !masters || masters.length === 0 ? (
            <EmptyState
              emoji="\uD83D\uDD0D"
              title="Мастеров не найдено"
              description="Попробуйте увеличить радиус поиска"
            />
          ) : (
            <div className="flex flex-col gap-2">
              {masters.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/m/${m.slug}`)}
                  className="bg-surface-elevated shadow-card rounded-2xl p-3.5 flex items-center gap-3 text-left active:scale-[0.98] transition-all"
                >
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt={m.display_name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 font-bold text-lg">
                      {m.display_name?.[0] || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.display_name}</div>
                    {m.specialization && (
                      <div className="text-xs text-tg-hint truncate">{m.specialization}</div>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      {m.rating != null && (
                        <span className="flex items-center gap-0.5 text-xs">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          {m.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-tg-hint whitespace-nowrap">
                    {m.distance_km} км
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
