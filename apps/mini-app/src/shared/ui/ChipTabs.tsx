interface Tab<T extends string> {
  key: T;
  label: string;
  emoji?: string;
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
      {tabs.map(({ key, label, emoji }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`chip whitespace-nowrap ${
            active === key ? 'chip-active' : 'chip-inactive'
          }`}
        >
          {emoji && <span className="text-[14px]">{emoji}</span>}
          {label}
        </button>
      ))}
    </div>
  );
}
