'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  MailCheck,
  Moon,
  Sparkles,
  Sun
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { BrandMark } from '@/components/ui/BrandMark';
import { EditorSkeletonLoader } from '@/components/ui/SkeletonLoaders';

function RegisterContent() {
  const { signUp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnUrl = searchParams.get('returnUrl') || '/dashboard';

  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState<{
    readonly email: string;
    readonly message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const passwordStrength = useMemo(() => {
    if (!password) return null;
    if (password.length < 6) {
      return { label: 'Muy corta (mín. 6 caracteres)', color: 'bg-terracotta', width: '30%' };
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasNumOrSymbol = /[0-9!@#$%^&*]/.test(password);
    if (password.length >= 10 && hasUpper && hasNumOrSymbol) {
      return { label: 'Segura', color: 'bg-sage', width: '100%' };
    }
    return { label: 'Aceptable', color: 'bg-ochre', width: '65%' };
  }, [password]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim()) {
      setFormError('Por favor, escribe tu nombre completo.');
      return;
    }
    if (password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Las contraseñas no coinciden. Revísalas e inténtalo de nuevo.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        password
      });

      if (result.status === 'CONFIRMATION_REQUIRED') {
        setConfirmationSent({
          email: result.email,
          message: result.message
        });
        pushToast({
          type: 'success',
          title: 'Cuenta creada',
          message: 'Revisa tu correo para activar tu cuenta antes de iniciar sesión.'
        });
        return;
      }

      pushToast({
        type: 'success',
        title: '¡Cuenta lista!',
        message: result.message
      });
      router.replace(returnUrl);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'No se pudo completar el registro. Inténtalo de nuevo.';
      setFormError(msg);
      pushToast({
        type: 'error',
        title: 'No se pudo crear la cuenta',
        message: msg
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10 text-ink sm:px-6">
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
        {/* LEFT SECTION: Fluted-Orange Brand Panel */}
        <section
          aria-label="Crea tu espacio en CollabNotes"
          className="fluted-orange flex min-h-[280px] flex-col justify-between rounded-[24px] p-8 text-white sm:p-10 lg:col-span-6 lg:min-h-[540px]"
        >
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Gratis para empezar
            </span>

            <h1 className="mt-5 text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-[38px]">
              Tu nuevo espacio de{' '}
              <span className="relative inline-block">
                escritura viva.
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
              Crea notas en blanco en un clic, añade imágenes copiando y pegando y comparte tus
              proyectos con quien necesites.
            </p>
          </div>

          <ul className="relative z-10 mt-8 space-y-2.5 text-xs font-medium text-white/95">
            <li className="flex items-center gap-2.5 rounded-xl bg-white/12 px-3.5 py-2.5 backdrop-blur-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Edición colaborativa en directo sin sobrescribir cambios</span>
            </li>
            <li className="flex items-center gap-2.5 rounded-xl bg-white/12 px-3.5 py-2.5 backdrop-blur-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Arrastra bloques, inserta fotos y exporta a PDF o Markdown</span>
            </li>
          </ul>
        </section>

        {/* RIGHT SECTION: Clean Registration Form */}
        <section
          aria-labelledby="register-heading"
          className="flex flex-col justify-center px-4 py-6 sm:px-10 lg:col-span-6 lg:py-8"
        >
          <div className="mx-auto w-full max-w-[360px]">
            {confirmationSent ? (
              <div role="status" className="animate-reveal-up space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-soft text-sage">
                  <MailCheck className="h-7 w-7" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="register-heading" className="text-2xl font-extrabold text-ink">
                    Revisa tu correo
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">
                    {confirmationSent.message}
                  </p>
                </div>
                <div className="rounded-xl border border-sage/30 bg-sage-soft p-3.5 text-left text-xs text-sage">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Cuenta registrada para {confirmationSent.email}</span>
                  </div>
                  <p className="mt-1 opacity-90">
                    Una vez abierto el enlace de confirmación, podrás acceder a tus notas.
                  </p>
                </div>
                <Link
                  href={`/login?registered=1&returnUrl=${encodeURIComponent(returnUrl)}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-3 text-sm font-semibold text-white transition hover:bg-terracotta-hover"
                >
                  <span>Ir a iniciar sesión</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <>
                <div
                  style={{ animationDelay: '70ms' }}
                  className="animate-reveal-up flex flex-col items-center text-center"
                >
                  <Link href="/" className="inline-flex items-center gap-2.5">
                    <BrandMark size="md" />
                    <span className="font-serif text-2xl tracking-tight text-ink">
                      CollabNotes
                    </span>
                  </Link>
                  <h2
                    id="register-heading"
                    className="mt-5 text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]"
                  >
                    Crear cuenta
                  </h2>
                  <p className="mt-1 text-xs text-secondary">
                    Empieza a organizar tus notas en segundos
                  </p>
                </div>

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
                  onSubmit={(e) => void handleRegister(e)}
                  style={{ animationDelay: '130ms' }}
                  className="animate-reveal-up mt-6 space-y-3.5"
                >
                  <div>
                    <label htmlFor="register-fullname" className="sr-only">
                      Nombre completo
                    </label>
                    <input
                      id="register-fullname"
                      type="text"
                      required
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nombre completo"
                      className="w-full rounded-xl border border-transparent bg-surface px-4 py-3 text-sm text-ink placeholder-muted transition focus:border-terracotta focus:bg-canvas focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-email" className="sr-only">
                      Correo electrónico
                    </label>
                    <input
                      id="register-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Correo electrónico"
                      className="w-full rounded-xl border border-transparent bg-surface px-4 py-3 text-sm text-ink placeholder-muted transition focus:border-terracotta focus:bg-canvas focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="relative">
                      <label htmlFor="register-password" className="sr-only">
                        Contraseña
                      </label>
                      <input
                        id="register-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Contraseña (mín. 6 caracteres)"
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

                    {passwordStrength && (
                      <div className="mt-2 px-1">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-surface">
                          <div
                            className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                            style={{ width: passwordStrength.width }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-muted">{passwordStrength.label}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="register-confirm-password" className="sr-only">
                      Confirmar contraseña
                    </label>
                    <input
                      id="register-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirmar contraseña"
                      className="w-full rounded-xl border border-transparent bg-surface px-4 py-3 text-sm text-ink placeholder-muted transition focus:border-terracotta focus:bg-canvas focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-3 text-sm font-semibold text-white shadow-md shadow-terracotta/20 transition hover:bg-terracotta-hover active:scale-[0.98] disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Creando cuenta…' : 'Crear mi cuenta'}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </form>

                <p
                  style={{ animationDelay: '200ms' }}
                  className="animate-reveal-up mt-6 text-center text-xs text-secondary"
                >
                  ¿Ya tienes cuenta?{' '}
                  <Link
                    href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}
                    className="font-semibold text-terracotta underline-offset-4 hover:underline"
                  >
                    Iniciar sesión
                  </Link>
                </p>
              </>
            )}
          </div>
        </section>
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
