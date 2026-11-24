'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import clsx from 'clsx';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (options: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
  dismiss: () => {},
});

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const ACCENTS: Record<ToastVariant, string> = {
  success: 'text-[var(--success)]',
  error: 'text-[var(--danger)]',
  info: 'text-[var(--accent)]',
  warning: 'text-[var(--warning)]',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (options: Omit<Toast, 'id'>) => {
      const id = `toast_${Math.random().toString(36).slice(2, 9)}`;
      setToasts((current) => [...current.slice(-3), { ...options, id }]);
      const timer = setTimeout(() => dismiss(id), options.variant === 'error' ? 7000 : 4200);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="no-print pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((item) => {
          const Icon = ICONS[item.variant];
          return (
            <div
              key={item.id}
              role="status"
              className="pointer-events-auto flex animate-pop-in items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-3.5 shadow-panel"
            >
              <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', ACCENTS[item.variant])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">{item.description}</p>
                ) : null}
                {item.action ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
                    onClick={() => {
                      item.action?.onClick();
                      dismiss(item.id);
                    }}
                  >
                    {item.action.label}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="rounded-md p-1 text-[var(--ink-faint)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
