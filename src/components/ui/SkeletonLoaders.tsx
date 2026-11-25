'use client';

import React from 'react';

export function DashboardSkeletonLoader() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading collaborative documents"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-xl border border-hairline bg-elevated p-5"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 rounded bg-surface" />
            <div className="h-4 w-10 rounded bg-surface" />
          </div>
          <div className="mt-4 h-6 w-3/4 rounded bg-surface" />
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full rounded bg-surface" />
            <div className="h-3 w-4/5 rounded bg-surface" />
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-hairline pt-3.5">
            <div className="h-5 w-16 rounded bg-surface" />
            <div className="h-4 w-20 rounded bg-surface" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading documents...</span>
    </div>
  );
}

export function EditorSkeletonLoader() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading real-time collaborative editor"
      className="mx-auto max-w-[720px] animate-pulse space-y-6 px-6 py-12"
    >
      <div className="space-y-3 border-b border-hairline pb-6">
        <div className="h-10 w-3/4 rounded bg-surface" />
        <div className="h-4 w-48 rounded bg-surface" />
      </div>
      <div className="space-y-4">
        <div className="h-7 w-1/2 rounded bg-surface" />
        <div className="h-20 w-full rounded bg-surface" />
        <div className="h-14 w-5/6 rounded bg-surface" />
        <div className="h-16 w-full rounded bg-surface" />
      </div>
      <span className="sr-only">Initializing real-time room and document blocks...</span>
    </div>
  );
}
