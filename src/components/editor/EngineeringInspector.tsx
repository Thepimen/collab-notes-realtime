'use client';

import React, { useState } from 'react';
import { Database, GitMerge, ShieldCheck, X, Zap } from 'lucide-react';
import { isSupabaseConfigured } from '@/services/supabase.client';
import type { DocumentDTO, OccTransactionEntryDTO, ProfileDTO } from '@/types/domain.types';

interface EngineeringInspectorProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly document: DocumentDTO;
  readonly currentUser: ProfileDTO | null;
  readonly canEdit: boolean;
  readonly occTransactions: readonly OccTransactionEntryDTO[];
  readonly onSimulateConflict: () => Promise<void>;
  readonly onProbeRlsWrite: () => Promise<void>;
}

type InspectorTab = 'occ' | 'jsonb' | 'rls';

export function EngineeringInspector({
  isOpen,
  onClose,
  document,
  currentUser,
  canEdit,
  occTransactions,
  onSimulateConflict,
  onProbeRlsWrite
}: EngineeringInspectorProps) {
  const [tab, setTab] = useState<InspectorTab>('occ');
  const cloudActive = isSupabaseConfigured();

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Engineering Telemetry & JSONB Inspector"
      className="flex h-[calc(100vh-48px)] w-full shrink-0 flex-col border-l border-hairline bg-surface md:w-[310px] lg:w-[345px] xl:w-[375px]"
    >
      {/* Inspector Header */}
      <div className="flex h-11 items-center justify-between border-b border-hairline px-3.5">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-terracotta" aria-hidden="true" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink">
            Precision Inspector
          </span>
          <span className="rounded border border-hairline bg-elevated px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-sage">
            v{document.version}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Close Inspector (Ctrl/Cmd + I)"
          aria-label="Close Engineering Inspector"
          className="rounded p-1 text-muted transition hover:bg-elevated hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Segmented Sub-Tabs */}
      <div className="grid grid-cols-3 gap-1 border-b border-hairline bg-canvas p-1.5 font-mono text-[11px]">
        <button
          type="button"
          onClick={() => setTab('occ')}
          className={`rounded py-1 font-medium transition ${
            tab === 'occ'
              ? 'bg-elevated text-ink shadow-sm ring-1 ring-hairline'
              : 'text-secondary hover:text-ink'
          }`}
        >
          OCC Log ({occTransactions.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('jsonb')}
          className={`rounded py-1 font-medium transition ${
            tab === 'jsonb'
              ? 'bg-elevated text-ink shadow-sm ring-1 ring-hairline'
              : 'text-secondary hover:text-ink'
          }`}
        >
          JSONB Tree
        </button>
        <button
          type="button"
          onClick={() => setTab('rls')}
          className={`rounded py-1 font-medium transition ${
            tab === 'rls'
              ? 'bg-elevated text-ink shadow-sm ring-1 ring-hairline'
              : 'text-secondary hover:text-ink'
          }`}
        >
          RLS &amp; Bus
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3.5">
        {tab === 'occ' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-hairline bg-elevated p-3">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
                <span>Compare-And-Swap Engine</span>
                <span className="tabular-nums text-sage">HEAD = v{document.version}</span>
              </div>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-secondary">
                WHERE id = &apos;{document.id.slice(0, 8)}…&apos; AND version = expected_v
              </p>

              <div className="mt-2.5">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => void onSimulateConflict()}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-1.5 font-mono text-[11px] font-medium text-ink transition hover:border-terracotta hover:text-terracotta"
                  >
                    <Zap className="h-3 w-3 text-terracotta" aria-hidden="true" />
                    <span>Simulate Concurrent Conflict (3-Way Merge)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void onProbeRlsWrite()}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-ochre/40 bg-ochre-soft px-3 py-1.5 font-mono text-[11px] font-medium text-ochre transition hover:opacity-90"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Test Unauthorized Write (RLS 42501)</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              {occTransactions.map((tx) => {
                const badge = {
                  COMMITTED: 'bg-sage-soft text-sage border-sage/30',
                  MERGED_3WAY: 'bg-ochre-soft text-ochre border-ochre/30',
                  REMOTE_SYNC: 'bg-surface text-secondary border-hairline',
                  RLS_REJECTED: 'bg-terracotta-soft text-terracotta border-terracotta/30'
                }[tx.outcome];

                return (
                  <div
                    key={tx.id}
                    className="rounded-lg border border-hairline bg-elevated px-3 py-2 font-mono text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${badge}`}
                      >
                        {tx.outcome === 'MERGED_3WAY' && <GitMerge className="h-2.5 w-2.5" />}
                        {tx.outcome}
                      </span>
                      <span className="tabular-nums text-[10px] text-muted">
                        {new Date(tx.timestamp).toLocaleTimeString([], {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between tabular-nums text-ink">
                      <span className="truncate text-[10px] text-secondary">
                        {tx.actorEmail.split('@')[0]}
                      </span>
                      <span className="font-semibold">
                        v{tx.expectedVersion} &rarr; v{tx.committedVersion}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-muted">{tx.summary}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'jsonb' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between font-mono text-[10px] text-muted">
              <span>public.documents.content (JSONB)</span>
              <span>GIN jsonb_path_ops</span>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-hairline bg-codebg p-3 font-mono text-[11px] leading-relaxed tabular-nums text-ink">
              {JSON.stringify(
                {
                  version: document.version,
                  updated_at: document.updatedAt,
                  blocks_count: document.content.blocks.length,
                  blocks: document.content.blocks.map((b) => ({
                    id: b.id,
                    type: b.type,
                    checked: b.checked,
                    by: b.updatedBy.split('@')[0],
                    text: b.text
                  }))
                },
                null,
                2
              )}
            </pre>
          </div>
        )}

        {tab === 'rls' && (
          <div className="space-y-3 font-mono text-[11px]">
            <div className="rounded-lg border border-hairline bg-elevated p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted">Realtime Transport</p>
              <p className="mt-1 font-semibold text-ink">
                {cloudActive
                  ? 'Supabase Elixir/Phoenix WS + BroadcastChannel'
                  : 'Local BroadcastChannel Bus (Zero-Config)'}
              </p>
              <p className="mt-1 text-[10px] text-secondary">
                Channel: <code>room:doc_{document.id.slice(0, 8)}</code>
              </p>
            </div>

            <div className="rounded-lg border border-hairline bg-elevated p-3 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted">
                Active RLS Session Context
              </p>
              <div className="flex justify-between">
                <span className="text-secondary">auth.email()</span>
                <span className="text-ink">{currentUser?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">app_role</span>
                <span className="uppercase text-ink">{currentUser?.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">effective_acl</span>
                <span className={canEdit ? 'text-sage font-semibold' : 'text-ochre font-semibold'}>
                  {document.effectivePermission.toUpperCase()} ({canEdit ? 'READ/WRITE' : 'READ-ONLY'})
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-hairline bg-codebg p-3 text-[10px] leading-relaxed text-secondary">
              <p className="font-semibold text-ink">Policy: documents_update_owner_or_editor</p>
              <p className="mt-1">
                USING (owner_id = auth.uid() OR exists_editor_grant(id, auth.uid()))
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
