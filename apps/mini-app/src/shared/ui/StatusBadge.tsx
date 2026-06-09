import clsx from 'clsx';

type BookingStatus = 'pending' | 'confirmed' | 'paid' | 'completed' | 'cancelled' | 'no_show';
type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  pending:   'bg-status-warning text-status-warning-dark',
  confirmed: 'bg-status-info text-status-info-dark',
  paid:      'bg-status-success text-status-success-dark',
  completed: 'bg-status-neutral text-status-neutral-dark',
  cancelled: 'bg-status-danger text-status-danger-dark',
  no_show:   'bg-status-danger text-status-danger-dark',
};

const VARIANT_STYLES: Record<Variant, string> = {
  success: 'bg-status-success/15 text-status-success',
  warning: 'bg-status-warning/15 text-status-warning',
  danger:  'bg-status-danger/15 text-status-danger',
  info:    'bg-status-info/15 text-status-info',
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
