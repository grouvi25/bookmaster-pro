import BottomSheet from './BottomSheet';
import Button from './Button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Стиль кнопки подтверждения. По умолчанию primary. */
  variant?: 'primary' | 'danger';
  /** Кнопка подтверждения в loading-состоянии. */
  loading?: boolean;
}

/**
 * Bottom-sheet подтверждение действия — замена window.confirm,
 * который выглядит чужеродно в Telegram WebApp.
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'primary',
  loading = false,
}: Props) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="px-screen-x pb-8">
        {description && (
          <p className="text-sm text-tg-hint mb-5 leading-relaxed">{description}</p>
        )}
        <div className="flex flex-col gap-2">
          <Button
            onClick={onConfirm}
            variant={variant}
            fullWidth
            loading={loading}
          >
            {confirmLabel}
          </Button>
          <Button
            onClick={onClose}
            variant="secondary"
            fullWidth
            disabled={loading}
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
