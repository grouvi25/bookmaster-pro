import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { promoApi, loyaltyApi } from '@/api/endpoints';
import { useBookingStore } from '@/stores/booking';
import BackButton from '@/components/common/BackButton';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { useQuery } from '@tanstack/react-query';
import { Tag, Gift, CircleCheck } from 'lucide-react';

export default function PromoCode() {
  const navigate = useNavigate();
  const { masterId, setPromo, setUsePoints, servicePrice } = useBookingStore();
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: loyaltyData } = useQuery({
    queryKey: ['loyalty-balance', masterId],
    queryFn: () => loyaltyApi.getBalance(masterId!).then((r) => r.data),
    enabled: !!masterId,
  });

  const balance = loyaltyData?.balance ?? 0;

  const handleValidate = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const resp = await promoApi.validate(code.trim(), masterId!);
      const data = resp.data;
      const discountValue = data.discount_amount || data.discount_percent || 0;
      setDiscount(discountValue);
      setPromo(code.trim(), discountValue);
      toast.success('Промокод применён!');
    } catch {
      toast.error('Промокод не найден или недействителен');
      setDiscount(null);
    } finally {
      setLoading(false);
    }
  };

  const finalPrice = discount
    ? Math.max(0, servicePrice - (discount < 100 ? servicePrice * discount / 100 : discount))
    : servicePrice;

  return (
    <div className="p-4 pb-20 animate-slide-up">
      <BackButton to="/book/time" />
      <h1 className="text-xl font-bold mb-1">Промокод и баллы</h1>
      <p className="text-tg-hint text-sm mb-4">Шаг 4 из 5</p>

      {/* Promo code */}
      <Card className="mb-3">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-brand-500" />
          <span className="text-sm font-medium">Промокод</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Введите промокод"
            className="flex-1 px-4 py-3 bg-tg-bg rounded-xl text-tg-text outline-none text-sm border border-transparent focus:border-brand-500"
          />
          <Button
            onClick={handleValidate}
            disabled={!code.trim()}
            loading={loading}
            size="sm"
          >
            Применить
          </Button>
        </div>
        {discount !== null && discount > 0 && (
          <div className="flex items-center gap-2 mt-3 text-green-600 text-sm">
            <CircleCheck className="w-4 h-4" />
            <span>
              Скидка: -{discount}{discount < 100 ? '%' : ` \u20bd`}
            </span>
          </div>
        )}
      </Card>

      {/* Loyalty points */}
      {balance > 0 && (
        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium">Баллы лояльности</span>
            </div>
            <span className="text-sm text-tg-hint">{balance} баллов</span>
          </div>
          <button
            onClick={() => setUsePoints(true, balance)}
            className="mt-2 text-sm text-tg-link"
          >
            Списать баллы
          </button>
        </Card>
      )}

      {/* Summary */}
      <div className="bg-tg-secondary rounded-xl p-4 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-tg-hint">Стоимость</span>
          <span>{servicePrice.toLocaleString('ru')} \u20bd</span>
        </div>
        {discount !== null && discount > 0 && (
          <div className="flex justify-between text-sm mt-1">
            <span className="text-green-600">Скидка</span>
            <span className="text-green-600">
              -{(servicePrice - finalPrice).toLocaleString('ru')} \u20bd
            </span>
          </div>
        )}
        <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-semibold">
          <span>Итого</span>
          <span className="text-brand-600">{finalPrice.toLocaleString('ru')} \u20bd</span>
        </div>
      </div>

      <Button onClick={() => navigate('/book/confirm')} fullWidth size="lg">
        {discount ? 'Далее со скидкой' : 'Продолжить'}
      </Button>

      {!discount && (
        <button
          onClick={() => {
            setPromo('', 0);
            navigate('/book/confirm');
          }}
          className="w-full text-tg-hint py-2 text-sm mt-2"
        >
          Пропустить
        </button>
      )}
    </div>
  );
}
