'use client';

import React from 'react';

interface BrandMarkProps {
  readonly size?: 'sm' | 'md' | 'lg';
}

export function BrandMark({ size = 'md' }: BrandMarkProps) {
  const dims =
    size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-10 w-10' : 'h-7 w-7';

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={`${dims} shrink-0`}
    >
      <defs>
        <linearGradient id="bm-bg" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D9573B" />
          <stop offset="100%" stopColor="#A83820" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#bm-bg)" />
      <path
        d="M17 15.5C17 13.567 18.567 12 20.5 12H36.8C37.73 12 38.62 12.37 39.28 13.03L46.97 20.72C47.63 21.38 48 22.27 48 23.2V48.5C48 50.433 46.433 52 44.5 52H20.5C18.567 52 17 50.433 17 48.5V15.5Z"
        fill="#FFFDF9"
      />
      <path d="M37 12.2V20.5C37 21.88 38.12 23 39.5 23H47.8L37 12.2Z" fill="#DFD5C5" />
      <rect x="23" y="27" width="16" height="3.2" rx="1.6" fill="#1A1917" />
      <rect x="23" y="34" width="18" height="2.8" rx="1.4" fill="#6B665E" fillOpacity="0.72" />
      <rect x="23" y="40.5" width="11" height="2.8" rx="1.4" fill="#6B665E" fillOpacity="0.52" />
      <circle cx="46.5" cy="46.5" r="7.5" fill="#2A6F4E" stroke="#FAF8F5" strokeWidth="2.6" />
      <circle cx="46.5" cy="46.5" r="2.2" fill="#FFFDF9" />
    </svg>
  );
}
