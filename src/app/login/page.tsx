'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Moon,
  Sun
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { isSupabaseConfigured } from '@/services/supabase.client';
import { BrandMark } from '@/components/ui/BrandMark';
import { EditorSkeletonLoader } from '@/components/ui/SkeletonLoaders';

function LoginContent() {
  const { user, isLoading, signIn, seedAccounts } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnUrl = searchParams.get('returnUrl') || '/dashboard';
  const confirmedHint = searchParams.get('registered') === '1';

  const cloudMode = isSupabaseConfigured();
  const [email, setEmail] = useState<string>(cloudMode ? '' : 'admin@collabnotes.io');
  const [password, setPassword] = useState<string>(cloudMode ? '' : 'CollabNotes2026!');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(returnUrl);
    }
  }, [isLoading, returnUrl, router, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const profile = await signIn(email, password);
      pushToast({
        type: 'success',
        title: 'Sesión iniciada',
        message: `¡Hola, ${profile.fullName.replace(/\s*\(.*\)/, '')}!`
      });
      router.replace(returnUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
      setFormError(msg);
      pushToast({
        type: 'error',
        title: 'Error de acceso',
        message: msg
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSeedLogin = async (seedEmail: string) => {
    setEmail(seedEmail);
    setPassword('CollabNotes2026!');
    setFormError(null);
    setIsSubmitting(true);
    try {
      const profile = await signIn(seedEmail, 'CollabNotes2026!');
      pushToast({
        type: 'success',
        title: 'Sesión iniciada',
        message: `Bienvenido, ${profile.fullName.replace(/\s*\(.*\)/, '')}.`
      });
      router.replace(returnUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo acceder.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12 text-ink">
      {/* Subtle Theme Switcher */}
      <div className="absolute right-5 top-5 sm:right-8 sm:top-7">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Cambiar tema de color"
          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-secondary transition hover:border-borderstrong hover:text-ink"
        >
          {theme === 'light' ? (
            <>
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Oscuro</span>
            </>
          ) : (
            <>
              <Sun className="h-3.5 w-3.5 text-ochre" aria-hidden="true" />
              <span>Claro</span>
            </>
          )}
        </button>
      </div>

      <div className="w-full max-w-[400px]">
        {/* Brand Header */}
        <div className="mb-7 text-center">
          <div className="mx-auto flex items-center justify-center gap-2.5">
            <BrandMark size="lg" />
            <span className="font-serif text-3xl tracking-tight text-ink">CollabNotes</span>
          </div>
          <p className="mt-2.5 text-sm text-secondary">
            Tus notas, documentos e ideas siempre sincronizados con tu equipo.
          </p>
        </div>

        {/* Focused Sign-In Card */}
        <section
          aria-labelledby="signin-heading"
          className="rounded-2xl border border-hairline bg-elevated p-7 shadow-sm"
        >
          <h1 id="signin-heading" className="font-serif text-2xl text-ink">
            Iniciar sesión
          </h1>

          {confirmedHint && (
            <div
              role="status"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-sage/30 bg-sage-soft p-3 text-xs text-sage"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Cuenta creada correctamente. Si recibiste un correo de verificación, confírmalo
                antes de acceder.
              </span>
            </div>
          )}

          {returnUrl !== '/dashboard' && (
            <p className="mt-4 rounded-xl border border-ochre/30 bg-ochre-soft px-3.5 py-2 text-xs text-ochre">
              Inicia sesión para continuar a la nota solicitada.
            </p>
          )}

          {formError && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-terracotta/40 bg-terracotta-soft p-3 text-xs text-terracotta"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={(e) => void handleLogin(e)} className="mt-5 space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-secondary">
                Correo electrónico
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="mt-1.5 w-full rounded-xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder-muted transition focus:border-terracotta focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-secondary">
                Contraseña
              </label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1.5 w-full rounded-xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder-muted transition focus:border-terracotta focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-hover disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Entrando…' : 'Entrar'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          <div className="mt-4">
            <Link
              href={`/register?returnUrl=${encodeURIComponent(returnUrl)}`}
              className="flex w-full items-center justify-center rounded-xl border border-hairline bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:border-borderstrong hover:bg-canvas"
            >
              Crear una cuenta
            </Link>
          </div>

          {/* Local Demo Accounts (Only shown when running without cloud backend) */}
          {!cloudMode && seedAccounts.length > 0 && (
            <div className="mt-6 border-t border-hairline pt-4">
              <p className="mb-2 text-[11px] font-medium text-muted">Acceso rápido local</p>
              <div className="grid grid-cols-3 gap-1.5">
                {seedAccounts.map((acc) => {
                  const firstName = acc.fullName.replace(/\s*\(.*\)/, '').split(' ')[0];
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleQuickSeedLogin(acc.email)}
                      className="rounded-lg border border-hairline bg-canvas px-2 py-1.5 text-xs font-medium text-secondary transition hover:border-terracotta/50 hover:text-ink disabled:opacity-50"
                    >
                      {firstName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-muted">
          Escribe, pega imágenes y colabora en tus notas desde cualquier lugar.
        </p>
      </div>
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
