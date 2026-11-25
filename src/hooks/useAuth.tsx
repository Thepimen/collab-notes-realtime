'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthService } from '@/services/auth.service';
import type { AppRole, ProfileDTO } from '@/types/domain.types';

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
  }) => Promise<ProfileDTO>;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: React.ReactNode }) {
  const [user, setUser] = useState<ProfileDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const seedAccounts = AuthService.getSeedAccounts();

  useEffect(() => {
    let isMounted = true;

    async function hydrateInitialSession() {
      try {
        const currentUser = await AuthService.getCurrentUser();
        if (isMounted) {
          setUser(currentUser ? { ...currentUser } : null);
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
        setUser(nextUser ? { ...nextUser } : null);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<ProfileDTO> => {
    const profile = await AuthService.signInWithPassword({ email, password });
    setUser({ ...profile });
    return profile;
  }, []);

  const switchSandboxUser = useCallback((aliasOrEmail: string): ProfileDTO => {
    const profile = AuthService.switchTabSandboxUser(aliasOrEmail);
    setUser({ ...profile });
    return profile;
  }, []);

  const signUp = useCallback(
    async (params: {
      readonly email: string;
      readonly password: string;
      readonly fullName: string;
      readonly role?: AppRole;
    }): Promise<ProfileDTO> => {
      const profile = await AuthService.signUp(params);
      setUser({ ...profile });
      return profile;
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    await AuthService.signOut();
    setUser(null);
  }, []);

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
