import { type ReactNode, useEffect } from 'react';
import clsx from 'clsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  fullHeight?: boolean;
}

export default function BottomSheet({
  isOpen, onClose, children, title, fullHeight
}: Props) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop: rgba(0,0,0,0.4) + blur 4px per TZ */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[4px] animate-fade-in"
        onClick={onClose}
      />
      {/* Sheet: flex-колонка, шапка фиксирована, контент скроллится */}
      <div
        className={clsx(
          'absolute bottom-0 left-0 right-0 animate-slide-up',
          'rounded-t-sheet bg-surface-primary',
          'flex flex-col',
          fullHeight ? 'top-12' : 'max-h-[88vh]',
        )}
        style={{ transition: 'transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}
      >
        {/* Drag handle: 4px x 36px per TZ */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-[2px] bg-black/20" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-screen-x py-2.5 shrink-0">
            <h3 className="text-h2 font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-tg-secondary flex items-center justify-center interactive text-sm"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
