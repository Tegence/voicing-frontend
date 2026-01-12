"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
};

type ToastContextValue = {
  show: (opts: { type?: ToastType; message: string; title?: string; durationMs?: number }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, number>>({});

  const show = useCallback(({ type = "info", message, title, durationMs = 3500 }: { type?: ToastType; message: string; title?: string; durationMs?: number }) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, type, message, title }]);
    timers.current[id] = window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
      delete timers.current[id];
    }, durationMs);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-6 right-6 z-[var(--z-toast,40)] space-y-3">
        {items.map((t) => (
          <div
            key={t.id}
            className={
              "max-w-md rounded-xl px-4 py-3 text-sm shadow-xl border " +
              (t.type === "success"
                ? "bg-success-50 text-ink-700 border-success-500/20"
                : t.type === "error"
                ? "bg-error-50 text-ink-700 border-error-500/20"
                : "bg-surface-0 text-ink-700 border-ink-800/10")
            }
            role="status"
          >
            {t.title && <div className="font-semibold mb-0.5">{t.title}</div>}
            <div>{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}


