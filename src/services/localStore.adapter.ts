import type {
  AppRole,
  CollaboratorDTO,
  CollaboratorPermission,
  DocumentContentDTO,
  DocumentDTO,
  ProfileDTO
} from '@/types/domain.types';

const STORAGE_KEYS = {
  PROFILES: 'collabnotes.db.profiles.v1',
  DOCUMENTS: 'collabnotes.db.documents.v1',
  COLLABORATORS: 'collabnotes.db.collaborators.v1',
  SESSION: 'collabnotes.auth.session.v1',
  TAB_SESSION: 'collabnotes.auth.tab_session.v1'
} as const;

export interface RawStoredDocument {
  readonly id: string;
  readonly title: string;
  readonly content: DocumentContentDTO;
  readonly ownerId: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RawStoredCollaborator {
  readonly documentId: string;
  readonly userId: string;
  readonly permission: CollaboratorPermission;
  readonly createdAt: string;
}

export const SEED_PROFILES: readonly ProfileDTO[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@collabnotes.io',
    fullName: 'Luis Lázaro (Architect Admin)',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=LL',
    role: 'admin',
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-22T18:00:00.000Z'
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'elena.editor@collabnotes.io',
    fullName: 'Elena Rostova (Lead Editor)',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=ER',
    role: 'editor',
    createdAt: '2026-11-19T10:05:00.000Z',
    updatedAt: '2026-11-22T18:10:00.000Z'
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'marco.viewer@collabnotes.io',
    fullName: 'Marco Silva (QA Auditor)',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=MS',
    role: 'viewer',
    createdAt: '2026-11-19T10:10:00.000Z',
    updatedAt: '2026-11-22T18:20:00.000Z'
  }
];

export const SEED_DOCUMENTS: readonly RawStoredDocument[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    title: 'System Architecture RFC: Real-Time OCC & Hybrid JSONB',
    content: {
      blocks: [
        {
          id: 'blk-101',
          type: 'heading-1',
          text: 'Distributed Real-Time Collaborative Engine',
          updatedBy: 'admin@collabnotes.io',
          updatedAt: '2026-11-22T18:00:00.000Z'
        },
        {
          id: 'blk-102',
          type: 'paragraph',
          text: 'This document defines the hybrid relational + JSONB persistence strategy combined with Optimistic Concurrency Control (OCC) over Supabase Realtime WebSockets (Elixir/Phoenix).',
          updatedBy: 'admin@collabnotes.io',
          updatedAt: '2026-11-22T18:05:00.000Z'
        },
        {
          id: 'blk-103',
          type: 'heading-2',
          text: 'Key Engineering Guarantees',
          updatedBy: 'elena.editor@collabnotes.io',
          updatedAt: '2026-11-22T18:10:00.000Z'
        },
        {
          id: 'blk-104',
          type: 'checklist',
          text: 'Row Level Security (RLS) enforced at PostgreSQL engine level for owners, editors, and viewers.',
          checked: true,
          updatedBy: 'admin@collabnotes.io',
          updatedAt: '2026-11-22T18:12:00.000Z'
        },
        {
          id: 'blk-105',
          type: 'checklist',
          text: 'Compare-And-Swap (CAS) version checking on every debounced UPDATE to prevent Lost Updates.',
          checked: true,
          updatedBy: 'elena.editor@collabnotes.io',
          updatedAt: '2026-11-22T18:15:00.000Z'
        },
        {
          id: 'blk-106',
          type: 'code',
          text: 'UPDATE public.documents SET content = $1, version = version + 1 WHERE id = $2 AND version = $3;',
          updatedBy: 'admin@collabnotes.io',
          updatedAt: '2026-11-22T18:20:00.000Z'
        }
      ],
      metadata: {
        tags: ['Architecture', 'PostgreSQL', 'WebSockets', 'OCC'],
        lastEditedBy: 'elena.editor@collabnotes.io'
      }
    },
    ownerId: '11111111-1111-4111-8111-111111111111',
    version: 4,
    createdAt: '2026-11-19T12:00:00.000Z',
    updatedAt: '2026-11-22T20:15:00.000Z'
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    title: 'Q4 Security Audit & RLS Verification Playbook',
    content: {
      blocks: [
        {
          id: 'blk-201',
          type: 'heading-1',
          text: 'PostgreSQL 15+ Security & Access Control Audit',
          updatedBy: 'admin@collabnotes.io',
          updatedAt: '2026-11-22T16:00:00.000Z'
        },
        {
          id: 'blk-202',
          type: 'quote',
          text: 'Never delegate data authorization exclusively to the frontend UI; enforce perimeter policies via PostgreSQL Row Level Security.',
          updatedBy: 'admin@collabnotes.io',
          updatedAt: '2026-11-22T16:10:00.000Z'
        },
        {
          id: 'blk-203',
          type: 'paragraph',
          text: 'Collaborators with the viewer role can observe real-time presence and live block updates via room:doc_{id}, but any direct mutation attempt is rejected both by the UI and by the documents_update_owner_or_editor RLS policy.',
          updatedBy: 'marco.viewer@collabnotes.io',
          updatedAt: '2026-11-22T16:30:00.000Z'
        }
      ],
      metadata: {
        tags: ['Security', 'RLS', 'Audit'],
        lastEditedBy: 'admin@collabnotes.io'
      }
    },
    ownerId: '11111111-1111-4111-8111-111111111111',
    version: 2,
    createdAt: '2026-11-20T14:30:00.000Z',
    updatedAt: '2026-11-22T18:30:00.000Z'
  },
  {
    id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    title: 'Product Design Sprint: Accessible UI & Mobile-First Tokens',
    content: {
      blocks: [
        {
          id: 'blk-301',
          type: 'heading-1',
          text: 'UI/UX Guidelines & WCAG 2.1 AA Compliance',
          updatedBy: 'elena.editor@collabnotes.io',
          updatedAt: '2026-11-22T19:00:00.000Z'
        },
        {
          id: 'blk-302',
          type: 'paragraph',
          text: 'All interactive regions expose semantic ARIA roles, aria-labelledby bindings, live toast announcements, skeleton loaders, and pending changes navigation guards.',
          updatedBy: 'elena.editor@collabnotes.io',
          updatedAt: '2026-11-22T19:15:00.000Z'
        },
        {
          id: 'blk-303',
          type: 'checklist',
          text: 'Preserve returnUrl query parameter when redirecting unauthenticated sessions.',
          checked: true,
          updatedBy: 'elena.editor@collabnotes.io',
          updatedAt: '2026-11-22T19:20:00.000Z'
        }
      ],
      metadata: {
        tags: ['UI/UX', 'Accessibility', 'TailwindCSS'],
        lastEditedBy: 'elena.editor@collabnotes.io'
      }
    },
    ownerId: '22222222-2222-4222-8222-222222222222',
    version: 3,
    createdAt: '2026-11-21T09:00:00.000Z',
    updatedAt: '2026-11-22T19:45:00.000Z'
  }
];

export const SEED_COLLABORATORS: readonly RawStoredCollaborator[] = [
  {
    documentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    userId: '22222222-2222-4222-8222-222222222222',
    permission: 'editor',
    createdAt: '2026-11-20T10:00:00.000Z'
  },
  {
    documentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    userId: '33333333-3333-4333-8333-333333333333',
    permission: 'viewer',
    createdAt: '2026-11-20T10:05:00.000Z'
  },
  {
    documentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    userId: '33333333-3333-4333-8333-333333333333',
    permission: 'viewer',
    createdAt: '2026-11-20T15:00:00.000Z'
  },
  {
    documentId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    userId: '11111111-1111-4111-8111-111111111111',
    permission: 'editor',
    createdAt: '2026-11-21T11:00:00.000Z'
  },
  {
    documentId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    userId: '33333333-3333-4333-8333-333333333333',
    permission: 'viewer',
    createdAt: '2026-11-21T11:10:00.000Z'
  }
];

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getTabSessionKey(): string {
  if (typeof window === 'undefined') return STORAGE_KEYS.TAB_SESSION;
  const scope = window.name ? `:${window.name}` : '';
  return `${STORAGE_KEYS.TAB_SESSION}${scope}`;
}

export class LocalDatabaseAdapter {
  private static ensureInitialized(): void {
    if (!isBrowser()) return;

    if (!window.localStorage.getItem(STORAGE_KEYS.PROFILES)) {
      window.localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(SEED_PROFILES));
    }
    if (!window.localStorage.getItem(STORAGE_KEYS.DOCUMENTS)) {
      window.localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(SEED_DOCUMENTS));
    }
    if (!window.localStorage.getItem(STORAGE_KEYS.COLLABORATORS)) {
      window.localStorage.setItem(
        STORAGE_KEYS.COLLABORATORS,
        JSON.stringify(SEED_COLLABORATORS)
      );
    }
  }

  public static getProfiles(): readonly ProfileDTO[] {
    if (!isBrowser()) return SEED_PROFILES;
    this.ensureInitialized();
    const raw = window.localStorage.getItem(STORAGE_KEYS.PROFILES);
    return raw ? (JSON.parse(raw) as ProfileDTO[]) : SEED_PROFILES;
  }

  public static saveProfiles(profiles: readonly ProfileDTO[]): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  }

  public static getRawDocuments(): readonly RawStoredDocument[] {
    if (!isBrowser()) return SEED_DOCUMENTS;
    this.ensureInitialized();
    const raw = window.localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
    return raw ? (JSON.parse(raw) as RawStoredDocument[]) : SEED_DOCUMENTS;
  }

  public static saveRawDocuments(docs: readonly RawStoredDocument[]): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
  }

  public static getRawCollaborators(): readonly RawStoredCollaborator[] {
    if (!isBrowser()) return SEED_COLLABORATORS;
    this.ensureInitialized();
    const raw = window.localStorage.getItem(STORAGE_KEYS.COLLABORATORS);
    return raw ? (JSON.parse(raw) as RawStoredCollaborator[]) : SEED_COLLABORATORS;
  }

  public static saveRawCollaborators(collabs: readonly RawStoredCollaborator[]): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(STORAGE_KEYS.COLLABORATORS, JSON.stringify(collabs));
  }

  public static resolveSeedAlias(alias: string | null): ProfileDTO | null {
    if (!alias) return null;
    const key = alias.trim().toLowerCase();
    const profiles = this.getProfiles();
    if (key === 'admin' || key === 'luis') {
      return profiles.find((p) => p.role === 'admin') ?? SEED_PROFILES[0] ?? null;
    }
    if (key === 'editor' || key === 'elena') {
      return profiles.find((p) => p.email.startsWith('elena.')) ?? SEED_PROFILES[1] ?? null;
    }
    if (key === 'viewer' || key === 'marco') {
      return profiles.find((p) => p.role === 'viewer') ?? SEED_PROFILES[2] ?? null;
    }
    return profiles.find((p) => p.email.toLowerCase() === key) ?? null;
  }

  public static getPersistedSession(): ProfileDTO | null {
    if (!isBrowser()) return null;
    this.ensureInitialized();

    // 1. Check URL ?as=admin|editor|viewer override for instant isolated multi-window demos
    const tabKey = getTabSessionKey();
    try {
      const sp = new URLSearchParams(window.location.search);
      const asParam = sp.get('as');
      if (asParam) {
        const matched = this.resolveSeedAlias(asParam);
        if (matched) {
          window.sessionStorage.setItem(tabKey, JSON.stringify(matched));
          return matched;
        }
      }
    } catch {
      // Ignore URL parsing errors
    }

    // 2. Check tab-isolated sessionStorage first so two open windows never clobber each other
    const tabRaw = window.sessionStorage.getItem(tabKey);
    if (tabRaw) {
      try {
        return JSON.parse(tabRaw) as ProfileDTO;
      } catch {
        window.sessionStorage.removeItem(tabKey);
      }
    }

    // 3. Fallback to shared localStorage session
    const raw = window.localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as ProfileDTO;
      window.sessionStorage.setItem(tabKey, JSON.stringify(parsed));
      return parsed;
    } catch {
      return null;
    }
  }

  public static setPersistedSession(
    profile: ProfileDTO | null,
    options?: { readonly tabOnly?: boolean }
  ): void {
    if (!isBrowser()) return;
    const tabKey = getTabSessionKey();
    if (!profile) {
      window.sessionStorage.removeItem(tabKey);
      if (!options?.tabOnly) {
        window.localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
    } else {
      const serialized = JSON.stringify(profile);
      window.sessionStorage.setItem(tabKey, serialized);
      if (!options?.tabOnly) {
        window.localStorage.setItem(STORAGE_KEYS.SESSION, serialized);
      }
    }
  }

  /**
   * Simulates the PostgreSQL trigger `on_auth_user_created` -> `public.handle_new_user()`
   */
  public static createProfileViaAuthTrigger(params: {
    readonly email: string;
    readonly fullName: string;
    readonly role?: AppRole;
  }): ProfileDTO {
    const profiles = this.getProfiles();
    const normalizedEmail = params.email.trim().toLowerCase();
    const existing = profiles.find((p) => p.email.toLowerCase() === normalizedEmail);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const newProfile: ProfileDTO = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      fullName: params.fullName.trim() || normalizedEmail.split('@')[0] || 'User',
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        params.fullName.trim() || normalizedEmail
      )}`,
      role: params.role ?? 'editor',
      createdAt: now,
      updatedAt: now
    };

    const nextProfiles = [...profiles, newProfile];
    this.saveProfiles(nextProfiles);
    return newProfile;
  }

  /**
   * Resolves a RawStoredDocument into a rich DocumentDTO while enforcing PostgreSQL RLS rules.
   */
  public static hydrateDocumentForUser(
    rawDoc: RawStoredDocument,
    actor: ProfileDTO
  ): DocumentDTO | null {
    const profiles = this.getProfiles();
    const allCollabs = this.getRawCollaborators();

    const docCollabs: CollaboratorDTO[] = allCollabs
      .filter((c) => c.documentId === rawDoc.id)
      .map((c) => {
        const profile = profiles.find((p) => p.id === c.userId) ?? {
          id: c.userId,
          email: 'unknown@collabnotes.io',
          fullName: 'Collaborator',
          avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=CU',
          role: 'viewer' as AppRole,
          createdAt: c.createdAt,
          updatedAt: c.createdAt
        };
        return {
          documentId: c.documentId,
          userId: c.userId,
          permission: c.permission,
          createdAt: c.createdAt,
          profile
        };
      });

    const isOwner = rawDoc.ownerId === actor.id;
    const isAdmin = actor.role === 'admin';
    const userCollab = docCollabs.find((c) => c.userId === actor.id);

    // Enforce RLS SELECT policy: owner, platform admin, or explicit collaborator
    if (!isOwner && !isAdmin && !userCollab) {
      return null;
    }

    const effectivePermission: DocumentDTO['effectivePermission'] = isOwner
      ? 'owner'
      : isAdmin
        ? 'admin'
        : userCollab
          ? userCollab.permission
          : 'viewer';

    const ownerProfile = profiles.find((p) => p.id === rawDoc.ownerId);

    return {
      id: rawDoc.id,
      title: rawDoc.title,
      content: {
        blocks: rawDoc.content.blocks.map((b) => ({ ...b })),
        metadata: rawDoc.content.metadata ? { ...rawDoc.content.metadata } : undefined
      },
      ownerId: rawDoc.ownerId,
      ownerProfile,
      version: rawDoc.version,
      createdAt: rawDoc.createdAt,
      updatedAt: rawDoc.updatedAt,
      collaborators: docCollabs,
      effectivePermission
    };
  }
}
