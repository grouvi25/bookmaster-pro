import { create } from 'zustand';
import clsx from 'clsx';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastStore {
  toasts: ToastItem[];
  add: (message: string, type?: ToastItem['type']) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = 'info') => {
    const id = Date.now().toString();
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, 3000);
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

export const toast = {
  success: (msg: string) => useToastStore.getState().add(msg, 'success'),
  error: (msg: string) => useToastStore.getState().add(msg, 'error'),
  info: (msg: string) => useToastStore.getState().add(msg, 'info'),
};

export function ToastContainer() {
  const toasts = useToastStore(s => s.toasts);

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={clsx(
            'px-4 py-3.5 rounded-2xl shadow-float text-sm font-medium animate-slide-down pointer-events-auto',
            t.type === 'success' && 'bg-accent-emerald text-white',
            t.type === 'error' && 'bg-accent-red text-white',
            t.type === 'info' && 'bg-gray-900 text-white',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
