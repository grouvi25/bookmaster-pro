import clsx from 'clsx';
import { EVENT_TYPE_CONFIG, type EventType } from './EventTypeChip';

const EVENT_TYPES: EventType[] = [
  'service',
  'meeting',
  'consultation',
  'shooting',
  'education',
  'other',
];

interface Props {
  value: string;
  onChange: (type: EventType) => void;
  className?: string;
}

export default function EventTypePicker({ value, onChange, className }: Props) {
  return (
    <div className={clsx('flex flex-wrap gap-1.5', className)}>
      {EVENT_TYPES.map((t) => {
        const config = EVENT_TYPE_CONFIG[t];
        const isActive = value === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-2 rounded-card text-xs font-medium',
              'transition-all duration-150 active:scale-95',
              isActive
                ? 'bg-brand-500 text-white shadow-button'
                : 'bg-tg-secondary text-tg-text',
            )}
          >
            <span>{config.emoji}</span>
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
