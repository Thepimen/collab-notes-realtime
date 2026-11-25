'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import type { AppRole } from '@/types/domain.types';
import { EditorSkeletonLoader } from '@/components/ui/SkeletonLoaders';

function RegisterContent() {
  const { signUp } = useAuth();
  const { pushToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnUrl = searchParams.get('returnUrl') || '/dashboard';

  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<AppRole>('editor');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const profile = await signUp({
        fullName,
        email,
        password,
        role
      });
      pushToast({
        type: 'success',
        title: 'Profile Provisioned',
        message: `Trigger on_auth_user_created created ${profile.fullName} (${profile.role}).`
      });
      router.replace(returnUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Registration failed.';
      pushToast({
        type: 'error',
        title: 'Registration Error',
        message: msg
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col justify-center bg-canvas px-6 py-12 text-ink">
      <div className="mx-auto w-full max-w-md rounded-xl border border-hairline bg-elevated p-8 shadow-sm">
        <p className="font-mono text-[10px] uppercase tracking-widest text-terracotta">
          PostgreSQL Trigger &middot; on_auth_user_created
        </p>
        <h1 className="mt-1 font-serif text-3xl text-ink">Provision New Collaborator</h1>
        <p className="mt-1 text-xs text-secondary">
          Creates an identity row and automatically populates <code className="font-mono">public.profiles</code>.
        </p>

        <form onSubmit={(e) => void handleRegister(e)} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="register-fullname"
              className="block font-mono text-[10px] uppercase tracking-wider text-secondary"
            >
              Full Name
            </label>
            <input
              id="register-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ada Lovelace"
              className="mt-1.5 w-full rounded-lg border border-hairline bg-canvas px-3.5 py-2 text-sm text-ink placeholder-muted focus:border-terracotta focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="block font-mono text-[10px] uppercase tracking-wider text-secondary"
            >
              Email
            </label>
            <input
              id="register-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ada@collabnotes.io"
              className="mt-1.5 w-full rounded-lg border border-hairline bg-canvas px-3.5 py-2 text-sm text-ink placeholder-muted focus:border-terracotta focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="block font-mono text-[10px] uppercase tracking-wider text-secondary"
            >
              Password (min. 6 chars)
            </label>
            <input
              id="register-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="mt-1.5 w-full rounded-lg border border-hairline bg-canvas px-3.5 py-2 text-sm text-ink placeholder-muted focus:border-terracotta focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="register-role"
              className="block font-mono text-[10px] uppercase tracking-wider text-secondary"
            >
              Role (<code className="font-mono">public.app_role</code>)
            </label>
            <select
              id="register-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="mt-1.5 w-full rounded-lg border border-hairline bg-canvas px-3.5 py-2 text-sm text-ink focus:border-terracotta focus:outline-none"
            >
              <option value="editor">editor — Read &amp; Write Collaborator</option>
              <option value="viewer">viewer — RLS Read-Only Auditor</option>
              <option value="admin">admin — Platform Architect</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-hover disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Provisioning…' : 'Create Account'}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <p className="mt-6 border-t border-hairline pt-4 text-center text-xs text-secondary">
          Already provisioned?{' '}
          <Link
            href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}
            className="font-semibold text-terracotta underline-offset-4 hover:underline"
          >
            Return to Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<EditorSkeletonLoader />}>
      <RegisterContent />
    </Suspense>
  );
}
