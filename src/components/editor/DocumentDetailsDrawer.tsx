'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  Clock,
  Copy,
  Download,
  FileText,
  GitMerge,
  ListTree,
  Printer,
  X
} from 'lucide-react';
import type { DocumentDTO, OccTransactionEntryDTO } from '@/types/domain.types';

interface DocumentDetailsDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly document: DocumentDTO;
  readonly activityLog: readonly OccTransactionEntryDTO[];
  readonly onJumpToBlock: (blockId: string) => void;
  readonly onExportMarkdown: () => void;
  readonly onCopyPlainText: () => void;
}

type DrawerTab = 'outline' | 'stats' | 'activity';

export function DocumentDetailsDrawer({
  isOpen,
  onClose,
  document,
  activityLog,
  onJumpToBlock,
  onExportMarkdown,
  onCopyPlainText
}: DocumentDetailsDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('outline');

  const stats = useMemo(() => {
    const allText = [document.title, ...document.content.blocks.map((b) => b.text)].join(' ');
    const words = allText
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    const chars = allText.replace(/\s/g, '').length;
    const readingMinutes = Math.max(1, Math.ceil(words / 200));

    const checklists = document.content.blocks.filter((b) => b.type === 'checklist');
    const completedTasks = checklists.filter((b) => b.checked).length;

    const headings = document.content.blocks.filter(
      (b) =>
        (b.type === 'heading-1' || b.type === 'heading-2' || b.type === 'heading-3') &&
        b.text.trim().length > 0
    );

    return {
      words,
      chars,
      readingMinutes,
      totalTasks: checklists.length,
      completedTasks,
      headings
    };
  }, [document]);

  if (!isOpen) return null;

  const taskPercent =
    stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;

  return (
    <aside
      aria-label="Detalles y esquema de la nota"
      className="animate-drawer-in no-print flex h-[calc(100vh-48px)] w-full shrink-0 flex-col border-l border-hairline bg-surface md:w-[300px] lg:w-[325px]"
    >
      {/* Header */}
      <div className="flex h-11 items-center justify-between border-b border-hairline px-4">
        <div className="flex items-center gap-2">
          <ListTree className="h-4 w-4 text-terracotta" aria-hidden="true" />
          <span className="text-xs font-semibold text-ink">Detalles de la nota</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Cerrar panel"
          aria-label="Cerrar panel de detalles"
          className="rounded p-1 text-muted transition hover:bg-elevated hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 border-b border-hairline bg-canvas p-1.5 text-xs">
        <button
          type="button"
          onClick={() => setTab('outline')}
          className={`rounded-md py-1.5 font-medium transition ${
            tab === 'outline'
              ? 'bg-elevated text-ink shadow-sm ring-1 ring-hairline'
              : 'text-secondary hover:text-ink'
          }`}
        >
          Índice
        </button>
        <button
          type="button"
          onClick={() => setTab('stats')}
          className={`rounded-md py-1.5 font-medium transition ${
            tab === 'stats'
              ? 'bg-elevated text-ink shadow-sm ring-1 ring-hairline'
              : 'text-secondary hover:text-ink'
          }`}
        >
          Resumen
        </button>
        <button
          type="button"
          onClick={() => setTab('activity')}
          className={`rounded-md py-1.5 font-medium transition ${
            tab === 'activity'
              ? 'bg-elevated text-ink shadow-sm ring-1 ring-hairline'
              : 'text-secondary hover:text-ink'
          }`}
        >
          Actividad
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'outline' && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Estructura del documento
              </p>
              {stats.headings.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-borderstrong bg-elevated/60 p-4 text-center">
                  <FileText className="mx-auto h-5 w-5 text-muted" aria-hidden="true" />
                  <p className="mt-2 text-xs text-secondary">
                    Añade encabezados (H1, H2 o H3) para generar automáticamente un índice navegable.
                  </p>
                </div>
              ) : (
                <ul className="mt-2.5 space-y-1" role="list">
                  {stats.headings.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => onJumpToBlock(h.id)}
                        className={`block w-full truncate rounded-lg py-1.5 pr-2 text-left text-xs transition hover:bg-elevated hover:text-terracotta ${
                          h.type === 'heading-1'
                            ? 'pl-2 font-semibold text-ink'
                            : h.type === 'heading-2'
                              ? 'pl-5 font-medium text-secondary'
                              : 'pl-8 text-muted'
                        }`}
                      >
                        {h.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {stats.totalTasks > 0 && (
              <div className="rounded-xl border border-hairline bg-elevated p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                    <CheckSquare className="h-3.5 w-3.5 text-sage" aria-hidden="true" />
                    Progreso de tareas
                  </span>
                  <span className="font-semibold tabular-nums text-sage">
                    {stats.completedTasks}/{stats.totalTasks}
                  </span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-sage transition-all duration-300"
                    style={{ width: `${taskPercent}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted">{taskPercent}% completado</p>
              </div>
            )}

            {/* Quick Export Actions */}
            <div className="space-y-2 border-t border-hairline pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Exportar y compartir
              </p>
              <button
                type="button"
                onClick={onExportMarkdown}
                className="flex w-full items-center gap-2.5 rounded-lg border border-hairline bg-elevated px-3 py-2 text-xs font-medium text-ink transition hover:border-borderstrong"
              >
                <Download className="h-3.5 w-3.5 text-terracotta" aria-hidden="true" />
                <span>Descargar en Markdown (.md)</span>
              </button>
              <button
                type="button"
                onClick={onCopyPlainText}
                className="flex w-full items-center gap-2.5 rounded-lg border border-hairline bg-elevated px-3 py-2 text-xs font-medium text-ink transition hover:border-borderstrong"
              >
                <Copy className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                <span>Copiar texto al portapapeles</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex w-full items-center gap-2.5 rounded-lg border border-hairline bg-elevated px-3 py-2 text-xs font-medium text-ink transition hover:border-borderstrong"
              >
                <Printer className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                <span>Imprimir o guardar en PDF</span>
              </button>
            </div>
          </div>
        )}

        {tab === 'stats' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-hairline bg-elevated p-3">
                <p className="text-[11px] text-muted">Palabras</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{stats.words}</p>
              </div>
              <div className="rounded-xl border border-hairline bg-elevated p-3">
                <p className="text-[11px] text-muted">Lectura est.</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
                  {stats.readingMinutes} min
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-elevated p-3">
                <p className="text-[11px] text-muted">Caracteres</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{stats.chars}</p>
              </div>
              <div className="rounded-xl border border-hairline bg-elevated p-3">
                <p className="text-[11px] text-muted">Bloques</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
                  {document.content.blocks.length}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-hairline bg-elevated p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Propietario</span>
                <span className="font-medium text-ink">
                  {document.ownerProfile?.fullName.replace(/\s*\(.*\)/, '') ?? 'Tú'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Colaboradores</span>
                <span className="font-medium text-ink">{document.collaborators.length + 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Última edición</span>
                <span className="font-medium text-ink">
                  {new Date(document.updatedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Historial de esta sesión
            </p>
            {activityLog.length === 0 ? (
              <p className="text-xs text-muted">Aún no hay actividad registrada en esta sesión.</p>
            ) : (
              <ul className="space-y-2" role="list">
                {activityLog.map((entry) => {
                  const label =
                    entry.outcome === 'MERGED_3WAY'
                      ? 'Combinado'
                      : entry.outcome === 'REMOTE_SYNC'
                        ? 'Colaborador'
                        : 'Guardado';

                  return (
                    <li
                      key={entry.id}
                      className="rounded-xl border border-hairline bg-elevated p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 font-semibold text-ink">
                          {entry.outcome === 'MERGED_3WAY' ? (
                            <GitMerge className="h-3 w-3 text-sage" aria-hidden="true" />
                          ) : (
                            <Clock className="h-3 w-3 text-muted" aria-hidden="true" />
                          )}
                          {label}
                        </span>
                        <span className="text-[11px] tabular-nums text-muted">
                          {new Date(entry.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-secondary">{entry.summary}</p>
                      <p className="mt-1 text-[10px] text-muted">
                        Por {entry.actorEmail.split('@')[0]}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
