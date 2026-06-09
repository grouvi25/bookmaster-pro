import clsx from 'clsx';

export type EventType =
  | 'service'
  | 'meeting'
  | 'consultation'
  | 'shooting'
  | 'education'
  | 'other';

const EVENT_TYPE_CONFIG: Record<
  EventType,
  { label: string; emoji: string; bg: string; text: string }
> = {
  service:      { label: 'Услуга',        emoji: '✂️', bg: 'bg-status-info/12', text: 'text-status-info' },
  meeting:      { label: 'Встреча',       emoji: '🤝', bg: 'bg-accent-orange/12', text: 'text-accent-orange' },
  consultation: { label: 'Консультация',  emoji: '💬', bg: 'bg-accent-purple/12', text: 'text-accent-purple' },
  shooting:     { label: 'Съёмка',        emoji: '📸', bg: 'bg-accent-pink/12', text: 'text-accent-pink' },
  education:    { label: 'Обучение',      emoji: '📚', bg: 'bg-accent-teal/12', text: 'text-accent-teal' },
  other:        { label: 'Другое',        emoji: '📌', bg: 'bg-accent-gray/12', text: 'text-accent-gray' },
};

interface Props {
  type: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function EventTypeChip({ type, size = 'sm', className }: Props) {
  const config = EVENT_TYPE_CONFIG[(type as EventType)] || EVENT_TYPE_CONFIG.other;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        config.bg,
        config.text,
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        className,
      )}
    >
      <span className={size === 'sm' ? 'text-[10px]' : 'text-xs'}>{config.emoji}</span>
      {config.label}
    </span>
  );
}

export { EVENT_TYPE_CONFIG };
