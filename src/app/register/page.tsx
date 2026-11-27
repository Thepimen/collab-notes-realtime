'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  MailCheck,
  Moon,
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
    <main className="relative flex min-h-screen flex-col justify-center bg-canvas px-6 py-12 text-ink">
      <div className="absolute right-6 top-6 sm:right-10 sm:top-8">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Cambiar tema de color"
          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-secondary transition hover:border-borderstrong hover:text-ink"
        >
          {theme === 'light' ? (
            <>
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Modo oscuro</span>
            </>
          ) : (
            <>
              <Sun className="h-3.5 w-3.5 text-ochre" aria-hidden="true" />
              <span>Modo claro</span>
            </>
          )}
        </button>
      </div>

      <div className="mx-auto w-full max-w-md rounded-2xl border border-hairline bg-elevated p-8 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <BrandMark size="md" />
          <span className="font-serif text-2xl tracking-tight text-ink">CollabNotes</span>
        </div>

        {confirmationSent ? (
          <div role="status" className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-soft text-sage">
              <MailCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-serif text-3xl text-ink">Revisa tu correo</h1>
              <p className="mt-2 text-sm leading-relaxed text-secondary">
                {confirmationSent.message}
              </p>
            </div>
            <div className="rounded-xl border border-sage/30 bg-sage-soft p-3.5 text-xs text-sage">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Cuenta registrada para {confirmationSent.email}</span>
              </div>
              <p className="mt-1 opacity-90">
                Una vez confirmado el enlace en tu correo, podrás entrar directamente a tus notas.
              </p>
            </div>
            <Link
              href={`/login?registered=1&returnUrl=${encodeURIComponent(returnUrl)}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-hover"
            >
              <span>Ir a iniciar sesión</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-3xl text-ink">Crear cuenta</h1>
            <p className="mt-1 text-xs text-secondary">
              Empieza a organizar tus notas y colaborar con otras personas en segundos.
            </p>

            {formError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-terracotta/40 bg-terracotta-soft p-3 text-xs text-terracotta"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={(e) => void handleRegister(e)} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="register-fullname"
                  className="block text-xs font-medium text-secondary"
                >
                  Nombre completo
                </label>
                <input
                  id="register-fullname"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre"
                  className="mt-1.5 w-full rounded-xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder-muted focus:border-terracotta focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="register-email"
                  className="block text-xs font-medium text-secondary"
                >
                  Correo electrónico
                </label>
                <input
                  id="register-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="mt-1.5 w-full rounded-xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder-muted focus:border-terracotta focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="register-password"
                  className="block text-xs font-medium text-secondary"
                >
                  Contraseña
                </label>
                <input
                  id="register-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="mt-1.5 w-full rounded-xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder-muted focus:border-terracotta focus:outline-none"
                />
                {passwordStrength && (
                  <div className="mt-2">
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
                <label
                  htmlFor="register-confirm-password"
                  className="block text-xs font-medium text-secondary"
                >
                  Confirmar contraseña
                </label>
                <input
                  id="register-confirm-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  className="mt-1.5 w-full rounded-xl border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder-muted focus:border-terracotta focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-hover disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Creando cuenta…' : 'Crear mi cuenta'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>

            <p className="mt-6 border-t border-hairline pt-4 text-center text-xs text-secondary">
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
