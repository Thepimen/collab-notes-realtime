'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocumentService } from '@/services/document.service';
import { useToast } from './useToast';
import type { DocumentContentDTO, DocumentDTO, ProfileDTO } from '@/types/domain.types';

export type DocumentFilterScope = 'all' | 'owned' | 'shared' | 'pinned';
export type DocumentSortOrder = 'updated' | 'title';

export function useDocuments(currentUser: ProfileDTO | null) {
  const { pushToast } = useToast();
  const [documents, setDocuments] = useState<readonly DocumentDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterScope, setFilterScope] = useState<DocumentFilterScope>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<DocumentSortOrder>('updated');

  const currentUserRef = useRef<ProfileDTO | null>(currentUser);
  currentUserRef.current = currentUser;
  const loadedUserIdRef = useRef<string | null>(null);

  const userId = currentUser?.id ?? null;

  const fetchDocuments = useCallback(
    async (options?: { readonly silent?: boolean }) => {
      const actor = currentUserRef.current;
      if (!actor) {
        setDocuments([]);
        setIsLoading(false);
        loadedUserIdRef.current = null;
        return;
      }

      const shouldShowSkeleton =
        !options?.silent && loadedUserIdRef.current !== actor.id;
      if (shouldShowSkeleton) {
        setIsLoading(true);
      }

      try {
        const list = await DocumentService.listAccessibleDocuments(actor);
        setDocuments([...list]);
        loadedUserIdRef.current = actor.id;
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : 'No se pudieron cargar las notas.';
        pushToast({
          type: 'error',
          title: 'Error de carga',
          message: msg
        });
      } finally {
        setIsLoading(false);
      }
    },
    [pushToast]
  );

  // Only trigger fetch when the authenticated user ID actually changes (eliminates flicker)
  useEffect(() => {
    void fetchDocuments();
  }, [userId, fetchDocuments]);

  const createNewDocument = useCallback(
    async (params: {
      readonly title: string;
      readonly content?: DocumentContentDTO;
    }): Promise<DocumentDTO | null> => {
      const actor = currentUserRef.current;
      if (!actor) return null;
      setIsCreating(true);
      try {
        const created = await DocumentService.createDocument(
          {
            title: params.title,
            content: params.content,
            ownerId: actor.id
          },
          actor
        );

        setDocuments((prev) => [{ ...created }, ...prev]);
        pushToast({
          type: 'success',
          title: 'Nota creada',
          message: `"${created.title}" está lista para editar.`
        });
        return created;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'No se pudo crear la nota.';
        pushToast({
          type: 'error',
          title: 'No se pudo crear',
          message: msg
        });
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [pushToast]
  );

  const deleteExistingDocument = useCallback(
    async (documentId: string): Promise<boolean> => {
      const actor = currentUserRef.current;
      if (!actor) return false;
      try {
        await DocumentService.deleteDocument(documentId, actor);
        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
        pushToast({
          type: 'info',
          title: 'Nota eliminada',
          message: 'La nota se ha eliminado permanentemente.'
        });
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'No se pudo eliminar la nota.';
        pushToast({
          type: 'error',
          title: 'Sin permisos',
          message: msg
        });
        return false;
      }
    },
    [pushToast]
  );

  const togglePinDocument = useCallback(
    async (targetDoc: DocumentDTO): Promise<void> => {
      const actor = currentUserRef.current;
      if (!actor || targetDoc.effectivePermission === 'viewer') return;

      const nextPinned = !Boolean(targetDoc.content.metadata?.pinned);
      const nextContent: DocumentContentDTO = {
        ...targetDoc.content,
        metadata: {
          ...targetDoc.content.metadata,
          pinned: nextPinned
        }
      };

      // Optimistic immutable UI update
      setDocuments((prev) =>
        prev.map((d) => (d.id === targetDoc.id ? { ...d, content: nextContent } : d))
      );

      try {
        const res = await DocumentService.updateDocumentWithOCC(
          {
            documentId: targetDoc.id,
            title: targetDoc.title,
            content: nextContent,
            expectedVersion: targetDoc.version,
            baseTitle: targetDoc.title,
            baseContent: targetDoc.content,
            actorEmail: actor.email,
            currentSnapshot: targetDoc
          },
          actor
        );
        setDocuments((prev) =>
          prev.map((d) => (d.id === targetDoc.id ? { ...res.document } : d))
        );
      } catch (error) {
        // Rollback on failure
        setDocuments((prev) =>
          prev.map((d) => (d.id === targetDoc.id ? targetDoc : d))
        );
        const msg =
          error instanceof Error ? error.message : 'No se pudo actualizar favoritos.';
        pushToast({
          type: 'error',
          title: 'Error al actualizar',
          message: msg
        });
      }
    },
    [pushToast]
  );

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    documents.forEach((doc) => {
      (doc.content.metadata?.tags ?? []).forEach((t) => {
        if (t.trim()) tagSet.add(t.trim());
      });
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const matched = documents.filter((doc) => {
      if (filterScope === 'owned' && doc.ownerId !== userId) return false;
      if (filterScope === 'shared' && doc.ownerId === userId) return false;
      if (filterScope === 'pinned' && !doc.content.metadata?.pinned) return false;

      if (selectedTag) {
        const hasTag = (doc.content.metadata?.tags ?? []).some(
          (t) => t.toLowerCase() === selectedTag.toLowerCase()
        );
        if (!hasTag) return false;
      }

      if (!query) return true;

      const titleMatch = doc.title.toLowerCase().includes(query);
      const blocksMatch = doc.content.blocks.some((b) =>
        b.text.toLowerCase().includes(query)
      );
      const tagMatch = (doc.content.metadata?.tags ?? []).some((t) =>
        t.toLowerCase().includes(query)
      );

      return titleMatch || blocksMatch || tagMatch;
    });

    return [...matched].sort((a, b) => {
      // Pinned notes always surface first
      const aPinned = a.content.metadata?.pinned ? 1 : 0;
      const bPinned = b.content.metadata?.pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      if (sortOrder === 'title') {
        return a.title.localeCompare(b.title);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [documents, filterScope, searchQuery, selectedTag, sortOrder, userId]);

  return {
    documents: filteredDocuments,
    allDocuments: documents,
    allTags,
    totalCount: documents.length,
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
    togglePinDocument,
    refreshDocuments: () => fetchDocuments({ silent: true })
  };
}
