'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const styleMap = {
          success: {
            accent: 'border-l-sage',
            icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
          },
          error: {
            accent: 'border-l-terracotta',
            icon: <AlertCircle className="h-4 w-4 shrink-0 text-terracotta" aria-hidden="true" />
          },
          warning: {
            accent: 'border-l-ochre',
            icon: <ShieldAlert className="h-4 w-4 shrink-0 text-ochre" aria-hidden="true" />
          },
          info: {
            accent: 'border-l-borderstrong',
            icon: <Info className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
          }
        }[toast.type];

        return (
          <div
            key={toast.id}
            role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
            className={`animate-toast-in flex items-start gap-3 rounded-lg border border-hairline border-l-[3px] bg-elevated px-3.5 py-3 text-ink shadow-lg transition-all ${styleMap.accent}`}
          >
            <div className="mt-0.5">{styleMap.icon}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-tight text-ink">{toast.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-secondary">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label={`Cerrar notificación: ${toast.title}`}
              className="rounded p-1 text-muted transition hover:bg-surface hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
