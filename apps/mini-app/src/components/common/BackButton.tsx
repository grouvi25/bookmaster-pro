import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="flex items-center gap-0.5 text-tg-link text-sm py-2"
    >
      <ChevronLeft className="w-4 h-4" />
      <span>Назад</span>
    </button>
  );
}
