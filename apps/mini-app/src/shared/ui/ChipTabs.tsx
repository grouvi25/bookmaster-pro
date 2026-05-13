import type { LucideIcon } from 'lucide-react';

interface Tab<T extends string> {
  key: T;
  label: string;
  Icon?: LucideIcon;
}

interface Props<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (key: T) => void;
}

export default function ChipTabs<T extends string>({
  tabs, active, onChange,
}: Props<T>) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {tabs.map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`chip whitespace-nowrap ${
            active === key ? 'chip-active' : 'chip-inactive'
          }`}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}
