import { ChevronLeft } from 'lucide-react';

interface Props {
  onBack: () => void;
  label?: string;
}

export default function SectionBack({ onBack, label = 'Назад' }: Props) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-0.5 text-tg-link text-sm mb-3"
    >
      <ChevronLeft className="w-4 h-4" />
      {label}
    </button>
  );
}
