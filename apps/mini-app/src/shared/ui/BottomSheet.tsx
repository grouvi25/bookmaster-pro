import { type ReactNode, useEffect } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

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
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={clsx(
          'absolute bottom-0 left-0 right-0 animate-slide-up',
          'rounded-t-3xl shadow-2xl bg-tg-bg',
          fullHeight ? 'top-16' : 'max-h-[85vh]',
        )}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 py-3">
            <h3 className="text-lg font-bold">{title}</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center active:bg-gray-100"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        )}
        <div className={clsx(
          'overflow-y-auto safe-bottom',
          fullHeight ? 'h-full' : 'max-h-[75vh]',
        )}>
          {children}
        </div>
      </div>
    </div>
  );
}
