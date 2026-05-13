import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  Icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function StatCard({
  label, value, Icon, iconBg, iconColor, size = 'md', className,
}: Props) {
  return (
    <div className={clsx('bg-surface-elevated shadow-card rounded-2xl p-3.5', className)}>
      {Icon && (
        <div className={clsx(
          'rounded-xl mx-auto mb-2 flex items-center justify-center',
          size === 'sm' ? 'w-8 h-8' : 'w-9 h-9',
          iconBg || 'bg-brand-500/10',
        )}>
          <Icon className={clsx(
            size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]',
            iconColor || 'text-brand-500',
          )} strokeWidth={2} />
        </div>
      )}
      <div className={clsx(
        'font-bold tracking-tight',
        size === 'sm' ? 'text-lg' : 'text-xl',
        Icon && 'text-center',
      )}>
        {value}
      </div>
      <div className={clsx(
        'text-2xs text-tg-hint font-medium mt-0.5',
        Icon && 'text-center',
      )}>
        {label}
      </div>
    </div>
  );
}
