'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCcw } from 'lucide-react';

const RFC_DOC_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

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
      {/* Subtle Studio Header */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-black/10 px-5 dark:border-white/10">
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[11px] text-[#6B665E] transition hover:bg-black/5 hover:text-[#1A1917] dark:text-[#A39E93] dark:hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            <span>Workspace</span>
          </Link>
          <span className="font-serif text-lg tracking-tight">CollabNotes</span>
          <span className="rounded border border-black/10 bg-white/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[#C84B31] dark:border-white/15 dark:bg-white/5 dark:text-[#E0654A]">
            Dual-Session Realtime Bus &middot; OCC Compare-And-Swap &middot; PostgreSQL RLS
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-[#6B665E] dark:text-[#A39E93]">Right Window Role:</span>
          <button
            type="button"
            id="stage-role-editor"
            onClick={() => setRightRole('editor')}
            className={`rounded px-2.5 py-1 transition ${
              rightRole === 'editor'
                ? 'bg-[#2A6F4E] font-semibold text-white'
                : 'bg-white/60 text-[#1A1917] dark:bg-white/10 dark:text-[#F2EFE9]'
            }`}
          >
            Elena · Editor
          </button>
          <button
            type="button"
            id="stage-role-viewer"
            onClick={() => setRightRole('viewer')}
            className={`rounded px-2.5 py-1 transition ${
              rightRole === 'viewer'
                ? 'bg-[#B87314] font-semibold text-white'
                : 'bg-white/60 text-[#1A1917] dark:bg-white/10 dark:text-[#F2EFE9]'
            }`}
          >
            Marco · Viewer (RLS)
          </button>
          <button
            type="button"
            onClick={resetLocalDemoData}
            title="Reset seeded RFC document to v4"
            className="ml-1 inline-flex items-center gap-1 rounded border border-black/10 bg-white/70 px-2 py-1 text-[10px] text-[#6B665E] hover:text-[#1A1917] dark:border-white/15 dark:bg-white/5 dark:text-[#A39E93]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>Reset Seed</span>
          </button>
        </div>
      </header>

      {/* Two Real Isolated Browser Sessions Side-by-Side */}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3.5 p-3.5">
        {/* Left Browser Frame: Luis Lazaro (Admin) */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#D4CEC2] bg-[#FAF8F5] shadow-xl dark:border-[#2C2A26] dark:bg-[#111110]">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#E5E0D5] bg-[#F2EFE9] px-3 font-mono text-[10px] dark:border-[#2C2A26] dark:bg-[#181816]">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#C84B31]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#B87314]/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#2A6F4E]/80" />
              <span className="ml-2 font-semibold text-[#1A1917] dark:text-[#F2EFE9]">
                Session A &mdash; Luis L&aacute;zaro (Admin)
              </span>
            </div>
            <span className="text-[#6B665E] dark:text-[#A39E93]">
              localhost:3000/documents/rfc?as=admin
            </span>
          </div>
          <iframe
            key={`left-${reloadNonce}`}
            id="frame-left"
            name="pane-left"
            title="Session A — Luis Lazaro Admin"
            src={`/documents/${RFC_DOC_ID}?as=admin&sidebar=0&theme=light`}
            className="h-full w-full flex-1 border-0"
          />
        </section>

        {/* Right Browser Frame: Elena Rostova (Editor) / Marco Silva (Viewer RLS) */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#D4CEC2] bg-[#FAF8F5] shadow-xl dark:border-[#2C2A26] dark:bg-[#111110]">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#E5E0D5] bg-[#F2EFE9] px-3 font-mono text-[10px] dark:border-[#2C2A26] dark:bg-[#181816]">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#C84B31]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#B87314]/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#2A6F4E]/80" />
              <span className="ml-2 font-semibold text-[#1A1917] dark:text-[#F2EFE9]">
                {rightRole === 'editor'
                  ? 'Session B — Elena Rostova (Editor)'
                  : 'Session B — Marco Silva (Viewer · RLS Read-Only)'}
              </span>
            </div>
            <span className="text-[#6B665E] dark:text-[#A39E93]">
              localhost:3000/documents/rfc?as={rightRole}
            </span>
          </div>
          <iframe
            key={`right-${rightRole}-${reloadNonce}`}
            id="frame-right"
            name="pane-right"
            title="Session B — Collaborator"
            src={`/documents/${RFC_DOC_ID}?as=${rightRole}&sidebar=0&theme=light`}
            className="h-full w-full flex-1 border-0"
          />
        </section>
      </div>
    </div>
  );
}
