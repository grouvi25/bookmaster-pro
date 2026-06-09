import clsx from 'clsx';

export type EventType =
  | 'service'
  | 'meeting'
  | 'consultation'
  | 'shooting'
  | 'education'
  | 'other'
  | string; // custom types

export interface EventTypeConfig {
  label: string;
  emoji: string;
  bg: string;
  text: string;
}

const PRESET_CONFIG: Record<string, EventTypeConfig> = {
  service:      { label: 'Услуга',        emoji: '✂️', bg: 'bg-status-info/12', text: 'text-status-info' },
  meeting:      { label: 'Встреча',       emoji: '🤝', bg: 'bg-accent-orange/12', text: 'text-accent-orange' },
  consultation: { label: 'Консультация',  emoji: '💬', bg: 'bg-accent-purple/12', text: 'text-accent-purple' },
  shooting:     { label: 'Съёмка',        emoji: '📸', bg: 'bg-accent-pink/12', text: 'text-accent-pink' },
  education:    { label: 'Обучение',      emoji: '📚', bg: 'bg-accent-teal/12', text: 'text-accent-teal' },
  other:        { label: 'Другое',        emoji: '📌', bg: 'bg-accent-gray/12', text: 'text-accent-gray' },
};

// For custom types, cycle through accent colors
const CUSTOM_STYLES = [
  { bg: 'bg-brand-500/12', text: 'text-brand-600' },
  { bg: 'bg-accent-orange/12', text: 'text-accent-orange' },
  { bg: 'bg-accent-purple/12', text: 'text-accent-purple' },
  { bg: 'bg-accent-pink/12', text: 'text-accent-pink' },
  { bg: 'bg-accent-teal/12', text: 'text-accent-teal' },
];

export function getEventTypeConfig(
  type: string,
  customTypes?: { name: string; emoji: string }[],
): EventTypeConfig {
  // Check presets first
  if (PRESET_CONFIG[type]) return PRESET_CONFIG[type];

  // Check custom types by name match
  if (customTypes) {
    const idx = customTypes.findIndex((c) => c.name === type);
    if (idx >= 0) {
      const style = CUSTOM_STYLES[idx % CUSTOM_STYLES.length];
      return { label: customTypes[idx].name, emoji: customTypes[idx].emoji, ...style };
    }
  }

  // Fallback: show raw name with "other" styling
  return { label: type, emoji: '🏷️', bg: 'bg-accent-gray/12', text: 'text-accent-gray' };
}

interface Props {
  type: string;
  size?: 'sm' | 'md';
  className?: string;
  customTypes?: { name: string; emoji: string }[];
}

export default function EventTypeChip({ type, size = 'sm', className, customTypes }: Props) {
  const config = getEventTypeConfig(type, customTypes);

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

export { PRESET_CONFIG as EVENT_TYPE_CONFIG };
