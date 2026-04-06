import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

let nextId = 0;
type Listener = (items: ToastItem[]) => void;
const listeners = new Set<Listener>();
let toasts: ToastItem[] = [];

function notify(items: ToastItem[]) {
  toasts = items;
  listeners.forEach((l) => l(items));
}

export function showToast(message: string, variant: ToastVariant = 'success') {
  const id = ++nextId;
  notify([...toasts, { id, message, variant }]);
  setTimeout(() => {
    notify(toasts.filter((t) => t.id !== id));
  }, 3000);
}

/** Mount once at app root */
export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto transition-all duration-300 ${
            t.variant === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {t.variant === 'success' ? (
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          )}
          <span>{t.message}</span>
          <button
            className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
            onClick={() => notify(toasts.filter((item) => item.id !== t.id))}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
