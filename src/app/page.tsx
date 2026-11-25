'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { EditorSkeletonLoader } from '@/components/ui/SkeletonLoaders';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [isLoading, router, user]);

  return (
    <main className="min-h-screen bg-canvas pt-14 text-ink">
      <EditorSkeletonLoader />
    </main>
  );
}
