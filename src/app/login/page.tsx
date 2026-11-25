'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { EditorSkeletonLoader } from '@/components/ui/SkeletonLoaders';

function LoginContent() {
  const { user, isLoading, signIn, seedAccounts } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnUrl = searchParams.get('returnUrl') || '/dashboard';

  const [email, setEmail] = useState<string>('admin@collabnotes.io');
  const [password, setPassword] = useState<string>('CollabNotes2026!');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [specimenVersion, setSpecimenVersion] = useState<number>(4);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(returnUrl);
    }
  }, [isLoading, returnUrl, router, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const profile = await signIn(email, password);
      pushToast({
        type: 'success',
        title: 'Workspace Ready',
        message: `Signed in as ${profile.fullName.replace(/\s*\(.*\)/, '')} (${profile.role}).`
      });
      router.replace(returnUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Authentication failed.';
      pushToast({
        type: 'error',
        title: 'Sign-In Error',
        message: msg
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSeedLogin = async (seedEmail: string) => {
    setEmail(seedEmail);
    setPassword('CollabNotes2026!');
    setIsSubmitting(true);
    try {
      const profile = await signIn(seedEmail, 'CollabNotes2026!');
      pushToast({
        type: 'success',
        title: 'Sandbox Session Active',
        message: `${profile.fullName.replace(/\s*\(.*\)/, '')} · ${profile.role.toUpperCase()}`
      });
      router.replace(returnUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Quick login failed.';
      pushToast({
        type: 'error',
        title: 'Sandbox Login Failed',
        message: msg
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sandboxMeta: Record<string, { readonly label: string; readonly note: string }> = {
    admin: { label: 'Luis Lázaro', note: 'Admin · Full RLS' },
    editor: { label: 'Elena Rostova', note: 'Editor · Read/Write' },
    viewer: { label: 'Marco Silva', note: 'Viewer · RLS Read-Only' }
  };

  return (
    <main className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-2">
      {/* Left Column: Editorial Identity, Manifesto & Live CAS Specimen */}
      <section
        aria-labelledby="editorial-brand-heading"
        className="flex flex-col justify-between border-b border-hairline bg-surface px-8 py-10 sm:px-14 lg:min-h-screen lg:border-b-0 lg:border-r lg:py-12"
      >
        <header className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span id="editorial-brand-heading" className="font-serif text-3xl tracking-tight text-ink">
              CollabNotes
            </span>
            <span className="rounded border border-hairline bg-canvas px-2 py-0.5 font-mono text-[10px] tracking-widest text-secondary">
              REALTIME &middot; OCC &middot; RLS
            </span>
          </div>
        </header>

        <div className="my-10 max-w-md lg:my-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-terracotta">
            Editorial Atelier &amp; Precision Tooling
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-[1.12] text-ink sm:text-[44px]">
            Calm collaborative writing, engineered for{' '}
            <em className="italic text-terracotta">zero lost updates</em>.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-secondary">
            Every keystroke streams across active rooms while atomic Compare-And-Swap versioning,
            deterministic 3-way JSONB block merges, and PostgreSQL Row Level Security guard the
            underlying document state.
          </p>

          {/* Interactive Miniature Architecture Specimen */}
          <div className="mt-8 rounded-xl border border-hairline bg-elevated p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-hairline pb-2.5 font-mono text-[11px]">
              <span className="text-secondary">public.documents &middot; JSONB + GIN</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-2.5 py-0.5 font-medium tabular-nums text-sage">
                <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                Synced &middot; v{specimenVersion}
              </span>
            </div>

            <pre className="mt-3 overflow-x-auto font-mono text-[11px] leading-relaxed tabular-nums text-secondary">
              <code>
                UPDATE documents SET version ={' '}
                <span className="font-semibold text-ink">{specimenVersion + 1}</span>
                {'\n'}WHERE id = &apos;doc_rfc&apos; AND version ={' '}
                <span className="font-semibold text-terracotta">{specimenVersion}</span>;
              </code>
            </pre>

            <div className="mt-3 flex items-center justify-between border-t border-hairline pt-2.5">
              <span className="font-mono text-[10px] text-muted">
                RLS Policy: owner | editor | viewer
              </span>
              <button
                type="button"
                onClick={() => setSpecimenVersion((v) => v + 1)}
                className="rounded border border-hairline bg-surface px-2.5 py-1 font-mono text-[10px] font-medium text-ink transition hover:border-terracotta hover:text-terracotta"
              >
                Step CAS v{specimenVersion}&rarr;v{specimenVersion + 1}
              </button>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between font-mono text-[11px] text-muted">
          <span>Next.js 15 &middot; Strict TypeScript &middot; PostgreSQL 15+</span>
          <span>Zero-Config Local &amp; Supabase Cloud</span>
        </footer>
      </section>

      {/* Right Column: Minimalist Sign-In + 1-Click Sandbox Switcher */}
      <section
        aria-labelledby="signin-heading"
        className="relative flex flex-col justify-center px-8 py-10 sm:px-14 lg:min-h-screen lg:py-12"
      >
        <div className="absolute right-6 top-6 sm:right-10 sm:top-8">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 font-mono text-[11px] text-secondary transition hover:border-borderstrong hover:text-ink"
          >
            {theme === 'light' ? (
              <>
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Obsidian Ink</span>
              </>
            ) : (
              <>
                <Sun className="h-3.5 w-3.5 text-ochre" aria-hidden="true" />
                <span>Warm Paper</span>
              </>
            )}
          </button>
        </div>

        <div className="mx-auto w-full max-w-[390px]">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Workspace Authentication
          </p>
          <h2 id="signin-heading" className="mt-1 font-serif text-3xl text-ink">
            Enter your workspace
          </h2>

          {returnUrl !== '/dashboard' && (
            <p className="mt-2 rounded-lg border border-ochre/30 bg-ochre-soft px-3 py-1.5 font-mono text-[11px] text-ochre">
              Redirecting to <strong>{returnUrl}</strong> after sign-in.
            </p>
          )}

          <form onSubmit={(e) => void handleLogin(e)} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block font-mono text-[10px] uppercase tracking-wider text-secondary"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@collabnotes.io"
                className="mt-1.5 w-full rounded-lg border border-hairline bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder-muted transition focus:border-terracotta focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="block font-mono text-[10px] uppercase tracking-wider text-secondary"
                >
                  Password
                </label>
                <span className="font-mono text-[10px] text-muted">Seed: CollabNotes2026!</span>
              </div>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1.5 w-full rounded-lg border border-hairline bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder-muted transition focus:border-terracotta focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-hover disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Signing in…' : 'Continue to Workspace'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          {/* Compact 1-Click Sandbox Switcher */}
          <div className="mt-7 border-t border-hairline pt-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                1-Click Sandbox Access
              </span>
              <Link
                href="/demo-stage"
                className="font-mono text-[10px] font-semibold text-terracotta underline-offset-4 hover:underline"
              >
                Split-Screen Live Demo &rarr;
              </Link>
            </div>

            <div className="mt-2.5 divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-elevated">
              {seedAccounts.map((acc) => {
                const meta = sandboxMeta[acc.role] ?? {
                  label: acc.fullName,
                  note: acc.role
                };
                return (
                  <button
                    key={acc.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleQuickSeedLogin(acc.email)}
                    className="group flex w-full items-center justify-between px-3.5 py-2.5 text-left transition hover:bg-surface disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            acc.role === 'admin'
                              ? '#C84B31'
                              : acc.role === 'editor'
                                ? '#2A6F4E'
                                : '#B87314'
                        }}
                      />
                      <span className="text-xs font-semibold text-ink">{meta.label}</span>
                      <span className="font-mono text-[11px] text-secondary">{meta.note}</span>
                    </div>
                    <ArrowRight
                      className="h-3.5 w-3.5 text-muted transition group-hover:translate-x-0.5 group-hover:text-terracotta"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-secondary">
            Testing the <code className="font-mono text-[11px] text-ink">on_auth_user_created</code>{' '}
            trigger?{' '}
            <Link
              href={`/register?returnUrl=${encodeURIComponent(returnUrl)}`}
              className="font-semibold text-terracotta underline-offset-4 hover:underline"
            >
              Provision new account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<EditorSkeletonLoader />}>
      <LoginContent />
    </Suspense>
  );
}
