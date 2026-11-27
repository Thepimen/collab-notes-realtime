'use client';

import React, { useState } from 'react';
import { Check, Link2, Mail, Shield, Trash2, UserPlus, X } from 'lucide-react';
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
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard fallback
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
      className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-modal-in w-full max-w-lg rounded-2xl border border-hairline bg-elevated p-6 text-ink shadow-2xl">
        <div className="flex items-start justify-between border-b border-hairline pb-4">
          <div>
            <h2 id="share-document-modal-title" className="font-serif text-2xl text-ink">
              Compartir nota
            </h2>
            <p className="mt-0.5 max-w-sm truncate text-xs text-secondary">{documentTitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {canManageCollaborators ? (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-3">
            <label
              htmlFor="collaborator-email-input"
              className="block text-xs font-semibold text-secondary"
            >
              Invitar personas por correo electrónico
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
                  placeholder="nombre@ejemplo.com"
                  className="w-full rounded-lg border border-hairline bg-canvas py-2 pl-8 pr-3 text-xs text-ink placeholder-muted focus:border-terracotta focus:outline-none"
                />
              </div>

              <select
                aria-label="Seleccionar permiso"
                value={permission}
                onChange={(e) => setPermission(e.target.value as CollaboratorPermission)}
                className="rounded-lg border border-hairline bg-canvas px-3 py-2 text-xs font-medium text-ink focus:border-terracotta focus:outline-none"
              >
                <option value="editor">Puede editar</option>
                <option value="viewer">Solo lectura</option>
              </select>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-xs font-semibold text-white transition hover:bg-terracotta-hover disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isSubmitting ? 'Añadiendo…' : 'Invitar'}</span>
              </button>
            </div>

            {quickInviteCandidates.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-muted">Sugerencias:</span>
                {quickInviteCandidates.map((cand) => (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => setEmail(cand.email)}
                    className="rounded-md border border-hairline bg-surface px-2 py-0.5 text-[11px] text-secondary transition hover:border-borderstrong hover:text-ink"
                  >
                    {cand.email}
                  </button>
                ))}
              </div>
            )}
          </form>
        ) : (
          <div className="mt-4 rounded-lg border border-ochre/30 bg-ochre-soft px-3.5 py-2.5 text-xs text-ochre">
            Solo el propietario de esta nota puede invitar o cambiar permisos de colaboradores.
          </div>
        )}

        <div className="mt-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Personas con acceso ({collaborators.length + 1})
          </h3>

          <ul className="mt-2 max-h-56 divide-y divide-hairline overflow-y-auto rounded-xl border border-hairline bg-canvas">
            {ownerProfile && (
              <li className="flex items-center justify-between px-3.5 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-ink">
                    {ownerProfile.fullName.replace(/\s*\(.*\)/, '')}
                  </p>
                  <p className="text-[11px] text-secondary">{ownerProfile.email}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-0.5 text-[11px] font-medium text-secondary">
                  <Shield className="h-3 w-3 text-terracotta" aria-hidden="true" />
                  Propietario
                </span>
              </li>
            )}

            {collaborators.map((collab) => (
              <li
                key={collab.userId}
                className="flex items-center justify-between gap-2 px-3.5 py-2.5"
              >
                <div>
                  <p className="text-xs font-semibold text-ink">
                    {collab.profile.fullName.replace(/\s*\(.*\)/, '')}
                  </p>
                  <p className="text-[11px] text-secondary">{collab.profile.email}</p>
                </div>

                <div className="flex items-center gap-2">
                  {canManageCollaborators ? (
                    <>
                      <select
                        aria-label={`Cambiar permiso para ${collab.profile.email}`}
                        value={collab.permission}
                        onChange={(e) =>
                          void onShare(
                            collab.profile.email,
                            e.target.value as CollaboratorPermission
                          )
                        }
                        className="rounded-md border border-hairline bg-elevated px-2 py-1 text-xs text-ink"
                      >
                        <option value="editor">Puede editar</option>
                        <option value="viewer">Solo lectura</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => void onRevoke(collab.userId, collab.profile.email)}
                        aria-label={`Retirar acceso a ${collab.profile.email}`}
                        className="rounded p-1 text-muted transition hover:bg-terracotta-soft hover:text-terracotta"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <span className="rounded-md border border-hairline bg-surface px-2 py-0.5 text-[11px] text-secondary">
                      {collab.permission === 'editor' ? 'Puede editar' : 'Solo lectura'}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-borderstrong"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-sage" aria-hidden="true" />
                <span className="text-sage">Enlace copiado</span>
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                <span>Copiar enlace</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-ink px-4 py-1.5 text-xs font-semibold text-canvas transition hover:opacity-90"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
