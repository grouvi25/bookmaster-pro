import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { superadminApi } from '@/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';

interface SettingsData {
  plan_prices?: Record<string, number>;
  active_subscriptions?: number;
  ai_provider?: string;
  ai_default_model?: string;
  ai_fallback_enabled?: string;
  timezone?: string;
  trial_duration_days?: string;
  support_email?: string;
  support_telegram?: string;
  maintenance_mode?: string;
  maintenance_message?: string;
  environment?: string;
  debug?: boolean;
  allowed_keys?: string[];
}

type StringKey = keyof Omit<SettingsData, 'plan_prices' | 'active_subscriptions' | 'debug' | 'allowed_keys'>;

export default function SettingsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<SettingsData>({
    queryKey: ['superadmin-settings'],
    queryFn: () => superadminApi.settings().then((r) => r.data),
  });

  const [draft, setDraft] = useState<Record<string, string>>({});
  const setField = (key: string, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: (updates: Record<string, string>) =>
      superadminApi.updateSettings(updates),
    onSuccess: (r) => {
      const rejected = r.data.rejected_keys || [];
      if (rejected.length > 0) {
        toast.error(`Отклонены ключи: ${rejected.join(', ')}`);
      } else {
        toast.success('Настройки сохранены');
      }
      setDraft({});
      queryClient.invalidateQueries({ queryKey: ['superadmin-settings'] });
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail || 'Ошибка сохранения');
    },
  });

  if (isLoading) return <ListSkeleton count={2} />;
  const s = data || {};

  const getValue = (key: StringKey, fallback = ''): string => {
    if (draft[key] !== undefined) return draft[key];
    const v = s[key];
    return v == null ? fallback : String(v);
  };

  const hasChanges = Object.keys(draft).length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Тарифы */}
      <Card>
        <h3 className="text-sm font-semibold mb-2">Тарифы</h3>
        <div className="flex flex-col gap-1">
          {Object.entries(s.plan_prices || {}).map(([plan, price]) => (
            <div key={plan} className="flex justify-between text-xs">
              <span className="capitalize">{plan}</span>
              <span className="font-medium">{price.toLocaleString('ru')} ₽/мес</span>
            </div>
          ))}
          <div className="flex justify-between text-xs pt-2 mt-2 border-t border-tg-secondary/50">
            <span className="text-tg-hint">Активных подписок</span>
            <span className="font-medium">{s.active_subscriptions ?? 0}</span>
          </div>
        </div>
      </Card>

      {/* AI */}
      <Card>
        <h3 className="text-sm font-semibold mb-2">AI-провайдер</h3>
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-[11px] text-tg-hint">Основной провайдер</label>
            <select
              value={getValue('ai_provider', 'openai')}
              onChange={(e) => setField('ai_provider', e.target.value)}
              className="input-field !h-auto !py-2 mt-1"
            >
              <option value="openai">OpenAI</option>
              <option value="yandexgpt">YandexGPT</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={getValue('ai_fallback_enabled', 'true') === 'true'}
              onChange={(e) =>
                setField('ai_fallback_enabled', e.target.checked ? 'true' : 'false')
              }
            />
            Включить auto-failover на резервный провайдер
          </label>
        </div>
      </Card>

      {/* Триал */}
      <Card>
        <h3 className="text-sm font-semibold mb-2">Регистрация</h3>
        <label className="text-[11px] text-tg-hint">Длительность триала (дней)</label>
        <input
          type="number"
          min={1}
          max={90}
          value={getValue('trial_duration_days', '14')}
          onChange={(e) => setField('trial_duration_days', e.target.value)}
          className="input-field !h-auto !py-2 mt-1"
        />
      </Card>

      {/* Поддержка */}
      <Card>
        <h3 className="text-sm font-semibold mb-2">Контакты поддержки</h3>
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-[11px] text-tg-hint">Email</label>
            <input
              type="email"
              value={getValue('support_email')}
              onChange={(e) => setField('support_email', e.target.value)}
              className="input-field !h-auto !py-2 mt-1"
            />
          </div>
          <div>
            <label className="text-[11px] text-tg-hint">Telegram</label>
            <input
              type="text"
              value={getValue('support_telegram')}
              onChange={(e) => setField('support_telegram', e.target.value)}
              className="input-field !h-auto !py-2 mt-1"
              placeholder="@bookmaster_support"
            />
          </div>
        </div>
      </Card>

      {/* Maintenance */}
      <Card>
        <h3 className="text-sm font-semibold mb-2">Режим обслуживания</h3>
        <label className="flex items-center gap-2 text-sm mb-2">
          <input
            type="checkbox"
            checked={getValue('maintenance_mode', 'false') === 'true'}
            onChange={(e) =>
              setField('maintenance_mode', e.target.checked ? 'true' : 'false')
            }
          />
          Включить maintenance режим
        </label>
        <input
          type="text"
          value={getValue('maintenance_message')}
          onChange={(e) => setField('maintenance_message', e.target.value)}
          placeholder="Сообщение для пользователей..."
          className="input-field !h-auto !py-2"
        />
      </Card>

      {/* Системная инфа */}
      <Card>
        <h3 className="text-sm font-semibold mb-2">Среда</h3>
        <div className="flex flex-col gap-1 text-xs">
          {[
            { label: 'Окружение', value: s.environment },
            { label: 'Таймзона', value: s.timezone },
            { label: 'Debug', value: s.debug ? 'on' : 'off' },
          ].map((item) => (
            <div key={item.label} className="flex justify-between">
              <span className="text-tg-hint">{item.label}</span>
              <span>{item.value || '—'}</span>
            </div>
          ))}
        </div>
      </Card>

      {hasChanges && (
        <div className="sticky bottom-4 left-0 right-0">
          <Button
            onClick={() => saveMutation.mutate(draft)}
            loading={saveMutation.isPending}
            fullWidth
          >
            Сохранить изменения ({Object.keys(draft).length})
          </Button>
        </div>
      )}
    </div>
  );
}
