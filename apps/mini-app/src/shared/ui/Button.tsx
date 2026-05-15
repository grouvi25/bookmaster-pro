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
    'inline-flex items-center justify-center gap-2',
    'font-semibold text-[16px] rounded-btn',
    'transition-transform transition-opacity duration-100',
    'active:opacity-80 active:scale-[0.97]',
    'disabled:opacity-40 disabled:pointer-events-none',
    { 'w-full': fullWidth },
  );

  const sizes = {
    sm: 'h-[44px] px-4 text-[15px]',
    md: 'h-[52px] px-5 text-[16px]',
    lg: 'h-[52px] px-6 text-[16px]',
  };

  const variants: Record<string, string> = {
    primary:   'bg-tg-button text-tg-button-text',
    secondary: 'bg-tg-secondary text-tg-text',
    ghost:     'bg-transparent text-tg-link h-[44px] text-[15px] font-medium',
    danger:    'bg-status-danger text-white',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(base, variant !== 'ghost' && sizes[size], variants[variant], className)}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin-fast" />
      ) : children}
    </button>
  );
}
