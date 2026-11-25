'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, GitMerge, Loader2, WifiOff } from 'lucide-react';
import type { SyncStatus } from '@/types/domain.types';

interface SyncStatusBadgeProps {
  readonly status: SyncStatus;
  readonly version: number;
}

export function SyncStatusBadge({ status, version }: SyncStatusBadgeProps) {
  const prevVersionRef = useRef<number>(version);
  const [bump, setBump] = useState<boolean>(false);

  useEffect(() => {
    if (version !== prevVersionRef.current) {
      prevVersionRef.current = version;
      setBump(true);
      const timer = setTimeout(() => setBump(false), 380);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [version]);

  const config = {
    SYNCED: {
      label: `Synced · v${version}`,
      classes: 'border-hairline bg-sage-soft text-sage',
      dot: <span className="h-2 w-2 rounded-full bg-sage" aria-hidden="true" />
    },
    SAVING: {
      label: `CAS v${version}→v${version + 1}`,
      classes: 'border-hairline bg-surface text-ink',
      dot: <Loader2 className="h-3 w-3 animate-spin text-terracotta" aria-hidden="true" />
    },
    PENDING: {
      label: `Editing · v${version}`,
      classes: 'border-hairline bg-surface text-secondary',
      dot: <span className="h-2 w-2 animate-pulse rounded-full bg-ochre" aria-hidden="true" />
    },
    CONFLICT_MERGED: {
      label: `Merged · v${version}`,
      classes: 'border-ochre/40 bg-ochre-soft text-ochre',
      dot: <GitMerge className="h-3 w-3 text-ochre" aria-hidden="true" />
    },
    OFFLINE: {
      label: `Offline · v${version}`,
      classes: 'border-terracotta/40 bg-terracotta-soft text-terracotta',
      dot: <WifiOff className="h-3 w-3 text-terracotta" aria-hidden="true" />
    },
    ERROR: {
      label: 'Sync Error',
      classes: 'border-terracotta/40 bg-terracotta-soft text-terracotta',
      dot: <AlertCircle className="h-3 w-3 text-terracotta" aria-hidden="true" />
    }
  }[status];

  return (
    <div
      role="status"
      aria-live="polite"
      title="Optimistic Concurrency Control (Compare-And-Swap Version)"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium tabular-nums transition-all ${config.classes} ${
        bump ? 'animate-occ-bump ring-1 ring-sage/40' : ''
      }`}
    >
      {config.dot}
      <span>{config.label}</span>
    </div>
  );
}
