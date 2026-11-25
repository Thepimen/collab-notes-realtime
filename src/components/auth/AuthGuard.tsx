'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { EditorSkeletonLoader } from '@/components/ui/SkeletonLoaders';

interface AuthGuardProps {
  readonly children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      const encodedReturnUrl = encodeURIComponent(pathname || '/dashboard');
      router.replace(`/login?returnUrl=${encodedReturnUrl}`);
    }
  }, [isLoading, pathname, router, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas pt-12 text-ink">
        <EditorSkeletonLoader />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
