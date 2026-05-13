import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  Icon: LucideIcon;
  label: string;
  description?: string;
  onClick: () => void;
  iconBg?: string;
  iconColor?: string;
  className?: string;
}

export default function MenuItem({
  Icon, label, description, onClick,
  iconBg = 'bg-brand-500/10', iconColor = 'text-brand-500',
  className,
}: Props) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3.5 p-4 bg-surface-elevated shadow-card rounded-2xl text-left',
        'active:scale-[0.98] transition-all duration-200',
        className,
      )}
    >
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
        <Icon className={clsx('w-5 h-5', iconColor)} strokeWidth={1.8} />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-sm">{label}</div>
        {description && (
          <div className="text-xs text-tg-hint mt-0.5">{description}</div>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-tg-hint" />
    </button>
  );
}
