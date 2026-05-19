import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reviewsApi } from '@/api/endpoints';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import StarRating from '@/shared/ui/StarRating';
import { toast } from '@/shared/ui/Toast';
import { CheckCircle } from 'lucide-react';

export default function ReviewForm() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Поставьте оценку');
      return;
    }

    setLoading(true);
    try {
      await reviewsApi.create({
        appointment_id: Number(appointmentId),
        rating,
        text: text.trim() || undefined,
      });
      setSubmitted(true);
      toast.success('Спасибо за отзыв!');
    } catch {
      toast.error('Ошибка отправки отзыва');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="px-screen-x pt-section-y pb-24 animate-fade-in">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-16 h-16 bg-accent-emerald/10 rounded-card flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-accent-emerald" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Спасибо за отзыв!</h1>
          <p className="text-tg-hint text-sm mb-6">Ваша оценка помогает другим клиентам</p>
          <Button onClick={() => navigate('/')} variant="secondary">
            На главную
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-screen-x pt-section-y pb-24 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Оставьте отзыв</h1>
      <p className="text-tg-hint text-sm mb-6">Оцените ваш визит</p>

      <Card className="mb-4">
        <div className="text-center">
          <div className="text-sm text-tg-hint mb-3">Ваша оценка</div>
          <div className="flex justify-center mb-2">
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>
          {rating > 0 && (
            <div className="text-sm font-medium text-tg-text">
              {['', 'Ужасно', 'Плохо', 'Нормально', 'Хорошо', 'Отлично!'][rating]}
            </div>
          )}
        </div>
      </Card>

      {/* Text review */}
      <div className="mb-6">
        <label className="text-sm font-medium mb-1.5 block">
          Комментарий (необязательно)
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Расскажите о вашем опыте..."
          rows={4}
          className="input-field !h-auto resize-none"
        />
      </div>

      <Button
        onClick={handleSubmit}
        loading={loading}
        disabled={rating === 0}
        fullWidth
        size="lg"
      >
        Отправить отзыв
      </Button>
    </div>
  );
}
