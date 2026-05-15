import clsx from 'clsx';

interface Props {
  emoji?: string;
  label: string;
  description?: string;
  onClick: () => void;
  className?: string;
}

export default function MenuItem({
  emoji, label, description, onClick, className,
}: Props) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3.5 p-card-inner bg-tg-secondary rounded-card text-left',
        'interactive w-full',
        className,
      )}
    >
      {emoji && (
        <span className="text-[24px]">{emoji}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-body">{label}</div>
        {description && (
          <div className="text-aux text-tg-hint mt-0.5">{description}</div>
        )}
      </div>
      <span className="text-tg-hint text-[14px]">›</span>
    </button>
  );
}
