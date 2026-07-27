import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastState {
  message: string;
  tone: ToastTone;
}

const toneClass: Record<ToastTone, string> = {
  success: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  error: 'border-rose-100 bg-rose-50 text-rose-800',
  info: 'border-blue-100 bg-blue-50 text-blue-800',
};

const iconMap = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    setToast({ message, tone });
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return { toast, showToast, clearToast };
}

export function Toast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  if (!toast) {
    return null;
  }

  const Icon = iconMap[toast.tone];

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[5.5rem] z-50 flex justify-center px-4"
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={`关闭提示：${toast.message}`}
        className={`pointer-events-auto inline-flex max-w-[22rem] items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-[0_12px_28px_rgba(15,23,42,0.12)] ${toneClass[toast.tone]}`}
      >
        <Icon size={16} aria-hidden="true" />
        <span>{toast.message}</span>
      </button>
    </div>
  );
}
