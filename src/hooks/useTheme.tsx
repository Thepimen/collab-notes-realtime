'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type EditorialTheme = 'light' | 'dark';

interface ThemeContextValue {
  readonly theme: EditorialTheme;
  readonly setTheme: (next: EditorialTheme) => void;
  readonly toggleTheme: () => void;
}

const THEME_TAB_KEY = 'collabnotes.theme.tab.v1';
const THEME_GLOBAL_KEY = 'collabnotes.theme.v1';

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => undefined,
  toggleTheme: () => undefined
});

function applyDomTheme(mode: EditorialTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { readonly children: React.ReactNode }) {
  const [theme, setThemeState] = useState<EditorialTheme>('light');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTheme = params.get('theme');
      if (urlTheme === 'dark' || urlTheme === 'light') {
        window.sessionStorage.setItem(THEME_TAB_KEY, urlTheme);
        setThemeState(urlTheme);
        applyDomTheme(urlTheme);
        return;
      }

      const tabSaved = window.sessionStorage.getItem(THEME_TAB_KEY);
      const globalSaved = window.localStorage.getItem(THEME_GLOBAL_KEY);
      const resolved: EditorialTheme =
        tabSaved === 'dark' || tabSaved === 'light'
          ? tabSaved
          : globalSaved === 'dark'
            ? 'dark'
            : 'light';

      setThemeState(resolved);
      applyDomTheme(resolved);
    } catch {
      applyDomTheme('light');
    }
  }, []);

  const setTheme = useCallback((next: EditorialTheme) => {
    setThemeState(next);
    applyDomTheme(next);
    try {
      window.sessionStorage.setItem(THEME_TAB_KEY, next);
      window.localStorage.setItem(THEME_GLOBAL_KEY, next);
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: EditorialTheme = prev === 'light' ? 'dark' : 'light';
      applyDomTheme(next);
      try {
        window.sessionStorage.setItem(THEME_TAB_KEY, next);
        window.localStorage.setItem(THEME_GLOBAL_KEY, next);
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
