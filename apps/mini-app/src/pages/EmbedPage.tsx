import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/api/client';
import Loading from '@/components/common/Loading';
import { CalendarDays, Star, ChevronRight } from 'lucide-react';

interface MasterPublic {
  id: number;
  display_name: string;
  specialization?: string;
  avatar_url?: string;
  description?: string;
  rating?: number;
  review_count?: number;
  slug: string;
  services?: { id: number; name: string; price: number; duration_min: number }[];
}

export default function EmbedPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [master, setMaster] = useState<MasterPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/masters/${slug}`)
      .then((resp) => setMaster(resp.data))
      .catch(() => setError('Мастер не найден'))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    const sendHeight = () => {
      window.parent.postMessage(
        { type: 'bookmaster-resize', height: document.body.scrollHeight },
        '*'
      );
    };
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  if (loading) return <Loading />;
  if (error || !master) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <p className="text-lg text-gray-500">{error || 'Мастер не найден'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 font-sans">
      {/* Profile */}
      <div className="text-center mb-6">
        {master.avatar_url ? (
          <img src={master.avatar_url} alt={master.display_name} className="w-20 h-20 rounded-full mx-auto mb-3 object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-purple-100 flex items-center justify-center text-purple-600 text-2xl font-bold">
            {master.display_name?.[0] || '?'}
          </div>
        )}
        <h1 className="text-xl font-bold text-gray-900">{master.display_name}</h1>
        {master.specialization && <p className="text-sm text-gray-500 mt-1">{master.specialization}</p>}
        {master.rating != null && (
          <div className="flex items-center justify-center gap-1 mt-2">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-sm font-medium">{master.rating.toFixed(1)}</span>
            {master.review_count != null && (
              <span className="text-xs text-gray-400">({master.review_count})</span>
            )}
          </div>
        )}
      </div>

      {/* Services */}
      {master.services && master.services.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Услуги</h2>
          <div className="space-y-2">
            {master.services.map((svc) => (
              <div key={svc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                  <p className="text-xs text-gray-400">{svc.duration_min} мин</p>
                </div>
                <p className="text-sm font-semibold text-gray-900">{svc.price} ₽</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Book button */}
      <button
        onClick={() => navigate(`/m/${slug}`)}
        className="w-full py-3.5 bg-purple-600 text-white rounded-xl text-base font-semibold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors"
      >
        <CalendarDays className="w-5 h-5" />
        Записаться
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
