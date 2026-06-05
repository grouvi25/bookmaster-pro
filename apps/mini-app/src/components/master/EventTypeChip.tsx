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
  service:      { label: 'Услуга',        emoji: '✂️', bg: 'bg-[#007AFF]/12', text: 'text-[#007AFF]' },
  meeting:      { label: 'Встреча',       emoji: '🤝', bg: 'bg-[#FF9500]/12', text: 'text-[#FF9500]' },
  consultation: { label: 'Консультация',  emoji: '💬', bg: 'bg-[#AF52DE]/12', text: 'text-[#AF52DE]' },
  shooting:     { label: 'Съёмка',        emoji: '📸', bg: 'bg-[#FF2D55]/12', text: 'text-[#FF2D55]' },
  education:    { label: 'Обучение',      emoji: '📚', bg: 'bg-[#5AC8FA]/12', text: 'text-[#5AC8FA]' },
  other:        { label: 'Другое',        emoji: '📌', bg: 'bg-[#8E8E93]/12', text: 'text-[#8E8E93]' },
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
