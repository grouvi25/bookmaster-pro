import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/endpoints';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { Link2, Unlink, Copy, RefreshCw, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';

const PLATFORM_LABELS: Record<string, { emoji: string; name: string }> = {
  telegram: { emoji: '✈️', name: 'Telegram' },
  max: { emoji: '💬', name: 'VK MAX' },
};

interface LinkedPlatform {
  platform: string;
  is_primary: boolean;
  identity_id: number;
}

export default function LinkedAccountsSection() {
  const queryClient = useQueryClient();
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeExpiry, setCodeExpiry] = useState(0);

  // Список привязанных платформ
  const { data: linkedData, refetch } = useQuery({
    queryKey: ['linked-platforms'],
    queryFn: () => authApi.getLinkedPlatforms(),
  });

  const platforms: LinkedPlatform[] = linkedData?.platforms || [];
  const hasLinks = platforms.length > 1;

  // Генерация кода
  const generateMutation = useMutation({
    mutationFn: () => authApi.generateLinkCode(),
    onSuccess: (data) => {
      setGeneratedCode(data.code);
      setCodeExpiry(data.expires_in);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Ошибка генерации кода');
    },
  });

  // Применение кода
  const applyMutation = useMutation({
    mutationFn: (code: string) => authApi.applyLinkCode(code),
    onSuccess: (data) => {
      toast.success(data.message);
      setShowCodeInput(false);
      setInputCode('');
      setGeneratedCode('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['identify'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Неверный код');
    },
  });

  // Отвязка
  const unlinkMutation = useMutation({
    mutationFn: () => authApi.unlinkAccount(),
    onSuccess: () => {
      toast.success('Аккаунт отвязан');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Ошибка отвязки');
    },
  });

  // Таймер обратного отсчёта
  useEffect(() => {
    if (codeExpiry <= 0) return;
    const t = setTimeout(() => setCodeExpiry((e) => e - 1), 1000);
    return () => clearTimeout(t);
  }, [codeExpiry]);

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode).then(() => {
      toast.success('Код скопирован');
    });
  };

  return (
    <Card className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-brand-500" />
        <h3 className="text-sm font-semibold">Связанные аккаунты</h3>
      </div>

      {/* Список привязанных платформ */}
      {platforms.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {platforms.map((p) => {
            const label = PLATFORM_LABELS[p.platform] || { emoji: '🌐', name: p.platform };
            return (
              <div
                key={p.identity_id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-surface-secondary"
              >
                <span className="text-sm">
                  {label.emoji} {label.name}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      'text-xs font-medium',
                      p.is_primary ? 'text-brand-500' : 'text-green-600',
                    )}
                  >
                    {p.is_primary ? '⭐ Основной' : '✅ Привязан'}
                  </span>
                  {!p.is_primary && (
                    <button
                      onClick={() => unlinkMutation.mutate()}
                      disabled={unlinkMutation.isPending}
                      className="p-1 rounded-lg text-red-400 active:bg-red-50"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasLinks && (
        <p className="text-xs text-tg-hint mb-3">
          Привяжите аккаунт из другого мессенджера — и все данные будут доступны отовсюду.
        </p>
      )}

      {/* Генерация кода */}
      {!generatedCode ? (
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="w-full mb-2"
          variant="primary"
          size="sm"
        >
          {generateMutation.isPending ? 'Генерирую...' : '📤 Получить код привязки'}
        </Button>
      ) : (
        <div className="p-3 rounded-xl bg-surface-secondary mb-2">
          <p className="text-xs text-tg-hint mb-1">
            Введите этот код в другом мессенджере:
          </p>
          <div className="flex items-center justify-center gap-2 my-2">
            <span className="text-3xl font-mono font-bold tracking-[0.3em] text-brand-600">
              {generatedCode}
            </span>
            <button onClick={copyCode} className="p-1.5 rounded-lg active:bg-surface-secondary">
              <Copy className="w-4 h-4 text-tg-hint" />
            </button>
          </div>
          {codeExpiry > 0 ? (
            <p className="text-xs text-center text-tg-hint">
              Истекает через {Math.floor(codeExpiry / 60)}:
              {String(codeExpiry % 60).padStart(2, '0')}
            </p>
          ) : (
            <div className="text-center">
              <p className="text-xs text-red-500">Код истёк</p>
              <button
                onClick={() => {
                  setGeneratedCode('');
                  generateMutation.mutate();
                }}
                className="text-xs text-brand-500 underline mt-1 inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Получить новый
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ввод кода */}
      {!showCodeInput ? (
        <button
          onClick={() => setShowCodeInput(true)}
          className="w-full py-2.5 rounded-xl text-sm font-medium bg-surface-secondary active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          📥 У меня есть код <ArrowRight className="w-3.5 h-3.5 text-tg-hint" />
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            value={inputCode}
            onChange={(e) =>
              setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            autoFocus
            className="flex-1 p-3 rounded-xl text-center font-mono text-xl tracking-[0.3em] outline-none bg-surface-secondary"
          />
          <button
            onClick={() => applyMutation.mutate(inputCode)}
            disabled={inputCode.length !== 6 || applyMutation.isPending}
            className="px-4 rounded-xl bg-brand-500 text-white disabled:opacity-40 active:scale-95"
          >
            {applyMutation.isPending ? '...' : '✓'}
          </button>
          <button
            onClick={() => {
              setShowCodeInput(false);
              setInputCode('');
            }}
            className="px-3 rounded-xl bg-surface-secondary text-tg-hint"
          >
            ✕
          </button>
        </div>
      )}
    </Card>
  );
}
