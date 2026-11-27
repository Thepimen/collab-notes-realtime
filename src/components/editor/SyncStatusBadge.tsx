'use client';

import React from 'react';
import { AlertCircle, Check, GitMerge, Loader2, WifiOff } from 'lucide-react';
import type { SyncStatus } from '@/types/domain.types';

interface SyncStatusBadgeProps {
  readonly status: SyncStatus;
  readonly onManualSave?: () => void;
}

export function SyncStatusBadge({ status, onManualSave }: SyncStatusBadgeProps) {
  const config = {
    SYNCED: {
      label: 'Guardado',
      classes: 'text-sage',
      dot: <Check className="h-3.5 w-3.5 text-sage" aria-hidden="true" />,
      clickable: false
    },
    SAVING: {
      label: 'Guardando…',
      classes: 'text-secondary',
      dot: <Loader2 className="h-3 w-3 animate-spin text-secondary" aria-hidden="true" />,
      clickable: false
    },
    PENDING: {
      label: 'Sin guardar',
      classes: 'text-ochre hover:text-ink',
      dot: <span className="h-1.5 w-1.5 rounded-full bg-ochre" aria-hidden="true" />,
      clickable: true
    },
    CONFLICT_MERGED: {
      label: 'Combinado',
      classes: 'text-sage',
      dot: <GitMerge className="h-3.5 w-3.5 text-sage" aria-hidden="true" />,
      clickable: false
    },
    OFFLINE: {
      label: 'Sin conexión',
      classes: 'text-terracotta',
      dot: <WifiOff className="h-3.5 w-3.5 text-terracotta" aria-hidden="true" />,
      clickable: false
    },
    ERROR: {
      label: 'Reintentar',
      classes: 'text-terracotta underline underline-offset-2',
      dot: <AlertCircle className="h-3.5 w-3.5 text-terracotta" aria-hidden="true" />,
      clickable: true
    }
  }[status];

  if (config.clickable && onManualSave) {
    return (
      <button
        type="button"
        onClick={onManualSave}
        role="status"
        aria-live="polite"
        title="Guardar cambios ahora (Ctrl+S)"
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition hover:bg-surface ${config.classes}`}
      >
        {config.dot}
        <span>{config.label}</span>
      </button>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${config.classes}`}
    >
      {config.dot}
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
}
