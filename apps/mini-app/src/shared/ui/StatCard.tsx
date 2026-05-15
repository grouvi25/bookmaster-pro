import clsx from 'clsx';

interface Props {
  label: string;
  value: string | number;
  emoji?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function StatCard({
  label, value, emoji, size = 'md', className,
}: Props) {
  return (
    <div className={clsx('bg-tg-secondary rounded-card p-card-inner', className)}>
      {emoji && (
        <div className="text-center mb-2">
          <span className={clsx(size === 'sm' ? 'text-[20px]' : 'text-[24px]')}>{emoji}</span>
        </div>
      )}
      <div className={clsx(
        'font-bold tracking-tight',
        size === 'sm' ? 'text-[17px]' : 'text-h1',
        emoji && 'text-center',
      )}>
        {value}
      </div>
      <div className={clsx(
        'text-micro text-tg-hint mt-0.5',
        emoji && 'text-center',
      )}>
        {label}
      </div>
    </div>
  );
}
