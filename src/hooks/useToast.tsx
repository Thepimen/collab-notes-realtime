'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import type { ToastNotificationDTO } from '@/types/domain.types';

interface ToastContextValue {
  readonly toasts: readonly ToastNotificationDTO[];
  readonly pushToast: (params: {
    readonly type: ToastNotificationDTO['type'];
    readonly title: string;
    readonly message: string;
  }) => void;
  readonly dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { readonly children: React.ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastNotificationDTO[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (params: {
      readonly type: ToastNotificationDTO['type'];
      readonly title: string;
      readonly message: string;
    }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastNotificationDTO = {
        id,
        type: params.type,
        title: params.title,
        message: params.message,
        createdAt: Date.now()
      };

      // Immutable state update using spread operator
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 5500);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, pushToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
