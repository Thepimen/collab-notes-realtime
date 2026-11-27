'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCcw } from 'lucide-react';

const DEMO_DOC_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

export default function SplitScreenDemoStagePage() {
  const [rightRole, setRightRole] = useState<'editor' | 'viewer'>('editor');
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const resetLocalDemoData = () => {
    try {
      window.localStorage.removeItem('collabnotes.db.documents.v1');
      window.localStorage.removeItem('collabnotes.db.collaborators.v1');
      setReloadNonce((n) => n + 1);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#EAE5DC] text-[#1A1917] dark:bg-[#0D0D0C] dark:text-[#F2EFE9]">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-black/10 px-5 dark:border-white/10">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[#6B665E] transition hover:bg-black/5 hover:text-[#1A1917] dark:text-[#A39E93] dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Volver</span>
          </Link>
          <span className="font-serif text-lg tracking-tight">CollabNotes</span>
          <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-medium text-[#C84B31] dark:bg-white/10 dark:text-[#E0654A]">
            Vista simultánea de colaboración
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#6B665E] dark:text-[#A39E93]">Ventana derecha:</span>
          <button
            type="button"
            id="stage-role-editor"
            onClick={() => setRightRole('editor')}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              rightRole === 'editor'
                ? 'bg-[#2A6F4E] text-white'
                : 'bg-white/60 text-[#1A1917] dark:bg-white/10 dark:text-[#F2EFE9]'
            }`}
          >
            Elena · Editora
          </button>
          <button
            type="button"
            id="stage-role-viewer"
            onClick={() => setRightRole('viewer')}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              rightRole === 'viewer'
                ? 'bg-[#B87314] text-white'
                : 'bg-white/60 text-[#1A1917] dark:bg-white/10 dark:text-[#F2EFE9]'
            }`}
          >
            Marco · Solo lectura
          </button>
          <button
            type="button"
            onClick={resetLocalDemoData}
            title="Restablecer notas de demostración"
            className="ml-1 inline-flex items-center gap-1 rounded-md border border-black/10 bg-white/70 px-2 py-1 text-[11px] text-[#6B665E] hover:text-[#1A1917] dark:border-white/15 dark:bg-white/5 dark:text-[#A39E93]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>Reiniciar</span>
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3.5 p-3.5">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#D4CEC2] bg-[#FAF8F5] shadow-xl dark:border-[#2C2A26] dark:bg-[#111110]">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#E5E0D5] bg-[#F2EFE9] px-3 text-[11px] dark:border-[#2C2A26] dark:bg-[#181816]">
            <span className="font-semibold">Luis Lázaro · Propietario</span>
            <span className="text-[#6B665E] dark:text-[#A39E93]">Sesión A</span>
          </div>
          <iframe
            key={`left-${reloadNonce}`}
            id="frame-left"
            name="pane-left"
            title="Sesión A — Luis Lázaro"
            src={`/documents/${DEMO_DOC_ID}?as=admin&sidebar=0&theme=light`}
            className="h-full w-full flex-1 border-0"
          />
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#D4CEC2] bg-[#FAF8F5] shadow-xl dark:border-[#2C2A26] dark:bg-[#111110]">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#E5E0D5] bg-[#F2EFE9] px-3 text-[11px] dark:border-[#2C2A26] dark:bg-[#181816]">
            <span className="font-semibold">
              {rightRole === 'editor'
                ? 'Elena Rostova · Editora'
                : 'Marco Silva · Solo lectura'}
            </span>
            <span className="text-[#6B665E] dark:text-[#A39E93]">Sesión B</span>
          </div>
          <iframe
            key={`right-${rightRole}-${reloadNonce}`}
            id="frame-right"
            name="pane-right"
            title="Sesión B — Colaborador"
            src={`/documents/${DEMO_DOC_ID}?as=${rightRole}&sidebar=0&theme=light`}
            className="h-full w-full flex-1 border-0"
          />
        </section>
      </div>
    </div>
  );
}
