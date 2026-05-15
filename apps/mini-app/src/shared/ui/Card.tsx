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
        'rounded-card bg-tg-secondary',
        {
          'cursor-pointer interactive': onClick,
          '': padding === 'none',
          'p-[10px]': padding === 'sm',
          'p-card-inner': padding === 'md',
        },
        className
      )}
    >
      {children}
    </div>
  );
}
