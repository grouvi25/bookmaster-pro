import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { superadminApi } from '@/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';

const PLAN_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Все тарифы' },
  { value: 'start', label: 'Только Start' },
  { value: 'basic', label: 'Только Basic' },
  { value: 'pro', label: 'Только Pro' },
  { value: 'pro_ai', label: 'Только Pro+AI' },
  { value: 'business', label: 'Только Business' },
];

export default function BroadcastTab() {
  const [text, setText] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const previewMutation = useMutation({
    mutationFn: () =>
      superadminApi.broadcastPreview({
        plan_filter: planFilter || null,
        only_active: onlyActive,
      }),
    onSuccess: (r) => {
      setPreviewCount(r.data.recipients);
    },
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      superadminApi.broadcastSend({
        text,
        plan_filter: planFilter || null,
        only_active: onlyActive,
        button_text: buttonText || null,
        button_url: buttonUrl || null,
      }),
    onSuccess: (r) => {
      const { total, delivered, failed } = r.data;
      toast.success(`Доставлено: ${delivered}/${total} (ошибок: ${failed})`);
      setText('');
      setPreviewCount(null);
    },
    onError: () => toast.error('Ошибка отправки рассылки'),
  });

  const resetPreview = () => setPreviewCount(null);

  return (
    <Card>
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <Send className="w-4 h-4" /> Рассылка мастерам
      </h3>
      <p className="text-xs text-tg-hint mb-3">
        Сообщение от платформы получат все мастера, подходящие под фильтр.
      </p>

      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Текст сообщения..."
          rows={5}
          className="input-field !h-auto !py-2.5"
          maxLength={4000}
        />
        <div className="text-[11px] text-tg-hint text-right">
          {text.length} / 4000
        </div>

        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            resetPreview();
          }}
          className="input-field !h-auto !py-2"
        >
          {PLAN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => {
              setOnlyActive(e.target.checked);
              resetPreview();
            }}
          />
          Только активные мастера
        </label>

        <details className="text-xs">
          <summary className="cursor-pointer text-tg-link">
            Кнопка (опционально)
          </summary>
          <div className="flex flex-col gap-2 mt-2">
            <input
              type="text"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder="Текст кнопки (напр. «Открыть»)"
              className="input-field !h-auto !py-2"
            />
            <input
              type="url"
              value={buttonUrl}
              onChange={(e) => setButtonUrl(e.target.value)}
              placeholder="URL"
              className="input-field !h-auto !py-2"
            />
          </div>
        </details>

        <div className="flex gap-2 mt-2">
          <Button
            onClick={() => previewMutation.mutate()}
            loading={previewMutation.isPending}
            variant="secondary"
            size="sm"
            className="flex-1"
          >
            Предпросмотр
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            loading={sendMutation.isPending}
            disabled={
              !text.trim() || previewCount == null || previewCount === 0
            }
            size="sm"
            className="flex-1"
          >
            Отправить ({previewCount ?? '?'})
          </Button>
        </div>
        {previewCount != null && (
          <p className="text-xs text-tg-hint">
            Получат сообщение: <b>{previewCount}</b> мастеров
          </p>
        )}
      </div>
    </Card>
  );
}
