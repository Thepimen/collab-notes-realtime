'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Database,
  Download,
  FilePlus2,
  FileText,
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
  readonly onToggleInspector?: () => void;
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
  onToggleInspector,
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
      group: 'Workspace',
      label: 'Create New Collaborative Note',
      hint: 'New',
      icon: <FilePlus2 className="h-3.5 w-3.5 text-terracotta" />,
      action: () => {
        onClose();
        onCreateDocument();
      }
    });

    if (onToggleInspector) {
      items.push({
        id: 'toggle-inspector',
        group: 'Workspace',
        label: 'Toggle Precision Inspector (JSONB · OCC · RLS)',
        hint: '⌘I',
        icon: <Database className="h-3.5 w-3.5 text-secondary" />,
        action: () => {
          onClose();
          onToggleInspector();
        }
      });
    }

    if (activeDocument && onExportMarkdown) {
      items.push({
        id: 'export-md',
        group: 'Workspace',
        label: `Export "${activeDocument.title}" as Markdown (.md)`,
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
      group: 'Appearance',
      label:
        theme === 'light'
          ? 'Switch to Obsidian Ink (Dark Mode)'
          : 'Switch to Warm Paper (Editorial Light Mode)',
      hint: theme === 'light' ? 'Dark' : 'Light',
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
      items.push({
        id: `switch-${acc.id}`,
        group: 'Sandbox Tab Identity (Isolated Session)',
        label: `${acc.fullName}${isCurrent ? ' — Active' : ''}`,
        hint: acc.role.toUpperCase(),
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
        group: 'Documents',
        label: doc.title,
        hint: `v${doc.version}`,
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
    onToggleInspector,
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
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onKeyDown={handleKeyDown}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-hairline bg-elevated text-ink shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
          <Search className="h-4 w-4 text-muted" aria-hidden="true" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to note, switch sandbox role, export Markdown…"
            className="flex-1 bg-transparent text-sm text-ink placeholder-muted focus:outline-none"
          />
          <kbd className="rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {commands.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs text-muted">
              No matching commands or notes.
            </p>
          ) : (
            commands.map((cmd, idx) => {
              const showGroup = cmd.group !== lastGroup;
              lastGroup = cmd.group;
              const active = idx === selectedIndex;

              return (
                <React.Fragment key={cmd.id}>
                  {showGroup && (
                    <div className="px-2.5 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wider text-muted">
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
                    <span className="shrink-0 rounded border border-hairline bg-canvas px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted">
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
