import clsx from 'clsx';

type BookingStatus = 'pending' | 'confirmed' | 'paid' | 'completed' | 'cancelled' | 'no_show';
type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  pending:   'bg-[#FF9500] text-[#7A4500]',
  confirmed: 'bg-[#007AFF] text-[#003A80]',
  paid:      'bg-[#34C759] text-[#1A6B2E]',
  completed: 'bg-[#8E8E93] text-[#3A3A3C]',
  cancelled: 'bg-[#FF3B30] text-[#7A1D1A]',
  no_show:   'bg-[#FF3B30] text-[#7A1D1A]',
};

const VARIANT_STYLES: Record<Variant, string> = {
  success: 'bg-[#34C759]/15 text-[#34C759]',
  warning: 'bg-[#FF9500]/15 text-[#FF9500]',
  danger:  'bg-[#FF3B30]/15 text-[#FF3B30]',
  info:    'bg-[#007AFF]/15 text-[#007AFF]',
  neutral: 'bg-tg-secondary text-tg-hint',
};

interface Props {
  label: string;
  variant?: Variant;
  status?: BookingStatus;
  className?: string;
}

export default function StatusBadge({ label, variant, status, className }: Props) {
  const style = status
    ? BOOKING_STATUS_STYLES[status]
    : VARIANT_STYLES[variant || 'neutral'];

  return (
    <span className={clsx(
      'text-[11px] font-medium px-2 py-0.5 rounded-badge inline-block',
      style,
      className,
    )}>
      {label}
    </span>
  );
}
