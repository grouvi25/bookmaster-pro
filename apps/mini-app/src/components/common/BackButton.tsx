import { useNavigate } from 'react-router-dom';

export default function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="flex items-center gap-1 text-tg-link text-sm py-2"
    >
      <span>&larr;</span>
      <span>Назад</span>
    </button>
  );
}
