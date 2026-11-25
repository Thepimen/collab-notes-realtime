'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckSquare,
  Code2,
  Command,
  Database,
  GitMerge,
  Heading1,
  Heading2,
  Lock,
  Moon,
  PanelLeft,
  Plus,
  Quote,
  Share2,
  ShieldAlert,
  Sun,
  Trash2,
  Type
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { WorkspaceSidebar } from '@/components/layout/WorkspaceSidebar';
import { EditorSkeletonLoader } from '@/components/ui/SkeletonLoaders';
import { PresenceBar } from '@/components/editor/PresenceBar';
import { SyncStatusBadge } from '@/components/editor/SyncStatusBadge';
import { ShareDocumentModal } from '@/components/editor/ShareDocumentModal';
import { EngineeringInspector } from '@/components/editor/EngineeringInspector';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useDocuments } from '@/hooks/useDocuments';
import { useCollaborativeDocument } from '@/hooks/useCollaborativeDocument';
import type { BlockType, DocumentBlockDTO } from '@/types/domain.types';

function AutoResizeBlockInput({
  block,
  index,
  canEdit,
  onFocus,
  onChange,
  onOpenSlash,
  onProbeReadOnly
}: {
  readonly block: DocumentBlockDTO;
  readonly index: number;
  readonly canEdit: boolean;
  readonly onFocus: () => void;
  readonly onChange: (val: string) => void;
  readonly onOpenSlash: () => void;
  readonly onProbeReadOnly: () => void;
}) {
  const adjustHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const typographyClass = {
    'heading-1': 'font-serif text-[28px] sm:text-[32px] leading-[1.18] text-ink mt-3',
    'heading-2': 'font-serif text-[22px] sm:text-[25px] leading-[1.24] text-ink mt-2',
    paragraph: 'font-sans text-[15.5px] leading-[1.7] text-ink',
    checklist: `font-sans text-[15px] leading-[1.65] ${
      block.checked ? 'line-through text-muted' : 'text-ink'
    }`,
    code: 'font-mono text-[12.5px] leading-[1.6] text-ink bg-codebg border border-hairline rounded-lg px-3.5 py-3',
    quote: 'font-serif italic text-[19px] leading-[1.55] text-secondary border-l-2 border-terracotta pl-4 py-0.5'
  }[block.type];

  return (
    <textarea
      ref={adjustHeight}
      rows={1}
      readOnly={!canEdit}
      value={block.text}
      onFocus={onFocus}
      onClick={() => {
        if (!canEdit) onProbeReadOnly();
      }}
      onChange={(e) => {
        adjustHeight(e.currentTarget);
        const val = e.target.value;
        if (val === '/') {
          onOpenSlash();
        }
        onChange(val);
      }}
      aria-label={`Block ${index + 1} (${block.type})`}
      placeholder={
        canEdit ? 'Write something, or type "/" to switch block style…' : 'Read-only block'
      }
      className={`editor-seamless w-full resize-none overflow-hidden bg-transparent placeholder-muted ${typographyClass}`}
    />
  );
}

export default function CollaborativeDocumentPage({
  params
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { user, seedAccounts, switchSandboxUser, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();
  const router = useRouter();

  const { documents: sidebarDocs, createNewDocument } = useDocuments(user);

  const {
    document: doc,
    isLoading,
    loadError,
    canEdit,
    syncStatus,
    hasPendingChanges,
    activeUsers,
    activeBlockId,
    lastConflictNotice,
    occTransactions,
    dismissConflictNotice,
    handleBlockFocus,
    updateTitle,
    updateBlockText,
    updateBlockType,
    toggleChecklistBlock,
    addBlockAfter,
    removeBlock,
    forceSaveNow,
    simulateConcurrentCollaboratorEdit,
    attemptViewerWriteProbe,
    shareDocument,
    revokeCollaborator
  } = useCollaborativeDocument(resolvedParams.id, user);

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [slashMenuBlockId, setSlashMenuBlockId] = useState<string | null>(null);

  // Support URL query params (?inspector=1, ?sidebar=0) for side-by-side split views
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('inspector') === '1') setIsInspectorOpen(true);
      if (sp.get('sidebar') === '0') setIsSidebarOpen(false);
    } catch {
      // Ignore
    }
  }, []);

  // Global Precision Shortcuts: Cmd/Ctrl + K (Palette), Cmd/Ctrl + I (Inspector), Cmd/Ctrl + S (Sync)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      } else if (k === 'i') {
        e.preventDefault();
        setIsInspectorOpen((prev) => !prev);
      } else if (k === 's') {
        e.preventDefault();
        void forceSaveNow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [forceSaveNow]);

  const exportMarkdown = useCallback(() => {
    if (!doc) return;
    const lines: string[] = [`# ${doc.title}`, ''];
    doc.content.blocks.forEach((b) => {
      if (b.type === 'heading-1') lines.push(`# ${b.text}`, '');
      else if (b.type === 'heading-2') lines.push(`## ${b.text}`, '');
      else if (b.type === 'checklist') lines.push(`- [${b.checked ? 'x' : ' '}] ${b.text}`);
      else if (b.type === 'code') lines.push('```sql', b.text, '```', '');
      else if (b.type === 'quote') lines.push(`> ${b.text}`, '');
      else lines.push(b.text, '');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    window.document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    pushToast({
      type: 'success',
      title: 'Markdown Exported',
      message: `Saved ${doc.title} as .md`
    });
  }, [doc, pushToast]);

  const handleCreateNote = async () => {
    const created = await createNewDocument({ title: 'Untitled Field Note' });
    if (created) router.push(`/documents/${created.id}`);
  };

  const handleSwitchUser = (email: string) => {
    const next = switchSandboxUser(email);
    pushToast({
      type: 'info',
      title: 'Tab Session Switched',
      message: `Now viewing as ${next.fullName.replace(/\s*\(.*\)/, '')} [${next.role.toUpperCase()}].`
    });
  };

  const canManageCollaborators =
    doc !== null && (doc.ownerId === user?.id || user?.role === 'admin');

  const blockTypeOptions: ReadonlyArray<{
    readonly type: BlockType;
    readonly label: string;
    readonly icon: React.ReactNode;
  }> = [
    { type: 'heading-1', label: 'H1', icon: <Heading1 className="h-3 w-3" /> },
    { type: 'heading-2', label: 'H2', icon: <Heading2 className="h-3 w-3" /> },
    { type: 'paragraph', label: 'Text', icon: <Type className="h-3 w-3" /> },
    { type: 'checklist', label: 'Todo', icon: <CheckSquare className="h-3 w-3" /> },
    { type: 'code', label: 'Code', icon: <Code2 className="h-3 w-3" /> },
    { type: 'quote', label: 'Quote', icon: <Quote className="h-3 w-3" /> }
  ];

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-canvas text-ink">
        {/* Left Collapsible Editorial Sidebar */}
        <WorkspaceSidebar
          isOpen={isSidebarOpen}
          documents={sidebarDocs}
          activeDocumentId={doc?.id}
          currentUser={user}
          seedAccounts={seedAccounts}
          onCreateNote={() => void handleCreateNote()}
          onOpenPalette={() => setIsPaletteOpen(true)}
          onSwitchUser={handleSwitchUser}
          onSignOut={async () => {
            if (hasPendingChanges) await forceSaveNow();
            await signOut();
            router.replace('/login');
          }}
        />

        {/* Center Column: 48px Precision Topbar + Calm Writing Canvas */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 48px Precision Topbar */}
          <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-hairline bg-canvas px-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                title="Toggle Sidebar"
                aria-label="Toggle workspace sidebar"
                className="hidden rounded-md p-1.5 text-secondary transition hover:bg-surface hover:text-ink md:inline-flex"
              >
                <PanelLeft className="h-4 w-4" aria-hidden="true" />
              </button>

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 rounded-md p-1 text-xs text-secondary transition hover:text-ink md:hidden"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>

              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
                <Link
                  href="/dashboard"
                  className="hidden text-muted transition hover:text-ink sm:inline"
                >
                  Notes
                </Link>
                <span className="hidden text-muted sm:inline">/</span>
                <span className="max-w-[160px] truncate font-medium text-ink sm:max-w-[240px]">
                  {doc?.title ?? 'Loading…'}
                </span>
              </nav>

              {doc && !canEdit && (
                <span className="hidden items-center gap-1 rounded border border-ochre/40 bg-ochre-soft px-2 py-0.5 font-mono text-[10px] font-medium text-ochre lg:inline-flex">
                  <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                  RLS Read-Only
                </span>
              )}
            </div>

            {doc && (
              <div className="flex shrink-0 items-center gap-2">
                <PresenceBar
                  documentId={doc.id}
                  activeUsers={activeUsers}
                  currentUserId={user?.id ?? ''}
                />

                <SyncStatusBadge status={syncStatus} version={doc.version} />

                <button
                  type="button"
                  onClick={() => setIsInspectorOpen((prev) => !prev)}
                  title="Toggle Precision Inspector (Ctrl/Cmd + I)"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] transition ${
                    isInspectorOpen
                      ? 'border-terracotta/50 bg-terracotta-soft font-semibold text-terracotta'
                      : 'border-hairline bg-surface text-secondary hover:text-ink'
                  }`}
                >
                  <Database className="h-3 w-3" aria-hidden="true" />
                  <span className="hidden sm:inline">Inspector</span>
                </button>

                <button
                  type="button"
                  onClick={toggleTheme}
                  title="Toggle Warm Paper / Obsidian Ink"
                  aria-label="Toggle color theme"
                  className="rounded-lg border border-hairline bg-surface p-1.5 text-secondary transition hover:text-ink"
                >
                  {theme === 'light' ? (
                    <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Sun className="h-3.5 w-3.5 text-ochre" aria-hidden="true" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsPaletteOpen(true)}
                  title="Command Palette (Ctrl/Cmd + K)"
                  aria-label="Open Command Palette"
                  className="hidden rounded-lg border border-hairline bg-surface p-1.5 text-secondary transition hover:text-ink sm:inline-flex"
                >
                  <Command className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-terracotta-hover"
                >
                  <Share2 className="h-3 w-3" aria-hidden="true" />
                  <span className="hidden sm:inline">Share</span>
                </button>
              </div>
            )}
          </header>

          {/* Main Workspace Row: Distraction-Free Canvas + Optional Right Inspector */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto px-5 py-8 sm:px-10 sm:py-12">
              {isLoading ? (
                <EditorSkeletonLoader />
              ) : loadError || !doc ? (
                <div
                  role="alert"
                  className="mx-auto mt-12 max-w-md rounded-xl border border-terracotta/40 bg-terracotta-soft p-6 text-center"
                >
                  <Lock className="mx-auto h-7 w-7 text-terracotta" aria-hidden="true" />
                  <h1 className="mt-3 font-serif text-2xl text-ink">Access Restricted by RLS</h1>
                  <p className="mt-1.5 text-xs leading-relaxed text-secondary">
                    {loadError ??
                      'PostgreSQL Row Level Security blocked access to this document.'}
                  </p>
                  <Link
                    href="/dashboard"
                    className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-xs font-semibold text-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Back to Notes</span>
                  </Link>
                </div>
              ) : (
                <article
                  aria-labelledby="collaborative-document-title-input"
                  className="mx-auto max-w-[720px] pb-24"
                >
                  {/* RLS Read-Only Seal Banner when connected as Viewer */}
                  {!canEdit && (
                    <div
                      role="status"
                      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ochre/40 bg-ochre-soft px-4 py-2.5 text-xs text-ochre"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                          <strong>Solo lectura &middot; Protegido por RLS</strong> — Live updates
                          stream in real time, while mutations are blocked by{' '}
                          <code className="font-mono text-[11px]">
                            documents_update_owner_or_editor
                          </code>
                          .
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void attemptViewerWriteProbe()}
                        className="shrink-0 rounded border border-ochre/40 bg-elevated px-2.5 py-1 font-mono text-[10px] font-semibold text-ochre transition hover:border-ochre"
                      >
                        Force Write Probe (42501)
                      </button>
                    </div>
                  )}

                  {/* OCC 3-Way Merge Notification Strip */}
                  {lastConflictNotice && (
                    <div
                      role="status"
                      className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-ochre/40 bg-ochre-soft px-4 py-2.5 text-xs text-ochre"
                    >
                      <div className="flex items-center gap-2">
                        <GitMerge className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                          <strong>OCC 3-Way Merge Applied:</strong> {lastConflictNotice}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={dismissConflictNotice}
                        className="font-mono text-[10px] underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* Editorial Serif Document Title */}
                  <header className="border-b border-hairline pb-5">
                    <label htmlFor="collaborative-document-title-input" className="sr-only">
                      Document Title
                    </label>
                    <textarea
                      id="collaborative-document-title-input"
                      rows={1}
                      ref={(el) => {
                        if (!el) return;
                        el.style.height = 'auto';
                        el.style.height = `${el.scrollHeight}px`;
                      }}
                      readOnly={!canEdit}
                      value={doc.title}
                      onClick={() => {
                        if (!canEdit) void attemptViewerWriteProbe();
                      }}
                      onChange={(e) => {
                        e.currentTarget.style.height = 'auto';
                        e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                        updateTitle(e.target.value.replace(/\n/g, ' '));
                      }}
                      placeholder="Untitled Document"
                      className="editor-seamless w-full resize-none overflow-hidden bg-transparent font-serif text-[34px] leading-[1.12] tracking-tight text-ink placeholder-muted sm:text-[42px]"
                    />

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-muted">
                      <span>
                        Revision <strong className="text-ink">v{doc.version}</strong>
                      </span>
                      <span>&middot;</span>
                      <span>
                        Updated{' '}
                        {new Date(doc.updatedAt).toLocaleTimeString([], {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                      {doc.content.metadata?.lastEditedBy && (
                        <>
                          <span>&middot;</span>
                          <span>
                            Edited by{' '}
                            <span className="text-secondary">
                              {doc.content.metadata.lastEditedBy.split('@')[0]}
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                  </header>

                  {/* Calm Seamless Blocks */}
                  <div
                    className="mt-7 space-y-2.5"
                    role="region"
                    aria-label="Collaborative document blocks"
                  >
                    {doc.content.blocks.map((block, index) => {
                      const peerOnThisBlock = activeUsers.find(
                        (u) => u.userId !== user?.id && u.activeBlockId === block.id
                      );
                      const isFocused = activeBlockId === block.id;
                      const showSlash = slashMenuBlockId === block.id && canEdit;

                      return (
                        <div
                          key={block.id}
                          style={{
                            borderLeftColor: peerOnThisBlock ? peerOnThisBlock.color : undefined
                          }}
                          className={`group relative rounded-lg px-3 py-2 transition ${
                            peerOnThisBlock
                              ? 'border-l-2 bg-surface/70'
                              : isFocused
                                ? 'bg-surface/55'
                                : 'hover:bg-surface/35'
                          }`}
                        >
                          {/* Subtle Floating Block Controls (Visible on Focus or Hover) */}
                          <div
                            className={`mb-1 flex items-center justify-between gap-2 transition-opacity ${
                              isFocused || peerOnThisBlock
                                ? 'opacity-100'
                                : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <div className="flex items-center gap-0.5">
                              {canEdit ? (
                                blockTypeOptions.map((opt) => (
                                  <button
                                    key={opt.type}
                                    type="button"
                                    onClick={() => {
                                      updateBlockType(block.id, opt.type);
                                      setSlashMenuBlockId(null);
                                    }}
                                    aria-label={`Change block ${index + 1} to ${opt.label}`}
                                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] transition ${
                                      block.type === opt.type
                                        ? 'bg-elevated font-semibold text-terracotta ring-1 ring-hairline'
                                        : 'text-muted hover:text-ink'
                                    }`}
                                  >
                                    {opt.icon}
                                    <span>{opt.label}</span>
                                  </button>
                                ))
                              ) : (
                                <span className="font-mono text-[10px] uppercase text-muted">
                                  {block.type}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {peerOnThisBlock && (
                                <span
                                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium text-white"
                                  style={{ backgroundColor: peerOnThisBlock.color }}
                                >
                                  {peerOnThisBlock.fullName.split(' ')[0]} live
                                </span>
                              )}

                              {canEdit && (
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => addBlockAfter(block.id, 'paragraph')}
                                    aria-label={`Insert block below block ${index + 1}`}
                                    className="rounded p-1 text-muted transition hover:bg-elevated hover:text-ink"
                                  >
                                    <Plus className="h-3 w-3" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeBlock(block.id)}
                                    aria-label={`Remove block ${index + 1}`}
                                    className="rounded p-1 text-muted transition hover:bg-terracotta-soft hover:text-terracotta"
                                  >
                                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Slash Command Quick Menu */}
                          {showSlash && (
                            <div className="mb-2 inline-flex flex-wrap items-center gap-1 rounded-lg border border-hairline bg-elevated p-1 shadow-md">
                              <span className="px-1.5 font-mono text-[10px] text-muted">
                                Style:
                              </span>
                              {blockTypeOptions.map((opt) => (
                                <button
                                  key={opt.type}
                                  type="button"
                                  onClick={() => {
                                    updateBlockType(block.id, opt.type);
                                    if (block.text === '/') updateBlockText(block.id, '');
                                    setSlashMenuBlockId(null);
                                  }}
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] text-ink hover:bg-surface"
                                >
                                  {opt.icon}
                                  <span>{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Block Content */}
                          <div className="flex items-start gap-2.5">
                            {block.type === 'checklist' && (
                              <input
                                type="checkbox"
                                disabled={!canEdit}
                                checked={Boolean(block.checked)}
                                onChange={() => toggleChecklistBlock(block.id)}
                                aria-label={`Toggle task ${index + 1}`}
                                className="mt-1.5 h-4 w-4 cursor-pointer rounded border-borderstrong accent-[var(--accent)]"
                              />
                            )}

                            <AutoResizeBlockInput
                              block={block}
                              index={index}
                              canEdit={canEdit}
                              onFocus={() => handleBlockFocus(block.id)}
                              onChange={(val) => {
                                if (val !== '/' && slashMenuBlockId === block.id) {
                                  setSlashMenuBlockId(null);
                                }
                                updateBlockText(block.id, val);
                              }}
                              onOpenSlash={() => setSlashMenuBlockId(block.id)}
                              onProbeReadOnly={() => void attemptViewerWriteProbe()}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {canEdit && (
                      <div className="flex flex-wrap items-center gap-2 pt-4">
                        <button
                          type="button"
                          onClick={() => addBlockAfter(null, 'paragraph')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borderstrong px-3 py-1.5 font-mono text-[11px] text-secondary transition hover:border-terracotta hover:text-terracotta"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>New block</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => addBlockAfter(null, 'checklist')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borderstrong px-2.5 py-1.5 font-mono text-[11px] text-secondary transition hover:border-terracotta hover:text-terracotta"
                        >
                          <CheckSquare className="h-3 w-3" aria-hidden="true" />
                          <span>Checklist</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => addBlockAfter(null, 'code')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borderstrong px-2.5 py-1.5 font-mono text-[11px] text-secondary transition hover:border-terracotta hover:text-terracotta"
                        >
                          <Code2 className="h-3 w-3" aria-hidden="true" />
                          <span>SQL / Code</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              )}
            </main>

            {/* Collapsible Precision Engineering Inspector (Cmd/Ctrl + I) */}
            {doc && (
              <EngineeringInspector
                isOpen={isInspectorOpen}
                onClose={() => setIsInspectorOpen(false)}
                document={doc}
                currentUser={user}
                canEdit={canEdit}
                occTransactions={occTransactions}
                onSimulateConflict={simulateConcurrentCollaboratorEdit}
                onProbeRlsWrite={attemptViewerWriteProbe}
              />
            )}
          </div>
        </div>

        {/* Modals & Command Palette */}
        {doc && (
          <ShareDocumentModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            documentTitle={doc.title}
            ownerProfile={doc.ownerProfile}
            collaborators={doc.collaborators}
            canManageCollaborators={canManageCollaborators}
            onShare={shareDocument}
            onRevoke={revokeCollaborator}
          />
        )}

        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          documents={sidebarDocs}
          activeDocument={doc}
          currentUser={user}
          seedAccounts={seedAccounts}
          onSelectDocument={(id) => router.push(`/documents/${id}`)}
          onCreateDocument={() => void handleCreateNote()}
          onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
          onExportMarkdown={exportMarkdown}
          onSwitchUser={handleSwitchUser}
        />
      </div>
    </AuthGuard>
  );
}
