'use client';

import React from 'react';
import Link from 'next/link';
import {
  Command,
  FileText,
  Lock,
  LogOut,
  Plus,
  LayoutGrid
} from 'lucide-react';
import type { DocumentDTO, ProfileDTO } from '@/types/domain.types';

interface WorkspaceSidebarProps {
  readonly isOpen: boolean;
  readonly documents: readonly DocumentDTO[];
  readonly activeDocumentId?: string;
  readonly currentUser: ProfileDTO | null;
  readonly seedAccounts: readonly ProfileDTO[];
  readonly onCreateNote: () => void;
  readonly onOpenPalette: () => void;
  readonly onSwitchUser: (email: string) => void;
  readonly onSignOut: () => void;
}

export function WorkspaceSidebar({
  isOpen,
  documents,
  activeDocumentId,
  currentUser,
  seedAccounts,
  onCreateNote,
  onOpenPalette,
  onSwitchUser,
  onSignOut
}: WorkspaceSidebarProps) {
  if (!isOpen) return null;

  return (
    <aside
      aria-label="Document Workspace Navigation"
      className="hidden h-screen w-[252px] shrink-0 flex-col border-r border-hairline bg-surface md:flex"
    >
      {/* Editorial Brand Header */}
      <div className="flex h-12 items-center justify-between border-b border-hairline px-4">
        <Link href="/dashboard" className="flex items-baseline gap-2">
          <span className="font-serif text-xl tracking-tight text-ink">CollabNotes</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-terracotta">
            OCC
          </span>
        </Link>

        <button
          type="button"
          onClick={onOpenPalette}
          title="Command Palette (Ctrl/Cmd + K)"
          className="inline-flex items-center gap-1 rounded border border-hairline bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-secondary transition hover:border-borderstrong hover:text-ink"
        >
          <Command className="h-2.5 w-2.5" aria-hidden="true" />
          <span>K</span>
        </button>
      </div>

      {/* Quick Actions */}
      <div className="space-y-1.5 p-3">
        <button
          type="button"
          onClick={onCreateNote}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-terracotta px-3 py-2 text-xs font-semibold text-white transition hover:bg-terracotta-hover"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>New Note</span>
        </button>

        <Link
          href="/dashboard"
          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
            !activeDocumentId
              ? 'bg-elevated text-ink shadow-sm ring-1 ring-hairline'
              : 'text-secondary hover:bg-elevated/60 hover:text-ink'
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
          <span>All Notes</span>
          <span className="ml-auto font-mono text-[10px] tabular-nums text-muted">
            {documents.length}
          </span>
        </Link>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto px-3 py-1">
        <p className="mb-1.5 px-2 font-mono text-[10px] uppercase tracking-wider text-muted">
          Accessible via RLS
        </p>
        <ul className="space-y-0.5" role="list">
          {documents.map((doc) => {
            const active = doc.id === activeDocumentId;
            const isReadOnly = doc.effectivePermission === 'viewer';
            return (
              <li key={doc.id}>
                <Link
                  href={`/documents/${doc.id}`}
                  className={`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition ${
                    active
                      ? 'bg-elevated font-semibold text-ink shadow-sm ring-1 ring-hairline'
                      : 'text-secondary hover:bg-elevated/60 hover:text-ink'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {isReadOnly ? (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-ochre" aria-hidden="true" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                    )}
                    <span className="truncate">{doc.title}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted">
                    v{doc.version}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer: Tab Session Switcher */}
      {currentUser && (
        <div className="border-t border-hairline p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-ink">
                {currentUser.fullName.replace(/\s*\(.*\)/, '')}
              </p>
              <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted">
                Role: {currentUser.role}
              </p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="rounded p-1.5 text-muted transition hover:bg-elevated hover:text-terracotta"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {seedAccounts.map((acc) => {
              const selected = acc.id === currentUser.id;
              const shortLabel = acc.role === 'admin' ? 'Admin' : acc.role === 'editor' ? 'Editor' : 'Viewer';
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => onSwitchUser(acc.email)}
                  title={`Switch this tab to ${acc.fullName}`}
                  className={`flex-1 rounded border py-1 font-mono text-[10px] transition ${
                    selected
                      ? 'border-terracotta/50 bg-terracotta-soft font-semibold text-terracotta'
                      : 'border-hairline bg-elevated text-secondary hover:text-ink'
                  }`}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
