import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  kind: ToastKind;
}

interface ToastContextValue {
  notify: (title: string, opts?: { description?: string; kind?: ToastKind }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (title: string, opts?: { description?: string; kind?: ToastKind }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const kind = opts?.kind || 'info';
      setToasts((prev) => [...prev, { id, title, description: opts?.description, kind }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3.5 shadow-xl backdrop-blur-md',
              toast.kind === 'success' && 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100',
              toast.kind === 'error' && 'border-rose-500/40 bg-rose-950/90 text-rose-100',
              toast.kind === 'warning' && 'border-amber-500/40 bg-amber-950/90 text-amber-100',
              toast.kind === 'info' && 'border-violet-500/40 bg-navy-900/95 text-slate-100'
            )}
          >
            {toast.kind === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
            {(toast.kind === 'error' || toast.kind === 'warning') && (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            )}
            {toast.kind === 'info' && <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-xs opacity-85">{toast.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded p-0.5 opacity-70 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
