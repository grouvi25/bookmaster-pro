import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  Icon?: LucideIcon;
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ Icon, icon, title, description, action }: Props) {
  return (
    <div className="text-center py-8">
      {icon ? (
        <div className="text-tg-hint mx-auto mb-3 flex justify-center">{icon}</div>
      ) : Icon ? (
        <Icon className="w-10 h-10 text-tg-hint mx-auto mb-3" strokeWidth={1.5} />
      ) : null}
      <p className="text-sm text-tg-hint">{title}</p>
      {description && (
        <p className="text-xs text-tg-hint/60 mt-1">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
