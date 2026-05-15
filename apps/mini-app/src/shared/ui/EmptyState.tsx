import type { ReactNode } from 'react';

interface Props {
  emoji?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ emoji, title, description, action }: Props) {
  return (
    <div className="text-center py-12 px-screen-x">
      {emoji && (
        <div className="text-[48px] mb-3">{emoji}</div>
      )}
      <p className="text-h2 font-bold">{title}</p>
      {description && (
        <p className="text-body text-tg-hint mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
