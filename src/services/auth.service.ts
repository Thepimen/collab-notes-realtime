import { getSupabaseClient, isSupabaseConfigured } from './supabase.client';
import { LocalDatabaseAdapter, SEED_PROFILES } from './localStore.adapter';
import type { AppRole, ProfileDTO, SignUpResultDTO } from '@/types/domain.types';
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
 * Maps raw Supabase / GoTrue / network errors to clear, user-friendly Spanish messages.
 */
function formatAuthError(rawMessage: string | undefined, context: 'signin' | 'signup'): string {
  const msg = (rawMessage ?? '').trim();
  const lower = msg.toLowerCase();

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'El correo electrónico o la contraseña no son correctos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Tu cuenta aún no está confirmada. Revisa tu bandeja de entrada y abre el enlace de verificación antes de iniciar sesión.';
  }
  if (
    lower.includes('user already registered') ||
    lower.includes('already been registered') ||
    lower.includes('already exists')
  ) {
    return 'Ya existe una cuenta registrada con este correo electrónico. Prueba a iniciar sesión.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('over_email_send_rate_limit')) {
    return 'Se han enviado demasiadas solicitudes en pocos minutos. Espera un momento e inténtalo de nuevo.';
  }
  if (lower.includes('password should be at least') || lower.includes('weak password')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (lower.includes('unable to validate email') || lower.includes('invalid format') || lower.includes('invalid email')) {
    return 'Introduce una dirección de correo electrónico válida.';
  }
  if (lower.includes('signups not allowed')) {
    return 'El registro de nuevas cuentas está deshabilitado temporalmente.';
  }
  if (lower.includes('database error saving new user') || lower.includes('500')) {
    return 'No se pudo completar el registro en el servidor en este momento. Comprueba que el correo no esté ya en uso o inténtalo de nuevo en unos segundos.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'No se pudo conectar con el servidor. Comprueba tu conexión a internet e inténtalo de nuevo.';
  }

  if (msg) return msg;
  return context === 'signup'
    ? 'No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.'
    : 'No se pudo iniciar sesión. Revisa tus credenciales.';
}

async function fetchOrProvisionSupabaseProfile(params: {
  readonly userId: string;
  readonly email: string;
  readonly fullName?: string;
}): Promise<ProfileDTO | null> {
  const supabase = getSupabaseClient();

  // Attempt 1: Read profile created by database trigger
  const { data: firstTry } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', params.userId)
    .maybeSingle();

  if (firstTry) {
    return mapRowToProfileDTO(firstTry as DatabaseProfileRow);
  }

  // Brief retry in case the trigger transaction is still committing
  await new Promise((resolve) => setTimeout(resolve, 250));
  const { data: secondTry } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', params.userId)
    .maybeSingle();

  if (secondTry) {
    return mapRowToProfileDTO(secondTry as DatabaseProfileRow);
  }

  // Fallback self-provision under profiles_insert_self policy (auth.uid() = id)
  const fallbackName =
    params.fullName?.trim() || params.email.split('@')[0] || 'Usuario';
  const { data: inserted } = await supabase
    .from('profiles')
    .upsert(
      {
        id: params.userId,
        email: params.email.trim().toLowerCase(),
        full_name: fallbackName,
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackName)}`,
        role: 'editor'
      },
      { onConflict: 'id' }
    )
    .select('*')
    .maybeSingle();

  return inserted ? mapRowToProfileDTO(inserted as DatabaseProfileRow) : null;
}

/**
 * Authentication & Profile Service
 * Isolates all auth and profile queries from UI components.
 */
export class AuthService {
  public static getSeedAccounts(): readonly ProfileDTO[] {
    return SEED_PROFILES;
  }

  public static switchTabSandboxUser(aliasOrEmail: string): ProfileDTO {
    const matched = LocalDatabaseAdapter.resolveSeedAlias(aliasOrEmail);
    if (!matched) {
      throw new Error(`No se encontró el perfil "${aliasOrEmail}".`);
    }
    LocalDatabaseAdapter.setPersistedSession(matched, { tabOnly: true });
    notifyLocalAuthListeners(matched);
    return matched;
  }

  public static async getCurrentUser(): Promise<ProfileDTO | null> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const {
          data: { session },
          error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          return null;
        }

        const profile = await fetchOrProvisionSupabaseProfile({
          userId: session.user.id,
          email: session.user.email ?? '',
          fullName:
            typeof session.user.user_metadata?.full_name === 'string'
              ? session.user.user_metadata.full_name
              : undefined
        });

        return profile;
      }

      return LocalDatabaseAdapter.getPersistedSession();
    } catch (error) {
      console.error('[AuthService.getCurrentUser] Failed to fetch session:', error);
      if (isSupabaseConfigured()) return null;
      return LocalDatabaseAdapter.getPersistedSession();
    }
  }

  public static async signInWithPassword(params: {
    readonly email: string;
    readonly password: string;
  }): Promise<ProfileDTO> {
    const normalizedEmail = params.email.trim().toLowerCase();

    if (!normalizedEmail || !params.password) {
      throw new Error('Introduce tu correo electrónico y tu contraseña.');
    }

    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: params.password
        });

        if (error || !data.user) {
          throw new Error(formatAuthError(error?.message, 'signin'));
        }

        const dto = await fetchOrProvisionSupabaseProfile({
          userId: data.user.id,
          email: data.user.email ?? normalizedEmail,
          fullName:
            typeof data.user.user_metadata?.full_name === 'string'
              ? data.user.user_metadata.full_name
              : undefined
        });

        if (!dto) {
          throw new Error(
            'Tu sesión se inició correctamente, pero no pudimos cargar tu perfil. Inténtalo de nuevo.'
          );
        }

        LocalDatabaseAdapter.setPersistedSession(dto);
        notifyLocalAuthListeners(dto);
        return dto;
      }

      const profiles = LocalDatabaseAdapter.getProfiles();
      const matched = profiles.find((p) => p.email.toLowerCase() === normalizedEmail);

      if (!matched) {
        throw new Error(
          `No existe ninguna cuenta asociada a "${normalizedEmail}". Puedes crear una cuenta nueva o usar uno de los perfiles de demostración.`
        );
      }

      if (params.password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      }

      LocalDatabaseAdapter.setPersistedSession(matched);
      notifyLocalAuthListeners(matched);
      return matched;
    } catch (error) {
      throw new Error(
        formatAuthError(error instanceof Error ? error.message : undefined, 'signin')
      );
    }
  }

  /**
   * Registers a new user account and returns a structured result indicating whether
   * the user is immediately signed in or must confirm their email address.
   */
  public static async signUp(params: {
    readonly email: string;
    readonly password: string;
    readonly fullName: string;
    readonly role?: AppRole;
  }): Promise<SignUpResultDTO> {
    const normalizedEmail = params.email.trim().toLowerCase();
    const cleanedName = params.fullName.trim();
    const assignedRole: AppRole = params.role ?? 'editor';

    if (!cleanedName) {
      throw new Error('Introduce tu nombre completo.');
    }
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error('Introduce una dirección de correo electrónico válida.');
    }
    if (!params.password || params.password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }

    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: params.password,
          options: {
            emailRedirectTo:
              typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
            data: {
              full_name: cleanedName,
              role: assignedRole
            }
          }
        });

        if (error) {
          throw new Error(formatAuthError(error.message, 'signup'));
        }

        if (!data.user) {
          throw new Error('No se pudo completar el registro. Inténtalo de nuevo.');
        }

        // Supabase returns empty identities array when email already exists with confirmation enabled
        if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error(
            'Ya existe una cuenta registrada con este correo electrónico. Prueba a iniciar sesión.'
          );
        }

        if (!data.session) {
          return {
            status: 'CONFIRMATION_REQUIRED',
            email: normalizedEmail,
            message: `Hemos enviado un enlace de confirmación a ${normalizedEmail}. Revisa tu bandeja de entrada (o correo no deseado) y luego inicia sesión.`
          };
        }

        const dto = await fetchOrProvisionSupabaseProfile({
          userId: data.user.id,
          email: normalizedEmail,
          fullName: cleanedName
        });

        if (!dto) {
          return {
            status: 'CONFIRMATION_REQUIRED',
            email: normalizedEmail,
            message: 'Tu cuenta ha sido creada correctamente. Ya puedes iniciar sesión.'
          };
        }

        LocalDatabaseAdapter.setPersistedSession(dto);
        notifyLocalAuthListeners(dto);
        return {
          status: 'AUTHENTICATED',
          profile: dto,
          message: `¡Bienvenido, ${dto.fullName}! Tu espacio de trabajo está listo.`
        };
      }

      const existingProfiles = LocalDatabaseAdapter.getProfiles();
      if (existingProfiles.some((p) => p.email.toLowerCase() === normalizedEmail)) {
        throw new Error(
          `Ya existe una cuenta registrada con "${normalizedEmail}". Inicia sesión en su lugar.`
        );
      }

      const createdProfile = LocalDatabaseAdapter.createProfileViaAuthTrigger({
        email: normalizedEmail,
        fullName: cleanedName,
        role: assignedRole
      });

      LocalDatabaseAdapter.setPersistedSession(createdProfile);
      notifyLocalAuthListeners(createdProfile);
      return {
        status: 'AUTHENTICATED',
        profile: createdProfile,
        message: `¡Bienvenido, ${createdProfile.fullName}! Tu cuenta se ha creado correctamente.`
      };
    } catch (error) {
      throw new Error(
        formatAuthError(error instanceof Error ? error.message : undefined, 'signup')
      );
    }
  }

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

  public static onAuthStateChange(callback: AuthStateListener): () => void {
    localAuthListeners.add(callback);

    let supabaseUnsubscribe: (() => void) | null = null;
    let lastHydratedUserId: string | null = null;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        // Avoid redundant profile re-fetches on silent token refreshes for the same user
        if (event === 'TOKEN_REFRESHED' && session?.user?.id === lastHydratedUserId) {
          return;
        }

        if (!session?.user) {
          lastHydratedUserId = null;
          callback(null);
          return;
        }

        lastHydratedUserId = session.user.id;
        const dto = await fetchOrProvisionSupabaseProfile({
          userId: session.user.id,
          email: session.user.email ?? '',
          fullName:
            typeof session.user.user_metadata?.full_name === 'string'
              ? session.user.user_metadata.full_name
              : undefined
        });

        if (dto) {
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
