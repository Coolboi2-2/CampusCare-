import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';

type Tone = 'success' | 'info' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

type Push = (message: string, tone?: Tone) => void;

const ToastContext = createContext<Push>(() => {});
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = (): Push => useContext(ToastContext);

const TONES: Record<Tone, { wrap: string; icon: React.ReactNode }> = {
  success: {
    wrap: 'border-success-200 bg-success-50 text-success-800',
    icon: <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />,
  },
  info: {
    wrap: 'border-line bg-surface text-slate-700',
    icon: <Info className="h-4.5 w-4.5 shrink-0 text-brand-600" />,
  },
  error: {
    wrap: 'border-critical-200 bg-critical-50 text-critical-800',
    icon: <AlertTriangle className="h-4.5 w-4.5 shrink-0" />,
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback<Push>((message, tone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="fixed inset-x-4 bottom-4 z-[70] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2.5 rounded-control border px-4 py-3 text-sm font-medium shadow-card-hover ${TONES[t.tone].wrap}`}
          >
            <span className="mt-0.5">{TONES[t.tone].icon}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
