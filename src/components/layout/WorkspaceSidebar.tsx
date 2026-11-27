'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Command,
  FileText,
  LayoutGrid,
  Lock,
  LogOut,
  Plus,
  Star
} from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandMark';
import type { DocumentDTO, ProfileDTO } from '@/types/domain.types';

interface WorkspaceSidebarProps {
  readonly isOpen: boolean;
  readonly documents: readonly DocumentDTO[];
  readonly activeDocumentId?: string;
  readonly currentUser: ProfileDTO | null;
  readonly seedAccounts: readonly ProfileDTO[];
  readonly onBeforeNavigate?: () => Promise<void>;
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
  onBeforeNavigate,
  onCreateNote,
  onOpenPalette,
  onSwitchUser,
  onSignOut
}: WorkspaceSidebarProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const navigateWithFinalize = async (href: string) => {
    if (onBeforeNavigate) {
      await onBeforeNavigate();
    }
    router.push(href);
  };

  const pinnedDocs = documents.filter((d) => d.content.metadata?.pinned);
  const regularDocs = documents.filter((d) => !d.content.metadata?.pinned);

  const renderDocLink = (doc: DocumentDTO) => {
    const active = doc.id === activeDocumentId;
    const isReadOnly = doc.effectivePermission === 'viewer';
    const icon = doc.content.metadata?.icon;

    return (
      <li key={doc.id}>
        <button
          type="button"
          onClick={() => {
            if (!active) void navigateWithFinalize(`/documents/${doc.id}`);
          }}
          className={`group flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
            active
              ? 'bg-elevated font-semibold text-ink shadow-sm ring-1 ring-hairline'
              : 'text-secondary hover:bg-elevated/60 hover:text-ink'
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            {icon ? (
              <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                {icon}
              </span>
            ) : isReadOnly ? (
              <Lock className="h-3.5 w-3.5 shrink-0 text-ochre" aria-hidden="true" />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
            )}
            <span className="truncate">{doc.title || 'Nota sin título'}</span>
          </span>
          {isReadOnly && (
            <Lock className="h-3 w-3 shrink-0 text-ochre" aria-hidden="true" />
          )}
        </button>
      </li>
    );
  };

  return (
    <aside
      aria-label="Navegación de notas"
      className="no-print hidden h-screen w-[248px] shrink-0 flex-col border-r border-hairline bg-surface md:flex"
    >
      {/* Brand Header */}
      <div className="flex h-12 items-center justify-between border-b border-hairline px-4">
        <button
          type="button"
          onClick={() => void navigateWithFinalize('/dashboard')}
          className="flex items-center gap-2 text-left"
        >
          <BrandMark size="sm" />
          <span className="font-serif text-xl tracking-tight text-ink">CollabNotes</span>
        </button>

        <button
          type="button"
          onClick={onOpenPalette}
          title="Búsqueda rápida (Ctrl+K)"
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
          onClick={async () => {
            if (onBeforeNavigate) await onBeforeNavigate();
            onCreateNote();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-terracotta px-3 py-2 text-xs font-semibold text-white transition hover:bg-terracotta-hover"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Nueva nota</span>
        </button>

        <button
          type="button"
          onClick={() => void navigateWithFinalize('/dashboard')}
          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition ${
            !activeDocumentId
              ? 'bg-elevated text-ink shadow-sm ring-1 ring-hairline'
              : 'text-secondary hover:bg-elevated/60 hover:text-ink'
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
          <span>Todas las notas</span>
          <span className="ml-auto text-[11px] tabular-nums text-muted">
            {documents.length}
          </span>
        </button>
      </div>

      {/* Document Lists */}
      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-1">
        {pinnedDocs.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
              <Star className="h-2.5 w-2.5 fill-ochre text-ochre" aria-hidden="true" />
              <span>Favoritas</span>
            </p>
            <ul className="space-y-0.5" role="list">
              {pinnedDocs.map(renderDocLink)}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Recientes
          </p>
          <ul className="space-y-0.5" role="list">
            {regularDocs.map(renderDocLink)}
          </ul>
        </div>
      </div>

      {/* Footer: Current User & Optional Local Switcher */}
      {currentUser && (
        <div className="space-y-2 border-t border-hairline p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-ink">
                {currentUser.fullName.replace(/\s*\(.*\)/, '')}
              </p>
              <p className="truncate text-[11px] text-muted">{currentUser.email}</p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="rounded p-1.5 text-muted transition hover:bg-elevated hover:text-terracotta"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {seedAccounts.length > 0 && (
            <div className="flex items-center gap-1">
              {seedAccounts.map((acc) => {
                const selected = acc.id === currentUser.id;
                const shortLabel =
                  acc.role === 'admin' ? 'Luis' : acc.role === 'editor' ? 'Elena' : 'Marco';
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => onSwitchUser(acc.email)}
                    title={`Cambiar a ${acc.fullName.replace(/\s*\(.*\)/, '')}`}
                    className={`flex-1 rounded border py-1 text-[11px] transition ${
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
          )}
        </div>
      )}
    </aside>
  );
}
