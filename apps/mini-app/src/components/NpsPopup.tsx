import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { npsApi } from '@/api/endpoints';
import Button from '@/shared/ui/Button';
import { X } from 'lucide-react';

export default function NpsPopup() {
  const [visible, setVisible] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['nps-current'],
    queryFn: () => npsApi.current().then((r) => r.data),
    retry: false,
  });

  useEffect(() => {
    if (data?.should_show) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [data]);

  const submitMutation = useMutation({
    mutationFn: () =>
      npsApi.submit({ score: score!, comment: comment || undefined }),
    onSuccess: () => {
      setVisible(false);
      queryClient.invalidateQueries({ queryKey: ['nps-current'] });
    },
  });

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
      <div className="w-full max-w-md bg-surface-primary rounded-t-sheet p-card-inner pb-8 animate-slide-up">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Оцените BookMaster Pro</h3>
          <button onClick={() => setVisible(false)} className="text-tg-hint p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-tg-hint mb-4">
          Насколько вероятно, что вы порекомендуете нас? (0-10)
        </p>

        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              onClick={() => setScore(i)}
              className={`min-w-[36px] h-9 rounded-xl text-sm font-medium transition-all ${
                score === i
                  ? i <= 6
                    ? 'bg-red-500 text-white'
                    : i <= 8
                    ? 'bg-amber-500 text-white'
                    : 'bg-green-500 text-white'
                  : 'bg-surface-elevated text-tg-text'
              }`}
            >
              {i}
            </button>
          ))}
        </div>

        <div className="flex justify-between text-xs text-tg-hint mb-4">
          <span>Маловероятно</span>
          <span>Очень вероятно</span>
        </div>

        {score !== null && (
          <>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Расскажите подробнее (необязательно)"
              className="input-field mb-3 resize-none"
              rows={2}
            />
            <Button
              variant="primary"
              className="w-full"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              Отправить
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
