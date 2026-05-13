import type { LucideIcon } from 'lucide-react';

interface Props {
  Icon: LucideIcon;
  title: string;
  description?: string;
}

export default function EmptyState({ Icon, title, description }: Props) {
  return (
    <div className="text-center py-8">
      <Icon className="w-10 h-10 text-tg-hint mx-auto mb-3" strokeWidth={1.5} />
      <p className="text-sm text-tg-hint">{title}</p>
      {description && (
        <p className="text-xs text-tg-hint/60 mt-1">{description}</p>
      )}
    </div>
  );
}
