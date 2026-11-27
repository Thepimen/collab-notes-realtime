'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  CheckSquare,
  ChevronDown,
  Clock,
  FilePlus2,
  LayoutTemplate,
  Lock,
  Plus,
  Search,
  Star,
  Trash2,
  Users
} from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { DashboardSkeletonLoader } from '@/components/ui/SkeletonLoaders';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  useDocuments,
  type DocumentFilterScope,
  type DocumentSortOrder
} from '@/hooks/useDocuments';
import { NOTE_TEMPLATES, type NoteTemplate } from '@/services/templates';
import type { DocumentDTO } from '@/types/domain.types';

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function DashboardPage() {
  const { user, seedAccounts, switchSandboxUser } = useAuth();
  const { pushToast } = useToast();
  const router = useRouter();
  const {
    documents,
    allDocuments,
    allTags,
    totalCount,
    isLoading,
    isCreating,
    searchQuery,
    setSearchQuery,
    filterScope,
    setFilterScope,
    selectedTag,
    setSelectedTag,
    sortOrder,
    setSortOrder,
    createNewDocument,
    deleteExistingDocument,
    togglePinDocument
  } = useDocuments(user);

  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState<boolean>(false);
  const [docPendingDelete, setDocPendingDelete] = useState<DocumentDTO | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const blankTemplate = NOTE_TEMPLATES[0]!;
  const structuredTemplates = NOTE_TEMPLATES.filter((t) => t.id !== 'blank');

  const handleCreateFromScratch = async () => {
    if (!user) return;
    const created = await createNewDocument({
      title: blankTemplate.defaultTitle,
      content: blankTemplate.buildContent(user.email)
    });
    if (created) {
      router.push(`/documents/${created.id}`);
    }
  };

  const handleCreateFromTemplate = async (template: NoteTemplate) => {
    if (!user) return;
    setIsTemplatesOpen(false);
    const created = await createNewDocument({
      title: template.defaultTitle,
      content: template.buildContent(user.email)
    });
    if (created) {
      router.push(`/documents/${created.id}`);
    }
  };

  const handleSwitchUser = (email: string) => {
    const next = switchSandboxUser(email);
    pushToast({
      type: 'info',
      title: 'Perfil cambiado',
      message: `Ahora navegas como ${next.fullName.replace(/\s*\(.*\)/, '')}.`
    });
  };

  const confirmDelete = async () => {
    if (!docPendingDelete) return;
    const targetId = docPendingDelete.id;
    setDocPendingDelete(null);
    await deleteExistingDocument(targetId);
  };

  const filterButtons: ReadonlyArray<{
    readonly id: DocumentFilterScope;
    readonly label: string;
  }> = [
    { id: 'all', label: 'Todas' },
    { id: 'pinned', label: 'Favoritas' },
    { id: 'owned', label: 'Mis notas' },
    { id: 'shared', label: 'Compartidas' }
  ];

  const firstName = user?.fullName.replace(/\s*\(.*\)/, '').split(' ')[0] ?? '';

  return (
    <AuthGuard>
      <div className="min-h-screen bg-canvas text-ink">
        <AppNavbar onOpenPalette={() => setIsPaletteOpen(true)} />

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {/* Editorial Greeting Header + Direct Create CTA + Smooth Templates Dropdown Trigger */}
          <section
            aria-labelledby="dashboard-heading"
            className="animate-reveal-up flex flex-col justify-between gap-5 border-b border-hairline pb-7 sm:flex-row sm:items-end"
          >
            <div>
              <p className="text-xs font-semibold text-terracotta">
                {getTimeGreeting()}
                {firstName ? `, ${firstName}` : ''}
              </p>
              <h1
                id="dashboard-heading"
                className="mt-1 font-serif text-4xl text-ink sm:text-5xl"
              >
                Tu espacio de notas
              </h1>
              <p className="mt-1.5 text-xs text-secondary">
                {totalCount === 0
                  ? 'Empieza una nota desde cero o despliega las plantillas.'
                  : `${documents.length} de ${totalCount} ${totalCount === 1 ? 'nota disponible' : 'notas disponibles'}`}
              </p>
            </div>

            {/* Clean Action Pair: Collapsible Templates Toggle + Direct Blank Note Button */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                aria-expanded={isTemplatesOpen}
                aria-controls="templates-dropdown-panel"
                onClick={() => setIsTemplatesOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition active:scale-[0.98] ${
                  isTemplatesOpen
                    ? 'border-terracotta/50 bg-terracotta-soft text-terracotta'
                    : 'border-hairline bg-elevated text-secondary hover:border-borderstrong hover:text-ink'
                }`}
              >
                <LayoutTemplate className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Plantillas</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-300 ${
                    isTemplatesOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                disabled={isCreating}
                onClick={() => void handleCreateFromScratch()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-terracotta/20 transition hover:bg-terracotta-hover active:scale-[0.98] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{isCreating ? 'Creando…' : 'Empezar nota desde 0'}</span>
              </button>
            </div>
          </section>

          {/* Smooth Collapsible Templates Drawer (CLOSED by default) */}
          <div
            id="templates-dropdown-panel"
            data-open={isTemplatesOpen ? 'true' : 'false'}
            className="smooth-collapse"
          >
            <div className="smooth-collapse-inner">
              <div className="mt-5 rounded-2xl border border-hairline bg-surface/75 p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xs font-bold text-ink">
                      Elige una plantilla prediseñada
                    </h2>
                    <p className="text-[11px] text-secondary">
                      O si prefieres un lienzo limpio, empieza una nota desde cero.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={() => void handleCreateFromScratch()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-elevated px-3 py-1.5 text-[11px] font-semibold text-terracotta ring-1 ring-hairline transition hover:bg-terracotta hover:text-white"
                  >
                    <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Crear nota en blanco</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {structuredTemplates.map((tpl, idx) => (
                    <button
                      key={tpl.id}
                      type="button"
                      disabled={isCreating}
                      style={{
                        transitionDelay: isTemplatesOpen ? `${idx * 45}ms` : '0ms'
                      }}
                      onClick={() => void handleCreateFromTemplate(tpl)}
                      className="group flex items-start gap-3 rounded-xl border border-hairline bg-elevated p-3.5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-terracotta/50 hover:shadow-sm active:scale-[0.99] disabled:opacity-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-lg transition group-hover:scale-110">
                        {tpl.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink transition group-hover:text-terracotta">
                          {tpl.name}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-secondary">
                          {tpl.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Search, Scope Tabs & Sort Bar */}
          <section
            aria-label="Buscar y filtrar notas"
            style={{ animationDelay: '70ms' }}
            className="animate-reveal-up mt-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
          >
            <div className="relative max-w-md flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título, contenido o etiqueta…"
                aria-label="Buscar notas"
                className="w-full rounded-xl border border-hairline bg-elevated py-2 pl-9 pr-3.5 text-xs text-ink placeholder-muted transition focus:border-terracotta focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="tablist"
                aria-label="Filtrar notas"
                className="inline-flex rounded-xl border border-hairline bg-surface p-1"
              >
                {filterButtons.map((tab) => {
                  const active = filterScope === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilterScope(tab.id)}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                        active
                          ? 'bg-elevated text-ink shadow-sm ring-1 ring-hairline'
                          : 'text-secondary hover:text-ink'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <select
                aria-label="Ordenar notas"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as DocumentSortOrder)}
                className="rounded-xl border border-hairline bg-elevated px-3 py-1.5 text-xs font-medium text-secondary focus:border-terracotta focus:outline-none"
              >
                <option value="updated">Más recientes</option>
                <option value="title">Alfabético (A–Z)</option>
              </select>
            </div>
          </section>

          {/* Clickable Tag Filter Pills */}
          {allTags.length > 0 && (
            <div
              style={{ animationDelay: '110ms' }}
              className="animate-reveal-up mt-3 flex flex-wrap items-center gap-1.5"
            >
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                  selectedTag === null
                    ? 'bg-ink text-canvas'
                    : 'border border-hairline bg-surface text-secondary hover:text-ink'
                }`}
              >
                Todas las etiquetas
              </button>
              {allTags.map((tag) => {
                const active = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(active ? null : tag)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                      active
                        ? 'bg-terracotta text-white'
                        : 'border border-hairline bg-surface text-secondary hover:border-borderstrong hover:text-ink'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}

          {/* Notes Grid */}
          <section aria-labelledby="documents-grid-heading" className="mt-6">
            <h2 id="documents-grid-heading" className="sr-only">
              Listado de notas
            </h2>

            {isLoading ? (
              <DashboardSkeletonLoader />
            ) : documents.length === 0 ? (
              <div className="animate-reveal-scale rounded-2xl border border-dashed border-borderstrong bg-surface/50 p-12 text-center">
                <p className="font-serif text-2xl text-ink">No hay notas que coincidan</p>
                <p className="mt-1.5 text-xs text-secondary">
                  {searchQuery || selectedTag
                    ? 'Prueba a limpiar los filtros o buscar con otra palabra.'
                    : 'Empieza creando tu primera nota desde cero.'}
                </p>
                {searchQuery || selectedTag || filterScope !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedTag(null);
                      setFilterScope('all');
                    }}
                    className="mt-4 rounded-lg border border-hairline bg-elevated px-3.5 py-1.5 text-xs font-medium text-ink hover:border-borderstrong"
                  >
                    Mostrar todas las notas
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={() => void handleCreateFromScratch()}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-terracotta px-4 py-2 text-xs font-semibold text-white transition hover:bg-terracotta-hover"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Empezar nota desde 0</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc, cardIdx) => {
                  const isOwner = doc.ownerId === user?.id;
                  const canDelete = isOwner || user?.role === 'admin';
                  const isReadOnly = doc.effectivePermission === 'viewer';
                  const isPinned = Boolean(doc.content.metadata?.pinned);
                  const docIcon = doc.content.metadata?.icon ?? '📝';
                  const tags = doc.content.metadata?.tags ?? [];

                  const checklists = doc.content.blocks.filter((b) => b.type === 'checklist');
                  const doneCount = checklists.filter((b) => b.checked).length;
                  const imageCount = doc.content.blocks.filter(
                    (b) => b.type === 'image' && Boolean(b.imageUrl)
                  ).length;

                  const previewText =
                    doc.content.blocks
                      .filter((b) => b.type !== 'image' && b.type !== 'divider')
                      .map((b) => b.text)
                      .filter(Boolean)
                      .join(' · ') ||
                    (imageCount > 0
                      ? `${imageCount} ${imageCount === 1 ? 'imagen adjunta' : 'imágenes adjuntas'}`
                      : 'Nota vacía — haz clic para empezar a escribir');

                  const roleText = isOwner
                    ? 'Tuya'
                    : isReadOnly
                      ? 'Solo lectura'
                      : 'Compartida';

                  return (
                    <article
                      key={doc.id}
                      style={{ animationDelay: `${Math.min(cardIdx * 45, 280)}ms` }}
                      aria-labelledby={`doc-card-${doc.id}`}
                      className="animate-reveal-up group flex flex-col justify-between rounded-2xl border border-hairline bg-elevated p-5 transition duration-300 hover:-translate-y-1 hover:border-terracotta/40 hover:shadow-lg"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg leading-none" aria-hidden="true">
                              {docIcon}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                isReadOnly
                                  ? 'bg-ochre-soft text-ochre'
                                  : isOwner
                                    ? 'bg-surface text-secondary'
                                    : 'bg-sage-soft text-sage'
                              }`}
                            >
                              {isReadOnly && <Lock className="h-2.5 w-2.5" aria-hidden="true" />}
                              {roleText}
                            </span>
                          </div>

                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => void togglePinDocument(doc)}
                              aria-label={isPinned ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                              title={isPinned ? 'Quitar de favoritos' : 'Fijar nota'}
                              className={`rounded-md p-1 transition hover:bg-surface ${
                                isPinned
                                  ? 'text-ochre'
                                  : 'text-muted opacity-0 group-hover:opacity-100 hover:text-ink'
                              }`}
                            >
                              <Star
                                className={`h-3.5 w-3.5 ${isPinned ? 'fill-current' : ''}`}
                                aria-hidden="true"
                              />
                            </button>
                          )}
                        </div>

                        <Link href={`/documents/${doc.id}`} className="mt-3 block">
                          <h3
                            id={`doc-card-${doc.id}`}
                            className="line-clamp-2 font-serif text-2xl leading-snug text-ink transition group-hover:text-terracotta"
                          >
                            {doc.title || 'Nota sin título'}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-secondary">
                            {previewText}
                          </p>
                        </Link>

                        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                          {checklists.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2 py-0.5 text-[10px] font-medium text-sage">
                              <CheckSquare className="h-3 w-3" aria-hidden="true" />
                              {doneCount}/{checklists.length} tareas
                            </span>
                          )}
                          {tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-secondary"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-hairline pt-3 text-[11px] text-muted">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {formatRelativeDate(doc.updatedAt)}
                          </span>
                          {doc.collaborators.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" aria-hidden="true" />
                              {doc.collaborators.length + 1}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDocPendingDelete(doc)}
                              aria-label={`Eliminar ${doc.title}`}
                              className="rounded-md p-1 text-muted transition hover:bg-terracotta-soft hover:text-terracotta"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                          <Link
                            href={`/documents/${doc.id}`}
                            className="inline-flex items-center gap-0.5 text-xs font-semibold text-ink transition group-hover:text-terracotta"
                          >
                            <span>Abrir</span>
                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        {/* Safe Delete Confirmation Modal with Smooth Entrance */}
        {docPendingDelete && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDocPendingDelete(null);
            }}
          >
            <div className="animate-modal-in w-full max-w-sm rounded-2xl border border-hairline bg-elevated p-6 shadow-2xl">
              <h2 id="delete-confirm-title" className="font-serif text-2xl text-ink">
                ¿Eliminar esta nota?
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-secondary">
                Vas a eliminar <strong>&ldquo;{docPendingDelete.title}&rdquo;</strong> de forma
                permanente. Esta acción no se puede deshacer.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDocPendingDelete(null)}
                  className="rounded-lg border border-hairline bg-surface px-3.5 py-2 text-xs font-medium text-ink hover:border-borderstrong"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  className="rounded-lg bg-terracotta px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-terracotta-hover active:scale-[0.98]"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          documents={allDocuments}
          currentUser={user}
          seedAccounts={seedAccounts}
          onSelectDocument={(id) => router.push(`/documents/${id}`)}
          onCreateDocument={() => void handleCreateFromScratch()}
          onSwitchUser={handleSwitchUser}
        />
      </div>
    </AuthGuard>
  );
}
