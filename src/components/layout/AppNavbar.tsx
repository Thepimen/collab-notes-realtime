'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Command, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { BrandMark } from '@/components/ui/BrandMark';

interface AppNavbarProps {
  readonly hasPendingChanges?: boolean;
  readonly onForceSaveBeforeLeave?: () => Promise<void>;
  readonly onOpenPalette?: () => void;
}

export function AppNavbar({
  hasPendingChanges = false,
  onForceSaveBeforeLeave,
  onOpenPalette
}: AppNavbarProps) {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [pendingNavTarget, setPendingNavTarget] = useState<string | 'LOGOUT' | null>(null);

  const handleSafeNavigation = (target: string | 'LOGOUT') => {
    if (hasPendingChanges) {
      setPendingNavTarget(target);
      return;
    }
    void executeNavigation(target);
  };

  const executeNavigation = async (target: string | 'LOGOUT') => {
    setPendingNavTarget(null);
    if (target === 'LOGOUT') {
      await signOut();
      router.replace('/login');
    } else {
      router.push(target);
    }
  };

  const handleSaveAndProceed = async () => {
    if (!pendingNavTarget) return;
    if (onForceSaveBeforeLeave) {
      await onForceSaveBeforeLeave();
    }
    await executeNavigation(pendingNavTarget);
  };

  const displayName = user?.fullName.replace(/\s*\(.*\)/, '') ?? '';

  return (
    <>
      <header className="no-print sticky top-0 z-30 h-13 border-b border-hairline bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => handleSafeNavigation('/dashboard')}
            className="flex items-center gap-2.5 text-left"
            aria-label="Ir al inicio de CollabNotes"
          >
            <BrandMark size="md" />
            <span className="font-serif text-2xl tracking-tight text-ink">CollabNotes</span>
          </button>

          {user && (
            <nav aria-label="Navegación principal" className="flex items-center gap-2">
              {onOpenPalette && (
                <button
                  type="button"
                  onClick={onOpenPalette}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2.5 py-1 text-xs text-secondary transition hover:border-borderstrong hover:text-ink"
                >
                  <Command className="h-3 w-3" aria-hidden="true" />
                  <span className="hidden sm:inline">Buscar</span>
                  <kbd className="font-mono text-[10px] text-muted">⌘K</kbd>
                </button>
              )}

              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Cambiar tema de color"
                title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
                className="rounded-lg border border-hairline bg-elevated p-1.5 text-secondary transition hover:border-borderstrong hover:text-ink"
              >
                {theme === 'light' ? (
                  <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Sun className="h-3.5 w-3.5 text-ochre" aria-hidden="true" />
                )}
              </button>

              <div className="hidden items-center gap-2 rounded-lg border border-hairline bg-surface px-2.5 py-1 sm:flex">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-terracotta/15 text-[10px] font-bold uppercase text-terracotta">
                  {displayName.slice(0, 2)}
                </span>
                <span className="max-w-[140px] truncate text-xs font-medium text-ink">
                  {displayName}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleSafeNavigation('LOGOUT')}
                aria-label="Cerrar sesión"
                className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-elevated px-2.5 py-1 text-xs font-medium text-secondary transition hover:border-terracotta/50 hover:text-terracotta"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden md:inline">Salir</span>
              </button>
            </nav>
          )}
        </div>
      </header>

      {pendingNavTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pending-changes-dialog-title"
          className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
        >
          <div className="animate-modal-in w-full max-w-md rounded-2xl border border-hairline bg-elevated p-6 text-ink shadow-2xl">
            <div className="flex items-center gap-2.5 text-ochre">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <h2 id="pending-changes-dialog-title" className="font-serif text-xl text-ink">
                Tienes cambios sin guardar
              </h2>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-secondary">
              ¿Quieres guardar tus últimos cambios antes de salir de esta nota?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingNavTarget(null)}
                className="rounded-lg border border-hairline bg-surface px-3.5 py-1.5 text-xs font-medium text-ink hover:border-borderstrong"
              >
                Seguir editando
              </button>
              <button
                type="button"
                onClick={() => void executeNavigation(pendingNavTarget)}
                className="rounded-lg border border-terracotta/40 bg-terracotta-soft px-3.5 py-1.5 text-xs font-medium text-terracotta"
              >
                Salir sin guardar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAndProceed()}
                className="rounded-lg bg-terracotta px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-terracotta-hover"
              >
                Guardar y salir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
