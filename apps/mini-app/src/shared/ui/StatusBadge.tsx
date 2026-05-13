import clsx from 'clsx';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const VARIANT_STYLES: Record<Variant, string> = {
  success: 'bg-green-500/15 text-green-600',
  warning: 'bg-yellow-500/15 text-yellow-600',
  danger: 'bg-red-500/15 text-red-500',
  info: 'bg-brand-500/15 text-brand-600',
  neutral: 'bg-tg-secondary text-tg-hint',
};

interface Props {
  label: string;
  variant?: Variant;
  className?: string;
}

export default function StatusBadge({ label, variant = 'neutral', className }: Props) {
  return (
    <span className={clsx(
      'text-xs px-2 py-0.5 rounded-lg inline-block',
      VARIANT_STYLES[variant],
      className,
    )}>
      {label}
    </span>
  );
}
