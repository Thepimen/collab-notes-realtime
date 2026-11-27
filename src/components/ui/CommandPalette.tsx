'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  FilePlus2,
  FileText,
  ListTree,
  Moon,
  Search,
  Sun,
  UserCheck
} from 'lucide-react';
import type { DocumentDTO, ProfileDTO } from '@/types/domain.types';
import { useTheme } from '@/hooks/useTheme';

interface CommandPaletteProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly documents: readonly DocumentDTO[];
  readonly activeDocument?: DocumentDTO | null;
  readonly currentUser: ProfileDTO | null;
  readonly seedAccounts: readonly ProfileDTO[];
  readonly onSelectDocument: (docId: string) => void;
  readonly onCreateDocument: () => void;
  readonly onToggleDetails?: () => void;
  readonly onExportMarkdown?: () => void;
  readonly onSwitchUser: (email: string) => void;
}

interface PaletteCommand {
  readonly id: string;
  readonly group: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: React.ReactNode;
  readonly action: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  documents,
  activeDocument,
  currentUser,
  seedAccounts,
  onSelectDocument,
  onCreateDocument,
  onToggleDetails,
  onExportMarkdown,
  onSwitchUser
}: CommandPaletteProps) {
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const commands = useMemo<readonly PaletteCommand[]>(() => {
    const items: PaletteCommand[] = [];

    items.push({
      id: 'new-doc',
      group: 'Acciones rápidas',
      label: 'Crear una nota nueva',
      hint: 'Nueva',
      icon: <FilePlus2 className="h-3.5 w-3.5 text-terracotta" />,
      action: () => {
        onClose();
        onCreateDocument();
      }
    });

    if (onToggleDetails) {
      items.push({
        id: 'toggle-details',
        group: 'Acciones rápidas',
        label: 'Ver índice, estadísticas y actividad',
        hint: 'Panel',
        icon: <ListTree className="h-3.5 w-3.5 text-secondary" />,
        action: () => {
          onClose();
          onToggleDetails();
        }
      });
    }

    if (activeDocument && onExportMarkdown) {
      items.push({
        id: 'export-md',
        group: 'Acciones rápidas',
        label: `Exportar "${activeDocument.title}" a Markdown (.md)`,
        hint: '.MD',
        icon: <Download className="h-3.5 w-3.5 text-sage" />,
        action: () => {
          onClose();
          onExportMarkdown();
        }
      });
    }

    items.push({
      id: 'toggle-theme',
      group: 'Apariencia',
      label: theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro',
      hint: theme === 'light' ? 'Oscuro' : 'Claro',
      icon:
        theme === 'light' ? (
          <Moon className="h-3.5 w-3.5 text-secondary" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-ochre" />
        ),
      action: () => {
        toggleTheme();
        onClose();
      }
    });

    seedAccounts.forEach((acc) => {
      const isCurrent = acc.id === currentUser?.id;
      const cleanName = acc.fullName.replace(/\s*\(.*\)/, '');
      items.push({
        id: `switch-${acc.id}`,
        group: 'Perfiles de prueba',
        label: `${cleanName}${isCurrent ? ' — Activo' : ''}`,
        hint: acc.role === 'viewer' ? 'Lectura' : 'Editor',
        icon: <UserCheck className="h-3.5 w-3.5 text-terracotta" />,
        action: () => {
          onClose();
          onSwitchUser(acc.email);
        }
      });
    });

    documents.forEach((doc) => {
      items.push({
        id: `doc-${doc.id}`,
        group: 'Tus notas',
        label: doc.title || 'Nota sin título',
        hint: 'Abrir',
        icon: <FileText className="h-3.5 w-3.5 text-secondary" />,
        action: () => {
          onClose();
          onSelectDocument(doc.id);
        }
      });
    });

    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.hint.toLowerCase().includes(q)
    );
  }, [
    activeDocument,
    currentUser?.id,
    documents,
    onClose,
    onCreateDocument,
    onExportMarkdown,
    onSelectDocument,
    onSwitchUser,
    onToggleDetails,
    query,
    seedAccounts,
    theme,
    toggleTheme
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (commands.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % commands.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commands.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + commands.length) % commands.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commands[selectedIndex]?.action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Búsqueda rápida y comandos"
      className="animate-backdrop-in fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onKeyDown={handleKeyDown}
        className="animate-modal-in w-full max-w-lg overflow-hidden rounded-2xl border border-hairline bg-elevated text-ink shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
          <Search className="h-4 w-4 text-muted" aria-hidden="true" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ir a una nota, crear documento o buscar comando…"
            className="flex-1 bg-transparent text-sm text-ink placeholder-muted focus:outline-none"
          />
          <kbd className="rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {commands.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">
              No hay resultados para &ldquo;{query}&rdquo;.
            </p>
          ) : (
            commands.map((cmd, idx) => {
              const showGroup = cmd.group !== lastGroup;
              lastGroup = cmd.group;
              const active = idx === selectedIndex;

              return (
                <React.Fragment key={cmd.id}>
                  {showGroup && (
                    <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {cmd.group}
                    </div>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={cmd.action}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      active ? 'bg-surface text-ink' : 'text-secondary hover:text-ink'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {cmd.icon}
                      <span className="truncate font-medium">{cmd.label}</span>
                    </span>
                    <span className="shrink-0 rounded border border-hairline bg-canvas px-1.5 py-0.5 text-[10px] text-muted">
                      {cmd.hint}
                    </span>
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
