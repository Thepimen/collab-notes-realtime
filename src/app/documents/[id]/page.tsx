'use client';

import React, { use, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckSquare,
  Code2,
  Command,
  Copy,
  Eye,
  GitMerge,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Lightbulb,
  List,
  ListTree,
  Lock,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  PanelLeft,
  Pencil,
  Plus,
  Quote,
  Redo2,
  Share2,
  Star,
  Sun,
  Tag,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { WorkspaceSidebar } from '@/components/layout/WorkspaceSidebar';
import { EditorSkeletonLoader } from '@/components/ui/SkeletonLoaders';
import { PresenceBar } from '@/components/editor/PresenceBar';
import { SyncStatusBadge } from '@/components/editor/SyncStatusBadge';
import { ShareDocumentModal } from '@/components/editor/ShareDocumentModal';
import { DocumentDetailsDrawer } from '@/components/editor/DocumentDetailsDrawer';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useDocuments } from '@/hooks/useDocuments';
import { useCollaborativeDocument } from '@/hooks/useCollaborativeDocument';
import { ImageService } from '@/services/image.service';
import type { BlockType, DocumentBlockDTO, ImageBlockSize } from '@/types/domain.types';

const QUICK_ICONS = ['📝', '🚀', '📚', '💡', '🤝', '🎯', '📌', '✨', '📋', '🔥'] as const;

interface BlockTypeOption {
  readonly type: BlockType;
  readonly label: string;
  readonly icon: React.ReactNode;
}

const BLOCK_TYPE_OPTIONS: readonly BlockTypeOption[] = [
  { type: 'heading-1', label: 'Título 1', icon: <Heading1 className="h-3.5 w-3.5" /> },
  { type: 'heading-2', label: 'Título 2', icon: <Heading2 className="h-3.5 w-3.5" /> },
  { type: 'heading-3', label: 'Título 3', icon: <Heading3 className="h-3.5 w-3.5" /> },
  { type: 'paragraph', label: 'Texto', icon: <Type className="h-3.5 w-3.5" /> },
  { type: 'bullet', label: 'Lista', icon: <List className="h-3.5 w-3.5" /> },
  { type: 'checklist', label: 'Tarea', icon: <CheckSquare className="h-3.5 w-3.5" /> },
  { type: 'callout', label: 'Destacado', icon: <Lightbulb className="h-3.5 w-3.5" /> },
  { type: 'quote', label: 'Cita', icon: <Quote className="h-3.5 w-3.5" /> },
  { type: 'code', label: 'Código', icon: <Code2 className="h-3.5 w-3.5" /> },
  { type: 'image', label: 'Imagen', icon: <ImagePlus className="h-3.5 w-3.5" /> },
  { type: 'divider', label: 'Separador', icon: <Minus className="h-3.5 w-3.5" /> }
];

const AutoResizeBlockInput = React.memo(function AutoResizeBlockInput({
  block,
  index,
  canEdit,
  shouldFocus,
  onFocusedAfterRequest,
  onFocus,
  onChange,
  onConvertType,
  onEnterSplit,
  onBackspaceEmpty,
  onMoveOffset,
  onOpenSlash,
  onCloseSlash,
  onProbeReadOnly
}: {
  readonly block: DocumentBlockDTO;
  readonly index: number;
  readonly canEdit: boolean;
  readonly shouldFocus: boolean;
  readonly onFocusedAfterRequest: () => void;
  readonly onFocus: () => void;
  readonly onChange: (val: string) => void;
  readonly onConvertType: (type: BlockType, strippedText: string) => void;
  readonly onEnterSplit: () => void;
  readonly onBackspaceEmpty: () => void;
  readonly onMoveOffset: (delta: -1 | 1) => void;
  readonly onOpenSlash: () => void;
  readonly onCloseSlash: () => void;
  readonly onProbeReadOnly: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.max(el.scrollHeight, 26)}px`;
  }, [block.text, block.type]);

  useEffect(() => {
    if (shouldFocus && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      onFocusedAfterRequest();
    }
  }, [shouldFocus, onFocusedAfterRequest]);

  if (block.type === 'divider' || block.type === 'image') {
    return null;
  }

  const typographyClass = {
    'heading-1': 'font-serif text-[28px] sm:text-[32px] leading-[1.2] text-ink mt-1.5',
    'heading-2': 'font-serif text-[22px] sm:text-[25px] leading-[1.26] text-ink mt-1',
    'heading-3': 'font-sans text-[17px] font-semibold leading-[1.35] text-ink mt-0.5',
    paragraph: 'font-sans text-[15.5px] leading-[1.7] text-ink',
    bullet: 'font-sans text-[15.5px] leading-[1.68] text-ink',
    checklist: `font-sans text-[15px] leading-[1.65] ${
      block.checked ? 'line-through text-muted' : 'text-ink'
    }`,
    callout: 'font-sans text-[14.5px] leading-[1.6] text-ink',
    code: 'font-mono text-[13px] leading-[1.6] text-ink bg-codebg border border-hairline rounded-lg px-3.5 py-3',
    quote:
      'font-serif italic text-[19px] leading-[1.55] text-secondary border-l-2 border-terracotta pl-4 py-0.5'
  }[block.type];

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;

    if (block.type === 'paragraph') {
      if (val === '# ') {
        onConvertType('heading-1', '');
        return;
      }
      if (val === '## ') {
        onConvertType('heading-2', '');
        return;
      }
      if (val === '### ') {
        onConvertType('heading-3', '');
        return;
      }
      if (val === '- ' || val === '* ') {
        onConvertType('bullet', '');
        return;
      }
      if (val === '[] ' || val === '[ ] ' || val === '- [ ] ') {
        onConvertType('checklist', '');
        return;
      }
      if (val === '> ') {
        onConvertType('quote', '');
        return;
      }
      if (val === '```') {
        onConvertType('code', '');
        return;
      }
      if (val === '---') {
        onConvertType('divider', '');
        return;
      }
    }

    if (val === '/') {
      onOpenSlash();
    } else {
      onCloseSlash();
    }

    onChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!canEdit) return;

    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      onMoveOffset(-1);
      return;
    }
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      onMoveOffset(1);
      return;
    }

    // Ctrl/Cmd + Enter inserts a new block below; regular Enter inserts a natural line break inside this block!
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onEnterSplit();
      return;
    }

    if (e.key === 'Backspace' && block.text === '') {
      e.preventDefault();
      if (block.type !== 'paragraph') {
        onConvertType('paragraph', '');
      } else {
        onBackspaceEmpty();
      }
    }
  };

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      readOnly={!canEdit}
      value={block.text}
      onFocus={onFocus}
      onClick={() => {
        if (!canEdit) onProbeReadOnly();
      }}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      aria-label={`Bloque ${index + 1}`}
      placeholder={
        canEdit
          ? block.type === 'heading-1'
            ? 'Título principal…'
            : block.type === 'heading-2'
              ? 'Subtítulo…'
              : block.type === 'checklist'
                ? 'Tarea por hacer…'
                : block.type === 'code'
                  ? 'Escribe aquí tu código…'
                  : 'Escribe aquí, pega una imagen (Ctrl+V) o pulsa "/"…'
          : ''
      }
      className={`editor-seamless w-full resize-none overflow-hidden bg-transparent placeholder-muted ${typographyClass}`}
    />
  );
});

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

  const { allDocuments: sidebarDocs, createNewDocument } = useDocuments(user);

  const {
    document: doc,
    isLoading,
    loadError,
    canEdit,
    syncStatus,
    activeUsers,
    activeBlockId,
    focusRequestId,
    clearFocusRequest,
    lastConflictNotice,
    occTransactions,
    canUndo,
    canRedo,
    dismissConflictNotice,
    handleBlockFocus,
    updateTitle,
    updateBlockText,
    updateBlockType,
    toggleChecklistBlock,
    addBlockAfter,
    insertImageBlock,
    updateImageBlock,
    duplicateBlock,
    moveBlock,
    moveBlockByOffset,
    removeBlock,
    togglePinned,
    setDocumentIcon,
    addTag,
    removeTag,
    undo,
    redo,
    forceSaveNow,
    finalizeSessionOnLeave,
    attemptViewerWriteProbe,
    shareDocument,
    revokeCollaborator
  } = useCollaborativeDocument(resolvedParams.id, user);

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [isReadPreview, setIsReadPreview] = useState<boolean>(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [slashMenuBlockId, setSlashMenuBlockId] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState<boolean>(false);
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [showTagInput, setShowTagInput] = useState<boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<{
    readonly url: string;
    readonly caption?: string;
  } | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [pendingImageTargetBlockId, setPendingImageTargetBlockId] = useState<string | null>(null);

  // Precision Drag & Drop state (supports inserting ABOVE or BELOW any block!)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    readonly index: number;
    readonly position: 'before' | 'after';
  } | null>(null);
  const [isDraggingExternalFile, setIsDraggingExternalFile] = useState<boolean>(false);

  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.max(el.scrollHeight, 44)}px`;
  }, [doc?.title]);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('sidebar') === '0') setIsSidebarOpen(false);
    } catch {
      // Ignore
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxImage) {
        setLightboxImage(null);
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      } else if (k === 's') {
        e.preventDefault();
        void forceSaveNow();
      } else if (k === 'z' && !e.shiftKey && canEdit) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && canUndo) {
          e.preventDefault();
          undo();
        }
      } else if ((k === 'y' || (k === 'z' && e.shiftKey)) && canEdit && canRedo) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEdit, canRedo, canUndo, forceSaveNow, lightboxImage, redo, undo]);

  // Helper to ingest one or more image files (from Ctrl+V paste, desktop drop, or picker)
  const handleImageFiles = useCallback(
    async (files: readonly File[], afterBlockId: string | null) => {
      if (!canEdit || files.length === 0) return;
      setIsProcessingImage(true);
      let insertCursor = afterBlockId ?? activeBlockId;

      try {
        for (const file of files) {
          const dataUrl = await ImageService.processImageFile(file);
          const createdId = insertImageBlock({
            afterBlockId: insertCursor,
            imageUrl: dataUrl,
            imageCaption: ''
          });
          if (createdId) {
            insertCursor = createdId;
          }
        }
        pushToast({
          type: 'success',
          title: files.length === 1 ? 'Imagen añadida' : `${files.length} imágenes añadidas`,
          message: 'Se guardó dentro de tu nota y puedes moverla o añadir un pie de foto.'
        });
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : 'No se pudo procesar la imagen.';
        pushToast({
          type: 'error',
          title: 'Error con la imagen',
          message: msg
        });
      } finally {
        setIsProcessingImage(false);
      }
    },
    [activeBlockId, canEdit, insertImageBlock, pushToast]
  );

  // Global clipboard paste handler inside the editor (Ctrl+V screenshots & copied photos!)
  const handleEditorPaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!canEdit || isReadPreview) return;
      const pastedImages = ImageService.extractImagesFromClipboard(e.clipboardData);
      if (pastedImages.length > 0) {
        e.preventDefault();
        void handleImageFiles(pastedImages, activeBlockId);
      }
    },
    [activeBlockId, canEdit, handleImageFiles, isReadPreview]
  );

  const openImagePicker = useCallback((afterBlockId: string | null) => {
    setPendingImageTargetBlockId(afterBlockId);
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      void handleImageFiles(files, pendingImageTargetBlockId);
    }
    e.target.value = '';
  };

  const navigateAwaySafely = useCallback(
    async (href: string) => {
      await finalizeSessionOnLeave();
      router.push(href);
    },
    [finalizeSessionOnLeave, router]
  );

  const exportMarkdown = useCallback(() => {
    if (!doc) return;
    const lines: string[] = [`# ${doc.title}`, ''];
    doc.content.blocks.forEach((b) => {
      if (b.type === 'heading-1') lines.push(`# ${b.text}`, '');
      else if (b.type === 'heading-2') lines.push(`## ${b.text}`, '');
      else if (b.type === 'heading-3') lines.push(`### ${b.text}`, '');
      else if (b.type === 'bullet') lines.push(`- ${b.text}`);
      else if (b.type === 'checklist') lines.push(`- [${b.checked ? 'x' : ' '}] ${b.text}`);
      else if (b.type === 'callout') lines.push(`> 💡 ${b.text}`, '');
      else if (b.type === 'code') lines.push('```', b.text, '```', '');
      else if (b.type === 'quote') lines.push(`> ${b.text}`, '');
      else if (b.type === 'image' && b.imageUrl) {
        lines.push(`![${b.imageCaption || 'Imagen'}](${b.imageUrl})`, '');
      } else if (b.type === 'divider') lines.push('---', '');
      else lines.push(b.text, '');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${(doc.title || 'nota').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    window.document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    pushToast({
      type: 'success',
      title: 'Nota exportada',
      message: `Se descargó "${doc.title}" en formato Markdown.`
    });
  }, [doc, pushToast]);

  const copyPlainText = useCallback(async () => {
    if (!doc) return;
    const text = [
      doc.title,
      '',
      ...doc.content.blocks.map((b) =>
        b.type === 'divider'
          ? '---'
          : b.type === 'image'
            ? `[Imagen${b.imageCaption ? `: ${b.imageCaption}` : ''}]`
            : b.type === 'bullet'
              ? `• ${b.text}`
              : b.text
      )
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      pushToast({
        type: 'success',
        title: 'Copiado al portapapeles',
        message: 'El contenido de la nota se ha copiado como texto.'
      });
    } catch {
      pushToast({
        type: 'error',
        title: 'No se pudo copiar',
        message: 'Tu navegador bloqueó el acceso al portapapeles.'
      });
    }
  }, [doc, pushToast]);

  const handleJumpToBlock = useCallback(
    (blockId: string) => {
      const el = window.document.getElementById(`block-node-${blockId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        handleBlockFocus(blockId);
      }
    },
    [handleBlockFocus]
  );

  const handleCreateNote = async () => {
    const created = await createNewDocument({ title: 'Nota sin título' });
    if (created) router.push(`/documents/${created.id}`);
  };

  const handleSwitchUser = (email: string) => {
    const next = switchSandboxUser(email);
    pushToast({
      type: 'info',
      title: 'Perfil cambiado',
      message: `Ahora navegas como ${next.fullName.replace(/\s*\(.*\)/, '')}.`
    });
  };

  const handleTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagInput.trim()) {
      addTag(newTagInput.trim());
      setNewTagInput('');
      setShowTagInput(false);
    }
  };

  const handleDropOnBlock = (targetIndex: number, position: 'before' | 'after') => {
    if (draggingIndex === null) return;
    let destination = position === 'before' ? targetIndex : targetIndex + 1;
    if (draggingIndex < destination) {
      destination -= 1;
    }
    if (destination !== draggingIndex) {
      moveBlock(draggingIndex, destination);
    }
    setDraggingIndex(null);
    setDropIndicator(null);
  };

  const canManageCollaborators =
    doc !== null && (doc.ownerId === user?.id || user?.role === 'admin');

  const isPinned = Boolean(doc?.content.metadata?.pinned);
  const docIcon = doc?.content.metadata?.icon;
  const docTags = doc?.content.metadata?.tags ?? [];

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-canvas text-ink">
        {/* Hidden Image Upload Picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          aria-hidden="true"
        />

        {/* Left Collapsible Sidebar */}
        {!isFocusMode && (
          <WorkspaceSidebar
            isOpen={isSidebarOpen}
            documents={sidebarDocs}
            activeDocumentId={doc?.id}
            currentUser={user}
            seedAccounts={seedAccounts}
            onBeforeNavigate={finalizeSessionOnLeave}
            onCreateNote={() => void handleCreateNote()}
            onOpenPalette={() => setIsPaletteOpen(true)}
            onSwitchUser={handleSwitchUser}
            onSignOut={async () => {
              await finalizeSessionOnLeave();
              await signOut();
              router.replace('/login');
            }}
          />
        )}

        {/* Center Column: Clean Topbar + Distraction-Free Canvas */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print flex h-12 shrink-0 items-center justify-between gap-2 border-b border-hairline bg-canvas px-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              {!isFocusMode && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen((prev) => !prev)}
                  title="Mostrar u ocultar barra lateral"
                  aria-label="Mostrar u ocultar barra lateral"
                  className="hidden rounded-md p-1.5 text-secondary transition hover:bg-surface hover:text-ink md:inline-flex"
                >
                  <PanelLeft className="h-4 w-4" aria-hidden="true" />
                </button>
              )}

              <button
                type="button"
                onClick={() => void navigateAwaySafely('/dashboard')}
                className="inline-flex items-center gap-1 rounded-md p-1 text-xs text-secondary transition hover:text-ink md:hidden"
                aria-label="Volver a mis notas"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              <nav aria-label="Ruta actual" className="flex min-w-0 items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => void navigateAwaySafely('/dashboard')}
                  className="hidden text-muted transition hover:text-ink sm:inline"
                >
                  Mis notas
                </button>
                <span className="hidden text-muted sm:inline">/</span>
                <span className="max-w-[140px] truncate font-medium text-ink sm:max-w-[230px]">
                  {doc?.title || 'Sin título'}
                </span>
              </nav>

              {doc && !canEdit && (
                <span className="hidden items-center gap-1 rounded-full bg-ochre-soft px-2 py-0.5 text-[11px] font-medium text-ochre lg:inline-flex">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Solo lectura
                </span>
              )}
            </div>

            {doc && (
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <PresenceBar
                  documentId={doc.id}
                  activeUsers={activeUsers}
                  currentUserId={user?.id ?? ''}
                />

                <SyncStatusBadge
                  status={syncStatus}
                  onManualSave={() => void forceSaveNow()}
                />

                {canEdit && (
                  <div className="hidden items-center gap-0.5 border-l border-hairline pl-1.5 md:flex">
                    <button
                      type="button"
                      disabled={!canUndo}
                      onClick={undo}
                      title="Deshacer"
                      aria-label="Deshacer último cambio"
                      className="rounded-md p-1.5 text-secondary transition hover:bg-surface hover:text-ink disabled:opacity-30"
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={!canRedo}
                      onClick={redo}
                      title="Rehacer"
                      aria-label="Rehacer cambio"
                      className="rounded-md p-1.5 text-secondary transition hover:bg-surface hover:text-ink disabled:opacity-30"
                    >
                      <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}

                {canEdit && (
                  <button
                    type="button"
                    onClick={togglePinned}
                    title={isPinned ? 'Quitar de favoritos' : 'Fijar en favoritos'}
                    aria-label={isPinned ? 'Quitar de favoritos' : 'Fijar en favoritos'}
                    className={`rounded-lg p-1.5 transition hover:bg-surface ${
                      isPinned ? 'text-ochre' : 'text-secondary hover:text-ink'
                    }`}
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${isPinned ? 'fill-current' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsReadPreview((prev) => !prev)}
                  title={isReadPreview ? 'Volver a edición' : 'Vista de lectura'}
                  className={`hidden items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition sm:inline-flex ${
                    isReadPreview
                      ? 'border-terracotta/40 bg-terracotta-soft text-terracotta'
                      : 'border-hairline bg-surface text-secondary hover:text-ink'
                  }`}
                >
                  {isReadPreview ? (
                    <>
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      <span>Editar</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" aria-hidden="true" />
                      <span>Lectura</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsFocusMode((prev) => !prev)}
                  title={isFocusMode ? 'Salir de modo enfoque' : 'Modo enfoque'}
                  aria-label={isFocusMode ? 'Salir de modo enfoque' : 'Activar modo enfoque'}
                  className="hidden rounded-lg border border-hairline bg-surface p-1.5 text-secondary transition hover:text-ink lg:inline-flex"
                >
                  {isFocusMode ? (
                    <Minimize2 className="h-3.5 w-3.5 text-terracotta" aria-hidden="true" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsDetailsOpen((prev) => !prev)}
                  title="Índice, estadísticas y exportación"
                  aria-label="Abrir detalles e índice"
                  className={`rounded-lg border p-1.5 transition ${
                    isDetailsOpen
                      ? 'border-terracotta/50 bg-terracotta-soft text-terracotta'
                      : 'border-hairline bg-surface text-secondary hover:text-ink'
                  }`}
                >
                  <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={toggleTheme}
                  title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
                  aria-label="Cambiar tema de color"
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
                  title="Búsqueda rápida (Ctrl+K)"
                  aria-label="Abrir búsqueda rápida"
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
                  <span className="hidden sm:inline">Compartir</span>
                </button>
              </div>
            )}
          </header>

          {/* Main Workspace Row */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <main
              onPaste={handleEditorPaste}
              onDragOver={(e) => {
                if (!canEdit || draggingIndex !== null) return;
                if (e.dataTransfer.types.includes('Files')) {
                  e.preventDefault();
                  setIsDraggingExternalFile(true);
                }
              }}
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) {
                  setIsDraggingExternalFile(false);
                }
              }}
              onDrop={(e) => {
                if (!canEdit || draggingIndex !== null) return;
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  e.preventDefault();
                  setIsDraggingExternalFile(false);
                  const imageFiles = Array.from(e.dataTransfer.files).filter((f) =>
                    f.type.startsWith('image/')
                  );
                  if (imageFiles.length > 0) {
                    void handleImageFiles(imageFiles, activeBlockId);
                  }
                }
              }}
              className={`relative flex-1 overflow-y-auto px-5 py-8 transition sm:px-12 sm:py-12 ${
                isDraggingExternalFile ? 'ring-2 ring-inset ring-terracotta bg-terracotta-soft/20' : ''
              }`}
            >
              {isDraggingExternalFile && (
                <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-canvas/75 backdrop-blur-[2px]">
                  <div className="rounded-2xl border-2 border-dashed border-terracotta bg-elevated px-8 py-6 text-center shadow-xl">
                    <ImagePlus className="mx-auto h-8 w-8 text-terracotta" aria-hidden="true" />
                    <p className="mt-2 font-serif text-2xl text-ink">Suelta tu imagen aquí</p>
                    <p className="mt-1 text-xs text-secondary">
                      Se insertará automáticamente dentro de la nota.
                    </p>
                  </div>
                </div>
              )}

              {isLoading ? (
                <EditorSkeletonLoader />
              ) : loadError || !doc ? (
                <div
                  role="alert"
                  className="mx-auto mt-12 max-w-md rounded-2xl border border-terracotta/30 bg-terracotta-soft p-6 text-center"
                >
                  <Lock className="mx-auto h-7 w-7 text-terracotta" aria-hidden="true" />
                  <h1 className="mt-3 font-serif text-2xl text-ink">No se pudo abrir esta nota</h1>
                  <p className="mt-1.5 text-xs leading-relaxed text-secondary">
                    {loadError ?? 'No tienes acceso a este documento o fue eliminado.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-xs font-semibold text-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Volver a mis notas</span>
                  </button>
                </div>
              ) : (
                <article
                  aria-labelledby="collaborative-document-title-input"
                  className="animate-reveal-up mx-auto max-w-[740px] pb-28"
                >
                  {/* Read-Only Banner */}
                  {!canEdit && (
                    <div
                      role="status"
                      className="no-print mb-6 flex items-center gap-2.5 rounded-xl border border-ochre/30 bg-ochre-soft px-4 py-2.5 text-xs text-ochre"
                    >
                      <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        <strong>Modo solo lectura.</strong> Verás los cambios en tiempo real, pero
                        necesitas permiso de edición para modificar esta nota.
                      </span>
                    </div>
                  )}

                  {/* Genuine Multi-User Merge Notice (only if two distinct users edited the exact same block!) */}
                  {lastConflictNotice && (
                    <div
                      role="status"
                      className="no-print mb-6 flex items-center justify-between gap-3 rounded-xl border border-sage/30 bg-sage-soft px-4 py-2.5 text-xs text-sage"
                    >
                      <div className="flex items-center gap-2">
                        <GitMerge className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{lastConflictNotice}</span>
                      </div>
                      <button
                        type="button"
                        onClick={dismissConflictNotice}
                        className="text-xs font-medium underline"
                      >
                        Cerrar
                      </button>
                    </div>
                  )}

                  {/* Document Header */}
                  <header className="border-b border-hairline pb-5">
                    <div className="relative mb-2 flex items-center gap-2">
                      {canEdit && !isReadPreview ? (
                        <button
                          type="button"
                          onClick={() => setShowIconPicker((prev) => !prev)}
                          title="Cambiar icono de la nota"
                          className="no-print inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-surface hover:text-ink"
                        >
                          <span className="text-lg leading-none">{docIcon ?? '📝'}</span>
                          <span className="text-[11px]">Icono</span>
                        </button>
                      ) : (
                        docIcon && <span className="text-2xl">{docIcon}</span>
                      )}

                      {showIconPicker && canEdit && (
                        <div className="animate-modal-in absolute left-0 top-9 z-20 flex items-center gap-1 rounded-xl border border-hairline bg-elevated p-2 shadow-lg">
                          {QUICK_ICONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                setDocumentIcon(emoji);
                                setShowIconPicker(false);
                              }}
                              className="rounded-lg p-1.5 text-base transition hover:bg-surface"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <label htmlFor="collaborative-document-title-input" className="sr-only">
                      Título de la nota
                    </label>
                    <textarea
                      ref={titleRef}
                      id="collaborative-document-title-input"
                      rows={1}
                      readOnly={!canEdit || isReadPreview}
                      value={doc.title}
                      onChange={(e) => updateTitle(e.target.value.replace(/\n/g, ' '))}
                      placeholder="Nota sin título"
                      className="editor-seamless w-full resize-none overflow-hidden bg-transparent font-serif text-[34px] leading-[1.12] tracking-tight text-ink placeholder-muted sm:text-[42px]"
                    />

                    {/* Editable Tags Bar */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {docTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-[11px] font-medium text-secondary"
                        >
                          <span>#{tag}</span>
                          {canEdit && !isReadPreview && (
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              aria-label={`Quitar etiqueta ${tag}`}
                              className="rounded-full p-0.5 text-muted hover:text-terracotta"
                            >
                              <X className="h-2.5 w-2.5" aria-hidden="true" />
                            </button>
                          )}
                        </span>
                      ))}

                      {canEdit && !isReadPreview && (
                        <>
                          {showTagInput ? (
                            <form onSubmit={handleTagSubmit} className="inline-flex items-center">
                              <input
                                type="text"
                                autoFocus
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                onBlur={() => {
                                  if (newTagInput.trim()) addTag(newTagInput.trim());
                                  setNewTagInput('');
                                  setShowTagInput(false);
                                }}
                                placeholder="Nueva etiqueta…"
                                className="w-28 rounded-full border border-terracotta/50 bg-elevated px-2.5 py-0.5 text-[11px] text-ink placeholder-muted focus:outline-none"
                              />
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowTagInput(true)}
                              className="no-print inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted transition hover:bg-surface hover:text-ink"
                            >
                              <Tag className="h-3 w-3" aria-hidden="true" />
                              <span>Añadir etiqueta</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </header>

                  {/* VIEW MODE: CLEAN READING PREVIEW */}
                  {isReadPreview ? (
                    <div className="mt-8 space-y-4">
                      {doc.content.blocks.map((block) => {
                        if (block.type === 'divider') {
                          return <hr key={block.id} className="my-6 border-t border-borderstrong" />;
                        }
                        if (block.type === 'image' && block.imageUrl) {
                          const widthClass =
                            block.imageSize === 'compact'
                              ? 'max-w-sm'
                              : block.imageSize === 'full'
                                ? 'w-full'
                                : 'max-w-xl';
                          return (
                            <figure key={block.id} className={`mx-auto my-5 ${widthClass}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={block.imageUrl}
                                alt={block.imageCaption || 'Imagen en la nota'}
                                onClick={() =>
                                  setLightboxImage({
                                    url: block.imageUrl!,
                                    caption: block.imageCaption
                                  })
                                }
                                className="w-full cursor-zoom-in rounded-xl border border-hairline object-contain shadow-sm"
                              />
                              {block.imageCaption && (
                                <figcaption className="mt-2 text-center text-xs text-muted">
                                  {block.imageCaption}
                                </figcaption>
                              )}
                            </figure>
                          );
                        }
                        if (block.type === 'heading-1') {
                          return (
                            <h2 key={block.id} className="mt-4 whitespace-pre-wrap font-serif text-3xl text-ink">
                              {block.text}
                            </h2>
                          );
                        }
                        if (block.type === 'heading-2') {
                          return (
                            <h3 key={block.id} className="mt-3 whitespace-pre-wrap font-serif text-2xl text-ink">
                              {block.text}
                            </h3>
                          );
                        }
                        if (block.type === 'heading-3') {
                          return (
                            <h4 key={block.id} className="mt-2 whitespace-pre-wrap text-lg font-semibold text-ink">
                              {block.text}
                            </h4>
                          );
                        }
                        if (block.type === 'bullet') {
                          return (
                            <div key={block.id} className="flex items-start gap-2.5 pl-2">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
                              <p className="whitespace-pre-wrap text-[15.5px] leading-relaxed text-ink">{block.text}</p>
                            </div>
                          );
                        }
                        if (block.type === 'checklist') {
                          return (
                            <label
                              key={block.id}
                              className="flex cursor-pointer items-start gap-2.5"
                            >
                              <input
                                type="checkbox"
                                disabled={!canEdit}
                                checked={Boolean(block.checked)}
                                onChange={() => toggleChecklistBlock(block.id)}
                                className="mt-1.5 h-4 w-4 rounded accent-[var(--accent)]"
                              />
                              <span
                                className={`whitespace-pre-wrap text-[15px] leading-relaxed ${
                                  block.checked ? 'text-muted line-through' : 'text-ink'
                                }`}
                              >
                                {block.text}
                              </span>
                            </label>
                          );
                        }
                        if (block.type === 'callout') {
                          return (
                            <div
                              key={block.id}
                              className="flex items-start gap-3 rounded-xl border border-hairline bg-surface p-4 text-sm leading-relaxed text-ink"
                            >
                              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-ochre" />
                              <p className="whitespace-pre-wrap">{block.text}</p>
                            </div>
                          );
                        }
                        if (block.type === 'quote') {
                          return (
                            <blockquote
                              key={block.id}
                              className="whitespace-pre-wrap border-l-2 border-terracotta pl-4 font-serif text-xl italic text-secondary"
                            >
                              {block.text}
                            </blockquote>
                          );
                        }
                        if (block.type === 'code') {
                          return (
                            <pre
                              key={block.id}
                              className="overflow-x-auto rounded-xl border border-hairline bg-codebg p-4 font-mono text-xs leading-relaxed text-ink"
                            >
                              <code>{block.text}</code>
                            </pre>
                          );
                        }
                        return (
                          <p
                            key={block.id}
                            className="whitespace-pre-wrap text-[15.5px] leading-[1.75] text-ink"
                          >
                            {block.text}
                          </p>
                        );
                      })}
                    </div>
                  ) : (
                    /* INTERACTIVE BLOCK EDITOR WITH PRECISION DRAG-AND-DROP & IMAGE PASTE */
                    <div
                      className="mt-7 space-y-1.5"
                      role="region"
                      aria-label="Bloques del documento"
                    >
                      {doc.content.blocks.map((block, index) => {
                        const peerOnThisBlock = activeUsers.find(
                          (u) => u.userId !== user?.id && u.activeBlockId === block.id
                        );
                        const isFocused = activeBlockId === block.id;
                        const showSlash = slashMenuBlockId === block.id && canEdit;
                        const isDragging = draggingIndex === index;
                        const showTopDropLine =
                          dropIndicator?.index === index &&
                          dropIndicator.position === 'before' &&
                          draggingIndex !== null &&
                          draggingIndex !== index;
                        const showBottomDropLine =
                          dropIndicator?.index === index &&
                          dropIndicator.position === 'after' &&
                          draggingIndex !== null &&
                          draggingIndex !== index;

                        const imageSizeClass =
                          block.imageSize === 'compact'
                            ? 'max-w-xs'
                            : block.imageSize === 'full'
                              ? 'w-full'
                              : 'max-w-xl';

                        return (
                          <div
                            key={block.id}
                            id={`block-node-${block.id}`}
                            onDragOver={(e) => {
                              if (!canEdit || draggingIndex === null) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              const rect = e.currentTarget.getBoundingClientRect();
                              const pos: 'before' | 'after' =
                                e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                              if (
                                dropIndicator?.index !== index ||
                                dropIndicator?.position !== pos
                              ) {
                                setDropIndicator({ index, position: pos });
                              }
                            }}
                            onDragLeave={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                                if (dropIndicator?.index === index) {
                                  setDropIndicator(null);
                                }
                              }
                            }}
                            onDrop={(e) => {
                              if (draggingIndex === null) return;
                              e.preventDefault();
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const pos: 'before' | 'after' =
                                e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                              handleDropOnBlock(index, pos);
                            }}
                            style={{
                              borderLeftColor: peerOnThisBlock ? peerOnThisBlock.color : undefined
                            }}
                            className={`animate-block-enter group relative rounded-xl px-2 py-2 transition-all sm:px-3 ${
                              isDragging ? 'opacity-35 scale-[0.99]' : 'opacity-100'
                            } ${
                              peerOnThisBlock
                                ? 'border-l-2 bg-surface/70'
                                : isFocused
                                  ? 'bg-surface/45'
                                  : 'hover:bg-surface/30'
                            }`}
                          >
                            {/* Precision Top Insertion Drop Bar */}
                            {showTopDropLine && (
                              <div
                                aria-hidden="true"
                                className="pointer-events-none absolute -top-1 left-2 right-2 z-20 flex items-center"
                              >
                                <span className="h-2 w-2 rounded-full bg-terracotta" />
                                <span className="h-0.5 flex-1 bg-terracotta" />
                              </div>
                            )}

                            {/* Floating Block Action Bar (Type, Move Up/Down, Duplicate, Add, Delete) */}
                            <div
                              className={`no-print mb-1 flex flex-wrap items-center justify-between gap-2 transition-opacity ${
                                isFocused || peerOnThisBlock || showSlash || block.type === 'image'
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                {canEdit && block.type !== 'image' && (
                                  <select
                                    aria-label={`Tipo de bloque ${index + 1}`}
                                    value={block.type}
                                    onChange={(e) => {
                                      const nextT = e.target.value as BlockType;
                                      if (nextT === 'image') {
                                        openImagePicker(block.id);
                                        return;
                                      }
                                      updateBlockType(block.id, nextT);
                                      setSlashMenuBlockId(null);
                                    }}
                                    className="rounded-md border border-hairline bg-elevated px-2 py-0.5 text-[11px] font-medium text-secondary focus:border-terracotta focus:outline-none"
                                  >
                                    {BLOCK_TYPE_OPTIONS.map((opt) => (
                                      <option key={opt.type} value={opt.type}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                )}

                                {canEdit && block.type === 'image' && (
                                  <div className="inline-flex items-center gap-0.5 rounded-md border border-hairline bg-elevated p-0.5 text-[10px]">
                                    {(
                                      [
                                        { id: 'compact', label: 'Pequeña' },
                                        { id: 'normal', label: 'Mediana' },
                                        { id: 'full', label: 'Completa' }
                                      ] as ReadonlyArray<{
                                        readonly id: ImageBlockSize;
                                        readonly label: string;
                                      }>
                                    ).map((sz) => (
                                      <button
                                        key={sz.id}
                                        type="button"
                                        onClick={() =>
                                          updateImageBlock(block.id, { imageSize: sz.id })
                                        }
                                        className={`rounded px-2 py-0.5 font-medium transition ${
                                          (block.imageSize ?? 'normal') === sz.id
                                            ? 'bg-terracotta text-white'
                                            : 'text-secondary hover:text-ink'
                                        }`}
                                      >
                                        {sz.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                {peerOnThisBlock && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                                    style={{ backgroundColor: peerOnThisBlock.color }}
                                  >
                                    {peerOnThisBlock.fullName.split(' ')[0]} aquí
                                  </span>
                                )}

                                {canEdit && (
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() => moveBlockByOffset(block.id, -1)}
                                      title="Mover bloque arriba (Alt + ↑)"
                                      aria-label={`Mover bloque ${index + 1} hacia arriba`}
                                      className="rounded p-1 text-secondary transition hover:bg-elevated hover:text-ink disabled:opacity-25"
                                    >
                                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === doc.content.blocks.length - 1}
                                      onClick={() => moveBlockByOffset(block.id, 1)}
                                      title="Mover bloque abajo (Alt + ↓)"
                                      aria-label={`Mover bloque ${index + 1} hacia abajo`}
                                      className="rounded p-1 text-secondary transition hover:bg-elevated hover:text-ink disabled:opacity-25"
                                    >
                                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => duplicateBlock(block.id)}
                                      title="Duplicar bloque"
                                      aria-label={`Duplicar bloque ${index + 1}`}
                                      className="rounded p-1 text-muted transition hover:bg-elevated hover:text-ink"
                                    >
                                      <Copy className="h-3 w-3" aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openImagePicker(block.id)}
                                      title="Insertar imagen debajo"
                                      aria-label={`Insertar imagen debajo del bloque ${index + 1}`}
                                      className="rounded p-1 text-muted transition hover:bg-elevated hover:text-ink"
                                    >
                                      <ImagePlus className="h-3 w-3" aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => addBlockAfter(block.id, 'paragraph')}
                                      title="Añadir bloque debajo"
                                      aria-label={`Añadir bloque debajo del bloque ${index + 1}`}
                                      className="rounded p-1 text-muted transition hover:bg-elevated hover:text-ink"
                                    >
                                      <Plus className="h-3 w-3" aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeBlock(block.id)}
                                      title="Eliminar bloque"
                                      aria-label={`Eliminar bloque ${index + 1}`}
                                      className="rounded p-1 text-muted transition hover:bg-terracotta-soft hover:text-terracotta"
                                    >
                                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Slash Command Menu ("/") */}
                            {showSlash && (
                              <div className="animate-modal-in mb-2 grid grid-cols-2 gap-1 rounded-xl border border-hairline bg-elevated p-2 shadow-lg sm:grid-cols-4">
                                {BLOCK_TYPE_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.type}
                                    type="button"
                                    onClick={() => {
                                      setSlashMenuBlockId(null);
                                      if (opt.type === 'image') {
                                        if (block.text === '/') updateBlockText(block.id, '');
                                        openImagePicker(block.id);
                                        return;
                                      }
                                      updateBlockType(block.id, opt.type, '');
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-ink transition hover:bg-surface hover:text-terracotta"
                                  >
                                    <span className="text-secondary">{opt.icon}</span>
                                    <span className="truncate">{opt.label}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Block Body Row with Always-Accessible Drag Handle */}
                            <div
                              className={`flex items-start gap-2 ${
                                block.type === 'callout'
                                  ? 'rounded-xl border border-hairline bg-surface/90 p-3'
                                  : ''
                              }`}
                            >
                              {canEdit && (
                                <button
                                  type="button"
                                  draggable
                                  onDragStart={(e) => {
                                    setDraggingIndex(index);
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', String(index));
                                  }}
                                  onDragEnd={() => {
                                    setDraggingIndex(null);
                                    setDropIndicator(null);
                                  }}
                                  title="Arrastra arriba o abajo para colocar este bloque"
                                  aria-label={`Arrastrar bloque ${index + 1}`}
                                  className={`no-print mt-1.5 cursor-grab rounded p-0.5 text-muted transition hover:bg-elevated hover:text-ink active:cursor-grabbing ${
                                    isFocused || block.type === 'image'
                                      ? 'opacity-80'
                                      : 'opacity-40 group-hover:opacity-100'
                                  }`}
                                >
                                  <GripVertical className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}

                              {block.type === 'image' ? (
                                <figure className={`flex-1 ${imageSizeClass}`}>
                                  {block.imageUrl ? (
                                    <div className="group/img relative overflow-hidden rounded-xl border border-hairline bg-surface">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={block.imageUrl}
                                        alt={block.imageCaption || 'Imagen pegada en la nota'}
                                        onClick={() =>
                                          setLightboxImage({
                                            url: block.imageUrl!,
                                            caption: block.imageCaption
                                          })
                                        }
                                        className="max-h-[540px] w-full cursor-zoom-in object-contain"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setLightboxImage({
                                            url: block.imageUrl!,
                                            caption: block.imageCaption
                                          })
                                        }
                                        title="Ampliar imagen"
                                        aria-label="Ampliar imagen"
                                        className="no-print absolute right-2.5 top-2.5 rounded-lg bg-black/60 p-1.5 text-white opacity-0 transition hover:bg-black/80 group-hover/img:opacity-100"
                                      >
                                        <ZoomIn className="h-4 w-4" aria-hidden="true" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openImagePicker(block.id)}
                                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-borderstrong bg-surface py-8 text-xs text-secondary hover:border-terracotta hover:text-terracotta"
                                    >
                                      <ImagePlus className="h-4 w-4" aria-hidden="true" />
                                      <span>Seleccionar o pegar una imagen (Ctrl+V)</span>
                                    </button>
                                  )}

                                  <input
                                    type="text"
                                    readOnly={!canEdit}
                                    value={block.imageCaption ?? ''}
                                    onFocus={() => handleBlockFocus(block.id)}
                                    onChange={(e) =>
                                      updateImageBlock(block.id, {
                                        imageCaption: e.target.value
                                      })
                                    }
                                    placeholder={canEdit ? 'Añadir un pie de foto opcional…' : ''}
                                    aria-label="Pie de foto"
                                    className="editor-seamless mt-2 w-full bg-transparent text-xs text-muted placeholder-muted/70 focus:text-ink"
                                  />
                                </figure>
                              ) : block.type === 'divider' ? (
                                <div className="flex flex-1 items-center py-3">
                                  <hr className="w-full border-t border-borderstrong" />
                                </div>
                              ) : (
                                <>
                                  {block.type === 'bullet' && (
                                    <span
                                      aria-hidden="true"
                                      className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta"
                                    />
                                  )}

                                  {block.type === 'callout' && (
                                    <Lightbulb
                                      aria-hidden="true"
                                      className="mt-1 h-4 w-4 shrink-0 text-ochre"
                                    />
                                  )}

                                  {block.type === 'checklist' && (
                                    <input
                                      type="checkbox"
                                      disabled={!canEdit}
                                      checked={Boolean(block.checked)}
                                      onChange={() => toggleChecklistBlock(block.id)}
                                      aria-label={`Marcar tarea ${index + 1}`}
                                      className="mt-1.5 h-4 w-4 cursor-pointer rounded border-borderstrong accent-[var(--accent)]"
                                    />
                                  )}

                                  <AutoResizeBlockInput
                                    block={block}
                                    index={index}
                                    canEdit={canEdit}
                                    shouldFocus={focusRequestId === block.id}
                                    onFocusedAfterRequest={clearFocusRequest}
                                    onFocus={() => handleBlockFocus(block.id)}
                                    onChange={(val) => updateBlockText(block.id, val)}
                                    onConvertType={(nextType, stripped) =>
                                      updateBlockType(block.id, nextType, stripped)
                                    }
                                    onEnterSplit={() => {
                                      const nextType: BlockType =
                                        block.type === 'bullet' || block.type === 'checklist'
                                          ? block.type
                                          : 'paragraph';
                                      addBlockAfter(block.id, nextType);
                                    }}
                                    onBackspaceEmpty={() => removeBlock(block.id)}
                                    onMoveOffset={(delta) => moveBlockByOffset(block.id, delta)}
                                    onOpenSlash={() => setSlashMenuBlockId(block.id)}
                                    onCloseSlash={() => {
                                      if (slashMenuBlockId === block.id) {
                                        setSlashMenuBlockId(null);
                                      }
                                    }}
                                    onProbeReadOnly={() => void attemptViewerWriteProbe()}
                                  />
                                </>
                              )}
                            </div>

                            {/* Precision Bottom Insertion Drop Bar */}
                            {showBottomDropLine && (
                              <div
                                aria-hidden="true"
                                className="pointer-events-none absolute -bottom-1 left-2 right-2 z-20 flex items-center"
                              >
                                <span className="h-2 w-2 rounded-full bg-terracotta" />
                                <span className="h-0.5 flex-1 bg-terracotta" />
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Bottom Quick Insert Strip */}
                      {canEdit && (
                        <div className="no-print flex flex-wrap items-center gap-2 pt-5">
                          <button
                            type="button"
                            onClick={() => addBlockAfter(null, 'paragraph')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borderstrong px-3 py-1.5 text-xs font-medium text-secondary transition hover:border-terracotta hover:text-terracotta"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Párrafo</span>
                          </button>
                          <button
                            type="button"
                            disabled={isProcessingImage}
                            onClick={() => openImagePicker(null)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borderstrong px-3 py-1.5 text-xs font-medium text-secondary transition hover:border-terracotta hover:text-terracotta disabled:opacity-50"
                          >
                            <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{isProcessingImage ? 'Procesando…' : 'Imagen'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => addBlockAfter(null, 'checklist')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borderstrong px-3 py-1.5 text-xs font-medium text-secondary transition hover:border-terracotta hover:text-terracotta"
                          >
                            <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Tarea</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => addBlockAfter(null, 'callout')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borderstrong px-3 py-1.5 text-xs font-medium text-secondary transition hover:border-terracotta hover:text-terracotta"
                          >
                            <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Destacado</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => addBlockAfter(null, 'code')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borderstrong px-3 py-1.5 text-xs font-medium text-secondary transition hover:border-terracotta hover:text-terracotta"
                          >
                            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Código</span>
                          </button>
                          <span className="ml-auto hidden text-[11px] text-muted sm:inline">
                            Consejo: pega capturas o fotos directamente con Ctrl+V
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              )}
            </main>

            {/* User-Facing Document Details, Outline & Export Drawer */}
            {doc && !isFocusMode && (
              <DocumentDetailsDrawer
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                document={doc}
                activityLog={occTransactions}
                onJumpToBlock={handleJumpToBlock}
                onExportMarkdown={exportMarkdown}
                onCopyPlainText={() => void copyPlainText()}
              />
            )}
          </div>
        </div>

        {/* Lightbox Image Preview Modal */}
        {lightboxImage && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Vista ampliada de la imagen"
            onClick={() => setLightboxImage(null)}
            className="animate-backdrop-in fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              aria-label="Cerrar imagen ampliada"
              className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage.url}
              alt={lightboxImage.caption || 'Imagen ampliada'}
              onClick={(e) => e.stopPropagation()}
              className="animate-modal-in max-h-[82vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
            />
            {lightboxImage.caption && (
              <p className="mt-3 text-sm text-white/85">{lightboxImage.caption}</p>
            )}
          </div>
        )}

        {/* Share Modal */}
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

        {/* Command Palette */}
        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          documents={sidebarDocs}
          activeDocument={doc}
          currentUser={user}
          seedAccounts={seedAccounts}
          onSelectDocument={(id) => void navigateAwaySafely(`/documents/${id}`)}
          onCreateDocument={async () => {
            await finalizeSessionOnLeave();
            await handleCreateNote();
          }}
          onToggleDetails={() => setIsDetailsOpen((prev) => !prev)}
          onExportMarkdown={exportMarkdown}
          onSwitchUser={handleSwitchUser}
        />
      </div>
    </AuthGuard>
  );
}
