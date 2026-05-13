import { type ReactNode } from 'react';
import clsx from 'clsx';

interface Props {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md';
}

export default function Card({
  children, className, onClick, padding = 'md'
}: Props) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-2xl bg-surface-elevated shadow-card',
        {
          'cursor-pointer active:scale-[0.98] transition-all duration-200': onClick,
          '': padding === 'none',
          'p-3': padding === 'sm',
          'p-4': padding === 'md',
        },
        className
      )}
    >
      {children}
    </div>
  );
}
