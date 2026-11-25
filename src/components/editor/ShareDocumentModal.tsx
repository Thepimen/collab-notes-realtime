'use client';

import React, { useState } from 'react';
import { Mail, Shield, Trash2, UserPlus, X } from 'lucide-react';
import type {
  CollaboratorDTO,
  CollaboratorPermission,
  ProfileDTO
} from '@/types/domain.types';
import { useAuth } from '@/hooks/useAuth';

interface ShareDocumentModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly documentTitle: string;
  readonly ownerProfile?: ProfileDTO;
  readonly collaborators: readonly CollaboratorDTO[];
  readonly canManageCollaborators: boolean;
  readonly onShare: (email: string, permission: CollaboratorPermission) => Promise<boolean>;
  readonly onRevoke: (userId: string, email: string) => Promise<boolean>;
}

export function ShareDocumentModal({
  isOpen,
  onClose,
  documentTitle,
  ownerProfile,
  collaborators,
  canManageCollaborators,
  onShare,
  onRevoke
}: ShareDocumentModalProps) {
  const { seedAccounts, user } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [permission, setPermission] = useState<CollaboratorPermission>('editor');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    try {
      const ok = await onShare(email.trim(), permission);
      if (ok) setEmail('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickInviteCandidates = seedAccounts.filter(
    (candidate) =>
      candidate.id !== user?.id &&
      candidate.id !== ownerProfile?.id &&
      !collaborators.some((c) => c.userId === candidate.id)
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-document-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-hairline bg-elevated p-6 text-ink shadow-2xl">
        <div className="flex items-start justify-between border-b border-hairline pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              PostgreSQL RLS · Access Matrix
            </p>
            <h2 id="share-document-modal-title" className="mt-0.5 font-serif text-2xl text-ink">
              Collaborators &amp; Permissions
            </h2>
            <p className="mt-0.5 max-w-sm truncate text-xs text-secondary">{documentTitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close share modal"
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {canManageCollaborators ? (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-3">
            <label
              htmlFor="collaborator-email-input"
              className="block font-mono text-[11px] uppercase tracking-wider text-secondary"
            >
              Grant Document Access
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  id="collaborator-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@collabnotes.io"
                  className="w-full rounded-lg border border-hairline bg-canvas py-2 pl-8 pr-3 text-xs text-ink placeholder-muted focus:border-terracotta focus:outline-none"
                />
              </div>

              <select
                aria-label="Select collaborator permission role"
                value={permission}
                onChange={(e) => setPermission(e.target.value as CollaboratorPermission)}
                className="rounded-lg border border-hairline bg-canvas px-3 py-2 text-xs font-medium text-ink focus:border-terracotta focus:outline-none"
              >
                <option value="editor">Editor (Write)</option>
                <option value="viewer">Viewer (Read-Only)</option>
              </select>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-xs font-semibold text-white transition hover:bg-terracotta-hover disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isSubmitting ? 'Saving…' : 'Invite'}</span>
              </button>
            </div>

            {quickInviteCandidates.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="font-mono text-[10px] text-muted">Sandbox accounts:</span>
                {quickInviteCandidates.map((cand) => (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => setEmail(cand.email)}
                    className="rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] text-secondary transition hover:border-borderstrong hover:text-ink"
                  >
                    {cand.email}
                  </button>
                ))}
              </div>
            )}
          </form>
        ) : (
          <div className="mt-4 rounded-lg border border-ochre/30 bg-ochre-soft px-3.5 py-2.5 text-xs text-ochre">
            Only the document owner or platform administrator can mutate collaborator rows (
            <code className="font-mono">collaborators_insert_owner_only</code>).
          </div>
        )}

        <div className="mt-5">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Active Access List ({collaborators.length + 1})
          </h3>

          <ul className="mt-2 max-h-56 divide-y divide-hairline overflow-y-auto rounded-lg border border-hairline bg-canvas">
            {ownerProfile && (
              <li className="flex items-center justify-between px-3.5 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-ink">{ownerProfile.fullName}</p>
                  <p className="font-mono text-[11px] text-secondary">{ownerProfile.email}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] uppercase text-secondary">
                  <Shield className="h-3 w-3 text-terracotta" aria-hidden="true" />
                  Owner
                </span>
              </li>
            )}

            {collaborators.map((collab) => (
              <li
                key={collab.userId}
                className="flex items-center justify-between gap-2 px-3.5 py-2.5"
              >
                <div>
                  <p className="text-xs font-semibold text-ink">{collab.profile.fullName}</p>
                  <p className="font-mono text-[11px] text-secondary">{collab.profile.email}</p>
                </div>

                <div className="flex items-center gap-2">
                  {canManageCollaborators ? (
                    <>
                      <select
                        aria-label={`Change permission for ${collab.profile.email}`}
                        value={collab.permission}
                        onChange={(e) =>
                          void onShare(
                            collab.profile.email,
                            e.target.value as CollaboratorPermission
                          )
                        }
                        className="rounded border border-hairline bg-elevated px-2 py-1 font-mono text-[11px] text-ink"
                      >
                        <option value="editor">editor</option>
                        <option value="viewer">viewer</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => void onRevoke(collab.userId, collab.profile.email)}
                        aria-label={`Revoke access for ${collab.profile.email}`}
                        className="rounded p-1 text-muted transition hover:bg-terracotta-soft hover:text-terracotta"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <span className="rounded border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] uppercase text-secondary">
                      {collab.permission}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
