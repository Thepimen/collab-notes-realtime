'use client';

import React from 'react';
import type { PresenceUserDTO } from '@/types/domain.types';

interface PresenceBarProps {
  readonly documentId: string;
  readonly activeUsers: readonly PresenceUserDTO[];
  readonly currentUserId: string;
}

function getInitials(name: string): string {
  const parts = name.replace(/\(.*\)/g, '').trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function PresenceBar({ activeUsers, currentUserId }: PresenceBarProps) {
  const remoteTyping = activeUsers.filter((u) => u.userId !== currentUserId && u.isTyping);

  return (
    <div
      aria-label="Personas conectadas en este documento"
      className="flex items-center gap-2"
    >
      {remoteTyping.length > 0 && (
        <span
          aria-live="polite"
          className="hidden items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-[11px] text-secondary xl:inline-flex"
        >
          <span className="inline-flex gap-0.5" aria-hidden="true">
            <span className="h-1 w-1 animate-bounce rounded-full bg-terracotta" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-terracotta [animation-delay:120ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-terracotta [animation-delay:240ms]" />
          </span>
          <span>{remoteTyping[0]?.fullName.split(' ')[0]} está escribiendo…</span>
        </span>
      )}

      <ul className="flex items-center -space-x-1.5" role="list">
        {activeUsers.map((peer) => {
          const isMe = peer.userId === currentUserId;
          const cleanName = peer.fullName.replace(/\s*\(.*\)/, '');
          const roleLabel =
            peer.role === 'viewer' ? 'Solo lectura' : peer.role === 'owner' ? 'Propietario' : 'Editor';

          return (
            <li
              key={peer.userId}
              title={`${cleanName}${isMe ? ' (Tú)' : ''} · ${roleLabel}${
                peer.isTyping && !isMe ? ' — escribiendo' : ''
              }`}
              className="relative"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold tracking-tight text-white ring-2 ring-canvas transition-transform hover:z-10 hover:scale-105"
                style={{ backgroundColor: peer.color }}
              >
                {getInitials(cleanName)}
              </span>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-canvas ${
                  peer.isTyping && !isMe ? 'bg-ochre' : 'bg-sage'
                }`}
                aria-hidden="true"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
