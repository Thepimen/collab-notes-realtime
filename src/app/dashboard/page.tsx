'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Lock, Plus, Search, Trash2 } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AppNavbar } from '@/components/layout/AppNavbar';
import { DashboardSkeletonLoader } from '@/components/ui/SkeletonLoaders';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useDocuments, type DocumentFilterScope } from '@/hooks/useDocuments';

export default function DashboardPage() {
  const { user, seedAccounts, switchSandboxUser } = useAuth();
  const { pushToast } = useToast();
  const router = useRouter();
  const {
    documents,
    totalCount,
    isLoading,
    isCreating,
    searchQuery,
    setSearchQuery,
    filterScope,
    setFilterScope,
    createNewDocument,
    deleteExistingDocument
  } = useDocuments(user);

  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);

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

  const handleQuickCreateBlank = async () => {
    const created = await createNewDocument({
      title: 'Untitled Field Note'
    });
    if (created) {
      router.push(`/documents/${created.id}`);
    }
  };

  const handleSwitchUser = (email: string) => {
    const next = switchSandboxUser(email);
    pushToast({
      type: 'info',
      title: 'Sandbox Identity Switched',
      message: `Active tab is now ${next.fullName.replace(/\s*\(.*\)/, '')} (${next.role}).`
    });
  };

  const filterButtons: ReadonlyArray<{
    readonly id: DocumentFilterScope;
    readonly label: string;
  }> = [
    { id: 'all', label: 'All Accessible' },
    { id: 'owned', label: 'Authored' },
    { id: 'shared', label: 'Shared with Me' }
  ];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-canvas text-ink">
        <AppNavbar onOpenPalette={() => setIsPaletteOpen(true)} />

        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          {/* Editorial Workspace Header */}
          <section
            aria-labelledby="dashboard-heading"
            className="flex flex-col justify-between gap-6 border-b border-hairline pb-8 sm:flex-row sm:items-end"
          >
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-terracotta">
                Workspace Index &middot; PostgreSQL RLS Active
              </p>
              <h1 id="dashboard-heading" className="mt-1 font-serif text-4xl text-ink sm:text-5xl">
                Documents &amp; Specifications
              </h1>
              <p className="mt-2 font-mono text-xs tabular-nums text-secondary">
                {documents.length} of {totalCount} records authorized for{' '}
                <span className="text-ink">{user?.email}</span> ({user?.role})
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isCreating}
                onClick={() => void handleQuickCreateBlank()}
                className="inline-flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-terracotta-hover disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{isCreating ? 'Creating…' : 'New Collaborative Note'}</span>
              </button>
            </div>
          </section>

          {/* Search & Filter Strip */}
          <section
            aria-label="Filter documents"
            className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
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
                placeholder="Filter by title, JSONB block content, or tag…"
                aria-label="Search documents"
                className="w-full rounded-lg border border-hairline bg-elevated py-2 pl-9 pr-3.5 text-xs text-ink placeholder-muted focus:border-terracotta focus:outline-none"
              />
            </div>

            <div
              role="tablist"
              aria-label="Document scope"
              className="inline-flex rounded-lg border border-hairline bg-surface p-1"
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
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
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
          </section>

          {/* Editorial Document Cards */}
          <section aria-labelledby="documents-grid-heading" className="mt-7">
            <h2 id="documents-grid-heading" className="sr-only">
              Documents
            </h2>

            {isLoading ? (
              <DashboardSkeletonLoader />
            ) : documents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-borderstrong bg-surface/50 p-12 text-center">
                <p className="font-serif text-2xl text-ink">No matching notes</p>
                <p className="mt-1 text-xs text-secondary">
                  {searchQuery
                    ? `Nothing matched "${searchQuery}" inside accessible JSONB blocks.`
                    : 'Create your first collaborative note to begin.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc) => {
                  const isOwner = doc.ownerId === user?.id;
                  const canDelete = isOwner || user?.role === 'admin';
                  const isReadOnly = doc.effectivePermission === 'viewer';
                  const previewText =
                    doc.content.blocks
                      .map((b) => b.text)
                      .filter(Boolean)
                      .join(' — ') || 'Empty note';

                  return (
                    <article
                      key={doc.id}
                      aria-labelledby={`doc-card-${doc.id}`}
                      className="group flex flex-col justify-between rounded-xl border border-hairline bg-elevated p-5 transition hover:border-borderstrong"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                          <span
                            className={`inline-flex items-center gap-1 uppercase tracking-wider ${
                              isReadOnly ? 'text-ochre' : 'text-secondary'
                            }`}
                          >
                            {isReadOnly && <Lock className="h-3 w-3" aria-hidden="true" />}
                            {doc.effectivePermission}
                          </span>

                          <span className="rounded border border-hairline bg-surface px-1.5 py-0.5 tabular-nums text-sage">
                            v{doc.version}
                          </span>
                        </div>

                        <Link href={`/documents/${doc.id}`} className="mt-3 block">
                          <h3
                            id={`doc-card-${doc.id}`}
                            className="line-clamp-2 font-serif text-2xl leading-snug text-ink transition group-hover:text-terracotta"
                          >
                            {doc.title}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-secondary">
                            {previewText}
                          </p>
                        </Link>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-hairline pt-3 font-mono text-[11px] text-muted">
                        <span className="tabular-nums">
                          {doc.content.blocks.length} blocks &middot;{' '}
                          {doc.collaborators.length + 1} peers
                        </span>

                        <div className="flex items-center gap-2">
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => void deleteExistingDocument(doc.id)}
                              aria-label={`Delete ${doc.title}`}
                              className="rounded p-1 text-muted transition hover:bg-terracotta-soft hover:text-terracotta"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                          <Link
                            href={`/documents/${doc.id}`}
                            className="inline-flex items-center gap-0.5 font-sans text-xs font-semibold text-ink transition group-hover:text-terracotta"
                          >
                            <span>Open</span>
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

        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          documents={documents}
          currentUser={user}
          seedAccounts={seedAccounts}
          onSelectDocument={(id) => router.push(`/documents/${id}`)}
          onCreateDocument={() => void handleQuickCreateBlank()}
          onSwitchUser={handleSwitchUser}
        />
      </div>
    </AuthGuard>
  );
}
