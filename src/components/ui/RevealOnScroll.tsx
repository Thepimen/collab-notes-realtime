'use client';

import React, { useEffect, useRef, useState } from 'react';

interface RevealOnScrollProps {
  readonly children: React.ReactNode;
  readonly delayMs?: number;
  readonly className?: string;
}

export function RevealOnScroll({
  children,
  delayMs = 0,
  className = ''
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delayMs}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      className={`transition-all duration-700 ${
        visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-6 scale-[0.985] opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}
