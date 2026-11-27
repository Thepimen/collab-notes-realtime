'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthService } from '@/services/auth.service';
import { isSupabaseConfigured } from '@/services/supabase.client';
import type { AppRole, ProfileDTO, SignUpResultDTO } from '@/types/domain.types';

interface AuthContextValue {
  readonly user: ProfileDTO | null;
  readonly isLoading: boolean;
  readonly seedAccounts: readonly ProfileDTO[];
  readonly signIn: (email: string, password: string) => Promise<ProfileDTO>;
  readonly switchSandboxUser: (aliasOrEmail: string) => ProfileDTO;
  readonly signUp: (params: {
    readonly email: string;
    readonly password: string;
    readonly fullName: string;
    readonly role?: AppRole;
  }) => Promise<SignUpResultDTO>;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isSameProfile(a: ProfileDTO | null, b: ProfileDTO | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.email === b.email &&
    a.fullName === b.fullName &&
    a.role === b.role &&
    a.avatarUrl === b.avatarUrl
  );
}

export function AuthProvider({ children }: { readonly children: React.ReactNode }) {
  const [user, setUserState] = useState<ProfileDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const seedAccounts: readonly ProfileDTO[] = isSupabaseConfigured()
    ? []
    : AuthService.getSeedAccounts();

  const setUserStable = useCallback((next: ProfileDTO | null) => {
    setUserState((prev) => (isSameProfile(prev, next) ? prev : next ? { ...next } : null));
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function hydrateInitialSession() {
      try {
        const currentUser = await AuthService.getCurrentUser();
        if (isMounted) {
          setUserStable(currentUser);
        }
      } catch (error) {
        console.error('[useAuth] Initial session check failed:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void hydrateInitialSession();

    const unsubscribe = AuthService.onAuthStateChange((nextUser) => {
      if (isMounted) {
        setUserStable(nextUser);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [setUserStable]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<ProfileDTO> => {
      const profile = await AuthService.signInWithPassword({ email, password });
      setUserStable(profile);
      return profile;
    },
    [setUserStable]
  );

  const switchSandboxUser = useCallback(
    (aliasOrEmail: string): ProfileDTO => {
      const profile = AuthService.switchTabSandboxUser(aliasOrEmail);
      setUserStable(profile);
      return profile;
    },
    [setUserStable]
  );

  const signUp = useCallback(
    async (params: {
      readonly email: string;
      readonly password: string;
      readonly fullName: string;
      readonly role?: AppRole;
    }): Promise<SignUpResultDTO> => {
      const result = await AuthService.signUp(params);
      if (result.status === 'AUTHENTICATED') {
        setUserStable(result.profile);
      }
      return result;
    },
    [setUserStable]
  );

  const signOut = useCallback(async (): Promise<void> => {
    await AuthService.signOut();
    setUserStable(null);
  }, [setUserStable]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        seedAccounts,
        signIn,
        switchSandboxUser,
        signUp,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
