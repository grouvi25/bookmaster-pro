import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ArrowLeft } from 'lucide-react';

/**
 * Полноразмерная кнопка "Назад" с подписью.
 * Используется НАД контентом, как отдельная строка.
 * Пример: client/MyBookings, client/SelectTime, client/Confirm.
 */
export default function BackButton({
  to,
  label = 'Назад',
}: {
  to?: string;
  label?: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="flex items-center gap-0.5 text-tg-link text-sm mb-3 interactive"
    >
      <ChevronLeft className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

/**
 * Компактная back-иконка для левого слота PageHeader.
 * Использовать как `<PageHeader left={<HeaderBackButton to="..." />} ... />`.
 *
 * Унифицирует ~14 одинаковых ручных кнопок на master-страницах,
 * которые раньше делали это inline-копией.
 */
export function HeaderBackButton({ to }: { to?: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => (to ? navigate(to) : navigate(-1))}
      aria-label="Назад"
      className="p-2 -ml-2 text-tg-text active:opacity-60 transition-opacity"
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  );
}
