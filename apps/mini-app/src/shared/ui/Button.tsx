import { type ReactNode } from 'react';
import clsx from 'clsx';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}

export default function Button({
  children, onClick, variant = 'primary', size = 'md',
  fullWidth = false, disabled = false, loading = false,
  className, type = 'button',
}: Props) {
  const base = clsx(
    'inline-flex items-center justify-center gap-2 font-semibold',
    'rounded-2xl transition-all duration-200 active:scale-[0.97]',
    'disabled:opacity-40 disabled:pointer-events-none',
    {
      'w-full': fullWidth,
      'px-4 py-2 text-sm': size === 'sm',
      'px-5 py-3.5 text-[15px]': size === 'md',
      'px-6 py-4 text-base': size === 'lg',
    }
  );

  const variants = {
    primary: 'bg-tg-button text-tg-button-text shadow-button',
    secondary: 'bg-tg-secondary text-tg-text',
    ghost: 'bg-transparent text-tg-link active:bg-tg-secondary',
    danger: 'bg-accent-red text-white shadow-sm',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(base, variants[variant], className)}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : children}
    </button>
  );
}
