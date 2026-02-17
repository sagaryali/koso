"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { Icon } from "./icon";

interface Toast {
  id: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

let addToastFn: ((toast: Omit<Toast, "id">) => void) | null = null;

export function toast(options: Omit<Toast, "id">) {
  addToastFn?.(options);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (options: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev, { ...options, id }]);

      const duration = options.duration ?? 5000;
      const timer = setTimeout(() => removeToast(id), duration);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-6 bottom-6 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-slide-in flex items-center gap-3 border border-border-strong bg-bg-primary px-4 py-3 text-sm text-text-primary shadow-modal"
        >
          <span>{t.message}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.onClick();
                removeToast(t.id);
              }}
              className="shrink-0 cursor-pointer text-sm font-medium underline underline-offset-2 hover:opacity-80"
            >
              {t.action.label}
            </button>
          )}
          <button
            onClick={() => removeToast(t.id)}
            className="ml-1 shrink-0 cursor-pointer opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <Icon icon={X} size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
