'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
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
  const [showPassword, setShowPassword] = useState<boolean>(false);
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
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10 text-ink sm:px-6">
      {/* Top Bar Controls */}
      <div className="mb-5 flex w-full max-w-[960px] items-center justify-between animate-reveal-up">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-secondary transition hover:bg-surface hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Volver al inicio</span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Cambiar tema de color"
          className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-elevated px-3 py-1.5 text-xs font-medium text-secondary transition hover:border-borderstrong hover:text-ink"
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

      {/* Framed Two-Section Split Card */}
      <div className="animate-reveal-scale grid w-full max-w-[960px] grid-cols-1 gap-4 rounded-[32px] border border-hairline bg-elevated p-3.5 shadow-2xl sm:p-5 lg:grid-cols-12">
        {/* LEFT SECTION: Vibrant Fluted-Orange Showcase Card */}
        <section
          aria-label="Presentación de CollabNotes"
          className="fluted-orange flex min-h-[340px] flex-col justify-between rounded-[24px] p-8 text-white sm:p-10 lg:col-span-6 lg:min-h-[540px]"
        >
          <div className="relative z-10">
            <h1 className="text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-[38px]">
              Simplifica tus notas y trabaja{' '}
              <span className="relative inline-block">
                en equipo.
                <svg
                  viewBox="0 0 210 14"
                  fill="none"
                  aria-hidden="true"
                  className="absolute -bottom-2 left-0 w-full"
                >
                  <path
                    d="M3 10.5C48 2.5 142 1.5 207 9.5"
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/90">
              Un espacio claro para escribir ideas, pegar fotos y mantener cada documento al día
              con las personas con las que trabajas.
            </p>
          </div>

          {/* Floating Clean Visual Mockup */}
          <div className="relative z-10 mt-8 pt-2">
            <div className="animate-float-slow mx-auto max-w-[300px] rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur-md shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-sm shadow-sm">
                    📝
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">Ideas de producto</p>
                    <p className="text-[10px] text-white/75">Editado ahora mismo</p>
                  </div>
                </div>
                <div className="flex -space-x-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#171614] text-[9px] font-bold text-white ring-2 ring-white/40">
                    LL
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#246A49] text-[9px] font-bold text-white ring-2 ring-white/40">
                    ER
                  </span>
                </div>
              </div>

              <div className="mt-3.5 space-y-2 rounded-xl bg-white/95 p-3 text-[#171614] shadow-inner">
                <div className="flex items-center gap-2 text-[11px] font-medium">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-[#F45B1E] text-white">
                    <Check className="h-2.5 w-2.5" aria-hidden="true" />
                  </span>
                  <span>Reordenar bloques arrastrando</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-medium text-[#625D56]">
                  <ImagePlus className="h-3.5 w-3.5 text-[#F45B1E]" aria-hidden="true" />
                  <span>Capturas pegadas con Ctrl+V</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT SECTION: Minimalist Focused Login Form */}
        <section
          aria-labelledby="signin-heading"
          className="flex flex-col justify-center px-4 py-6 sm:px-10 lg:col-span-6 lg:py-8"
        >
          <div className="mx-auto w-full max-w-[360px]">
            {/* Centered Brand Identity */}
            <div
              style={{ animationDelay: '70ms' }}
              className="animate-reveal-up flex flex-col items-center text-center"
            >
              <Link href="/" className="inline-flex items-center gap-2.5">
                <BrandMark size="md" />
                <span className="font-serif text-2xl tracking-tight text-ink">CollabNotes</span>
              </Link>
              <h2
                id="signin-heading"
                className="mt-5 text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]"
              >
                Bienvenido de nuevo
              </h2>
              <p className="mt-1 text-xs text-secondary">
                Inicia sesión para continuar con tus notas
              </p>
            </div>

            {confirmedHint && (
              <div
                role="status"
                className="animate-reveal-up mt-5 flex items-start gap-2.5 rounded-xl border border-sage/30 bg-sage-soft p-3 text-xs text-sage"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Cuenta creada correctamente. Si recibiste un correo de verificación, confírmalo
                  antes de iniciar sesión.
                </span>
              </div>
            )}

            {returnUrl !== '/dashboard' && (
              <p className="animate-reveal-up mt-4 rounded-xl border border-ochre/30 bg-ochre-soft px-3.5 py-2 text-center text-xs text-ochre">
                Inicia sesión para abrir la nota solicitada.
              </p>
            )}

            {formError && (
              <div
                role="alert"
                className="animate-reveal-up mt-4 flex items-start gap-2.5 rounded-xl border border-terracotta/40 bg-terracotta-soft p-3 text-xs text-terracotta"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => void handleLogin(e)}
              style={{ animationDelay: '130ms' }}
              className="animate-reveal-up mt-6 space-y-3.5"
            >
              <div>
                <label htmlFor="login-email" className="sr-only">
                  Correo electrónico
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Correo electrónico"
                  className="w-full rounded-xl border border-transparent bg-surface px-4 py-3 text-sm text-ink placeholder-muted transition focus:border-terracotta focus:bg-canvas focus:outline-none"
                />
              </div>

              <div className="relative">
                <label htmlFor="login-password" className="sr-only">
                  Contraseña
                </label>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full rounded-xl border border-transparent bg-surface py-3 pl-4 pr-11 text-sm text-ink placeholder-muted transition focus:border-terracotta focus:bg-canvas focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted transition hover:text-ink"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-3 text-sm font-semibold text-white shadow-md shadow-terracotta/20 transition hover:bg-terracotta-hover active:scale-[0.98] disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Entrando…' : 'Iniciar sesión'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            {/* Local Demo Switcher (only shown offline) */}
            {!cloudMode && seedAccounts.length > 0 && (
              <div
                style={{ animationDelay: '180ms' }}
                className="animate-reveal-up mt-6 border-t border-hairline pt-4"
              >
                <p className="mb-2 text-center text-[11px] font-medium text-muted">
                  Acceso rápido de prueba
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {seedAccounts.map((acc) => {
                    const firstName = acc.fullName.replace(/\s*\(.*\)/, '').split(' ')[0];
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void handleQuickSeedLogin(acc.email)}
                        className="rounded-xl border border-hairline bg-surface px-2 py-2 text-xs font-medium text-secondary transition hover:border-terracotta/50 hover:text-ink disabled:opacity-50"
                      >
                        {firstName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p
              style={{ animationDelay: '210ms' }}
              className="animate-reveal-up mt-7 text-center text-xs text-secondary"
            >
              ¿No tienes una cuenta?{' '}
              <Link
                href={`/register?returnUrl=${encodeURIComponent(returnUrl)}`}
                className="font-semibold text-terracotta underline-offset-4 hover:underline"
              >
                Regístrate
              </Link>
            </p>
          </div>
        </section>
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
