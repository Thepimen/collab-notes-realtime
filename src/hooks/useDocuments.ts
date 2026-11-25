'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DocumentService } from '@/services/document.service';
import { useToast } from './useToast';
import type { DocumentContentDTO, DocumentDTO, ProfileDTO } from '@/types/domain.types';

export type DocumentFilterScope = 'all' | 'owned' | 'shared';

export function useDocuments(currentUser: ProfileDTO | null) {
  const { pushToast } = useToast();
  const [documents, setDocuments] = useState<readonly DocumentDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterScope, setFilterScope] = useState<DocumentFilterScope>('all');

  const fetchDocuments = useCallback(async () => {
    if (!currentUser) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const list = await DocumentService.listAccessibleDocuments(currentUser);
      // Immutable assignment
      setDocuments([...list]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to fetch documents.';
      pushToast({
        type: 'error',
        title: 'Database Fetch Error',
        message: msg
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, pushToast]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const createNewDocument = useCallback(
    async (params: {
      readonly title: string;
      readonly content?: DocumentContentDTO;
    }): Promise<DocumentDTO | null> => {
      if (!currentUser) return null;
      setIsCreating(true);
      try {
        const created = await DocumentService.createDocument(
          {
            title: params.title,
            content: params.content,
            ownerId: currentUser.id
          },
          currentUser
        );

        // Immutable prepend
        setDocuments((prev) => [{ ...created }, ...prev]);
        pushToast({
          type: 'success',
          title: 'Document Created',
          message: `"${created.title}" initialized at version v${created.version}.`
        });
        return created;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error creating document.';
        pushToast({
          type: 'error',
          title: 'Creation Failed',
          message: msg
        });
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [currentUser, pushToast]
  );

  const deleteExistingDocument = useCallback(
    async (documentId: string): Promise<boolean> => {
      if (!currentUser) return false;
      try {
        await DocumentService.deleteDocument(documentId, currentUser);
        // Immutable removal
        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
        pushToast({
          type: 'info',
          title: 'Document Deleted',
          message: 'The document and its collaborator records were removed via CASCADE.'
        });
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Delete operation rejected by RLS.';
        pushToast({
          type: 'error',
          title: 'RLS Authorization Error',
          message: msg
        });
        return false;
      }
    },
    [currentUser, pushToast]
  );

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return documents.filter((doc) => {
      // 1. Scope filter
      if (filterScope === 'owned' && doc.ownerId !== currentUser?.id) {
        return false;
      }
      if (filterScope === 'shared' && doc.ownerId === currentUser?.id) {
        return false;
      }

      // 2. Real-time search across title, JSONB blocks text, and tags
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
  }, [documents, filterScope, searchQuery, currentUser?.id]);

  return {
    documents: filteredDocuments,
    totalCount: documents.length,
    isLoading,
    isCreating,
    searchQuery,
    setSearchQuery,
    filterScope,
    setFilterScope,
    createNewDocument,
    deleteExistingDocument,
    refreshDocuments: fetchDocuments
  };
}
