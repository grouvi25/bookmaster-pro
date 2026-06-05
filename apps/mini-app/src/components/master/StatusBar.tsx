import { useState } from 'react';
import clsx from 'clsx';


/**
 * Таблица переходов статусов.
 * Ключ — текущий статус, значение — массив кнопок-переходов.
 */
interface StatusTransition {
  label: string;
  emoji: string;
  targetStatus: string;
  destructive?: boolean;
  needsReason?: boolean;
}

const TRANSITIONS: Record<string, StatusTransition[]> = {
  pending: [
    { label: 'Подтвердить', emoji: '✅', targetStatus: 'confirmed' },
    { label: 'Отменить', emoji: '✕', targetStatus: 'cancelled_by_master', destructive: true, needsReason: true },
  ],
  confirmed: [
    { label: 'Завершить', emoji: '✓', targetStatus: 'completed' },
    { label: 'Не пришёл', emoji: '🚫', targetStatus: 'no_show', destructive: true },
    { label: 'Отменить', emoji: '✕', targetStatus: 'cancelled_by_master', destructive: true, needsReason: true },
  ],
  paid: [
    { label: 'Завершить', emoji: '✓', targetStatus: 'completed' },
    { label: 'Не пришёл', emoji: '🚫', targetStatus: 'no_show', destructive: true },
    { label: 'Отменить', emoji: '✕', targetStatus: 'cancelled_by_master', destructive: true, needsReason: true },
  ],
};

interface Props {
  currentStatus: string;
  loading?: boolean;
  onAction: (targetStatus: string, cancelReason?: string) => void;
}

export default function StatusBar({ currentStatus, loading, onAction }: Props) {
  const [confirmAction, setConfirmAction] = useState<StatusTransition | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const transitions = TRANSITIONS[currentStatus];
  if (!transitions) return null;

  const handleTap = (t: StatusTransition) => {
    if (t.destructive) {
      setConfirmAction(t);
    } else {
      onAction(t.targetStatus);
    }
  };

  const handleConfirm = () => {
    if (!confirmAction) return;
    onAction(confirmAction.targetStatus, confirmAction.needsReason ? cancelReason || undefined : undefined);
    setConfirmAction(null);
    setCancelReason('');
  };

  if (confirmAction) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-center text-tg-hint">
          {confirmAction.label}?
        </div>
        {confirmAction.needsReason && (
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Причина (необязательно)"
            className="input-field"
          />
        )}
        <div className="flex gap-2">
          <button
            disabled={loading}
            onClick={() => { setConfirmAction(null); setCancelReason(''); }}
            className="flex-1 py-2.5 rounded-btn bg-tg-secondary text-sm font-medium text-tg-text active:scale-95 transition-all"
          >
            Назад
          </button>
          <button
            disabled={loading}
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-btn bg-[#FF3B30] text-white text-sm font-semibold active:scale-95 transition-all disabled:opacity-40"
          >
            {loading ? '...' : 'Да, ' + confirmAction.label.toLowerCase()}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      {transitions.map((t) => (
        <button
          key={t.targetStatus}
          disabled={loading}
          onClick={() => handleTap(t)}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5',
            'py-2.5 rounded-btn text-xs font-semibold',
            'transition-all duration-150 active:scale-95',
            'disabled:opacity-40',
            t.destructive
              ? 'bg-[#FF3B30]/10 text-[#FF3B30]'
              : 'bg-brand-500 text-white shadow-button',
          )}
        >
          <span>{t.emoji}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}
