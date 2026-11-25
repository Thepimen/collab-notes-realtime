import { getSupabaseClient, isSupabaseConfigured } from './supabase.client';
import { LocalDatabaseAdapter, SEED_PROFILES } from './localStore.adapter';
import type { AppRole, ProfileDTO } from '@/types/domain.types';
import type { DatabaseProfileRow } from '@/types/database.types';

type AuthStateListener = (user: ProfileDTO | null) => void;

const localAuthListeners = new Set<AuthStateListener>();

function notifyLocalAuthListeners(user: ProfileDTO | null): void {
  localAuthListeners.forEach((listener) => {
    try {
      listener(user);
    } catch (error) {
      console.error('[AuthService] Error in auth state listener:', error);
    }
  });
}

function mapRowToProfileDTO(row: DatabaseProfileRow): ProfileDTO {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl:
      row.avatar_url ??
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(row.full_name)}`,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Authentication & Profile Service
 * Isolates all GoTrue Auth and public.profiles queries from UI views.
 */
export class AuthService {
  /**
   * Returns pre-configured seed accounts for quick evaluation login.
   */
  public static getSeedAccounts(): readonly ProfileDTO[] {
    return SEED_PROFILES;
  }

  /**
   * Switches the current tab's sandbox session immediately without affecting sibling tabs.
   */
  public static switchTabSandboxUser(aliasOrEmail: string): ProfileDTO {
    const matched = LocalDatabaseAdapter.resolveSeedAlias(aliasOrEmail);
    if (!matched) {
      throw new Error(`Sandbox profile "${aliasOrEmail}" was not found.`);
    }
    LocalDatabaseAdapter.setPersistedSession(matched, { tabOnly: true });
    notifyLocalAuthListeners(matched);
    return matched;
  }

  /**
   * Retrieves the currently authenticated user profile from persistent session.
   */
  public static async getCurrentUser(): Promise<ProfileDTO | null> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const {
          data: { session },
          error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          return LocalDatabaseAdapter.getPersistedSession();
        }

        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profileRow) {
          return null;
        }

        return mapRowToProfileDTO(profileRow as DatabaseProfileRow);
      }

      return LocalDatabaseAdapter.getPersistedSession();
    } catch (error) {
      console.error('[AuthService.getCurrentUser] Failed to fetch session:', error);
      return LocalDatabaseAdapter.getPersistedSession();
    }
  }

  /**
   * Signs in a user with email and password.
   */
  public static async signInWithPassword(params: {
    readonly email: string;
    readonly password: string;
  }): Promise<ProfileDTO> {
    const normalizedEmail = params.email.trim().toLowerCase();

    if (!normalizedEmail || !params.password) {
      throw new Error('Please enter both your email address and password.');
    }

    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: params.password
        });

        if (error || !data.user) {
          throw new Error(error?.message ?? 'Invalid credentials.');
        }

        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profileRow) {
          throw new Error('Authenticated user profile was not found in public.profiles.');
        }

        const dto = mapRowToProfileDTO(profileRow as DatabaseProfileRow);
        LocalDatabaseAdapter.setPersistedSession(dto);
        notifyLocalAuthListeners(dto);
        return dto;
      }

      // Local / Hybrid Evaluation Mode (validates against seeded & registered profiles)
      const profiles = LocalDatabaseAdapter.getProfiles();
      const matched = profiles.find((p) => p.email.toLowerCase() === normalizedEmail);

      if (!matched) {
        throw new Error(
          `No account found for "${normalizedEmail}". Use one of the seeded accounts or register a new user.`
        );
      }

      if (params.password.length < 6) {
        throw new Error('Invalid password. Passwords must contain at least 6 characters.');
      }

      LocalDatabaseAdapter.setPersistedSession(matched);
      notifyLocalAuthListeners(matched);
      return matched;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected authentication error.';
      throw new Error(message);
    }
  }

  /**
   * Registers a new user account and triggers public.profiles creation (`on_auth_user_created`).
   */
  public static async signUp(params: {
    readonly email: string;
    readonly password: string;
    readonly fullName: string;
    readonly role?: AppRole;
  }): Promise<ProfileDTO> {
    const normalizedEmail = params.email.trim().toLowerCase();
    const cleanedName = params.fullName.trim();
    const assignedRole: AppRole = params.role ?? 'editor';

    if (!normalizedEmail || !params.password || !cleanedName) {
      throw new Error('Full name, email, and password are required to register.');
    }

    if (params.password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: params.password,
          options: {
            data: {
              full_name: cleanedName,
              role: assignedRole
            }
          }
        });

        if (error || !data.user) {
          throw new Error(error?.message ?? 'Registration failed.');
        }

        // Wait briefly for the AFTER INSERT trigger on_auth_user_created to populate public.profiles
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileRow) {
          const dto = mapRowToProfileDTO(profileRow as DatabaseProfileRow);
          LocalDatabaseAdapter.setPersistedSession(dto);
          notifyLocalAuthListeners(dto);
          return dto;
        }
      }

      // Trigger execution simulation in Local / Hybrid store
      const existingProfiles = LocalDatabaseAdapter.getProfiles();
      if (existingProfiles.some((p) => p.email.toLowerCase() === normalizedEmail)) {
        throw new Error(`An account with email "${normalizedEmail}" already exists.`);
      }

      const createdProfile = LocalDatabaseAdapter.createProfileViaAuthTrigger({
        email: normalizedEmail,
        fullName: cleanedName,
        role: assignedRole
      });

      LocalDatabaseAdapter.setPersistedSession(createdProfile);
      notifyLocalAuthListeners(createdProfile);
      return createdProfile;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to register account.';
      throw new Error(message);
    }
  }

  /**
   * Signs out the active user and clears persistent tokens.
   */
  public static async signOut(): Promise<void> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.warn('[AuthService.signOut] Error during remote signOut:', error);
    } finally {
      LocalDatabaseAdapter.setPersistedSession(null);
      notifyLocalAuthListeners(null);
    }
  }

  /**
   * Subscribes to authentication state changes (`onAuthStateChange`).
   * Returns an unsubscribe cleanup callback.
   */
  public static onAuthStateChange(callback: AuthStateListener): () => void {
    localAuthListeners.add(callback);

    let supabaseUnsubscribe: (() => void) | null = null;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!session?.user) {
          const fallback = LocalDatabaseAdapter.getPersistedSession();
          callback(fallback);
          return;
        }

        const { data: profileRow } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileRow) {
          const dto = mapRowToProfileDTO(profileRow as DatabaseProfileRow);
          LocalDatabaseAdapter.setPersistedSession(dto);
          callback(dto);
        }
      });

      supabaseUnsubscribe = () => subscription.unsubscribe();
    }

    return () => {
      localAuthListeners.delete(callback);
      if (supabaseUnsubscribe) {
        supabaseUnsubscribe();
      }
    };
  }

  /**
   * Looks up a user profile by email address for document sharing.
   */
  public static async findProfileByEmail(email: string): Promise<ProfileDTO | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;

    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', normalized)
          .maybeSingle();

        if (!error && data) {
          return mapRowToProfileDTO(data as DatabaseProfileRow);
        }
      }

      const profiles = LocalDatabaseAdapter.getProfiles();
      return profiles.find((p) => p.email.toLowerCase() === normalized) ?? null;
    } catch (error) {
      console.error('[AuthService.findProfileByEmail] Lookup failed:', error);
      return null;
    }
  }
}
