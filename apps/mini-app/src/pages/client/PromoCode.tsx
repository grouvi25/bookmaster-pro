import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { promoApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';

export default function PromoCode() {
  const navigate = useNavigate();
  const { masterId, setPromo, servicePrice } = useBookingStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [discount, setDiscount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const resp = await promoApi.validate(code.trim(), masterId!);
      const data = resp.data;
      setDiscount(data.discount_amount || data.discount_percent || 0);
      setPromo(code.trim(), data.discount_amount || data.discount_percent || 0);
    } catch {
      setError('Промокод не найден или недействителен');
      setDiscount(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 animate-slide-up">
      <BackButton to="/book/time" />
      <h1 className="text-xl font-bold mb-1">Промокод</h1>
      <p className="text-tg-hint text-sm mb-4">Шаг 4 из 5</p>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Введите промокод"
          className="flex-1 px-4 py-3 bg-tg-secondary rounded-xl text-tg-text outline-none text-sm"
        />
        <button
          onClick={handleValidate}
          disabled={loading || !code.trim()}
          className="px-5 py-3 bg-tg-button text-tg-button-text rounded-xl font-medium text-sm disabled:opacity-50"
        >
          {loading ? '...' : 'Применить'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
      {discount !== null && discount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
          <p className="text-green-700 text-sm font-medium">
            Скидка применена: -{discount}
            {discount < 100 ? '%' : ` \u20bd`}
          </p>
          <p className="text-green-600 text-xs mt-1">
            Итого: {Math.max(0, servicePrice - (discount < 100 ? servicePrice * discount / 100 : discount)).toLocaleString('ru')} \u20bd
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 mt-6">
        <button
          onClick={() => navigate('/book/confirm')}
          className="w-full bg-tg-button text-tg-button-text py-3.5 rounded-xl font-bold"
        >
          {discount ? 'Далее со скидкой' : 'Далее без промокода'}
        </button>
        <button
          onClick={() => {
            setPromo('', 0);
            navigate('/book/confirm');
          }}
          className="w-full text-tg-hint py-2 text-sm"
        >
          Пропустить
        </button>
      </div>
    </div>
  );
}
