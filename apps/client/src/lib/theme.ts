import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

// Same key as the inline script in index.html, which applies the theme before React loads.
const STORAGE_KEY = 'tc-theme';
const listeners = new Set<() => void>();

/** The <html data-theme> attribute is the single source of truth. */
export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage blocked: the theme still applies for this page view.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders every subscriber when the theme changes (no React context needed). */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme);
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  return { theme, setTheme, toggleTheme };
}
