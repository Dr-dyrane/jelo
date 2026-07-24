'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  // After mount, read the theme the no-flash script already applied to <html>, so
  // the icon matches what the reader sees. This runs client-only to avoid a
  // hydration mismatch, which is why the sync happens in an effect. Light is the
  // default (the app does not follow the OS preference).
  useEffect(() => {
    const stored = document.documentElement.getAttribute('data-theme') as Theme | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(stored ?? 'light');
  }, []);

  function toggle() {
    const next: Theme = (theme ?? 'light') === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.setAttribute('data-theme', next);
    root.style.colorScheme = next;
    try {
      localStorage.setItem('jelo-theme', next);
    } catch {
      // storage unavailable; the choice still applies for this visit
    }
    setTheme(next);
  }

  const isDark = (theme ?? 'light') === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Use light theme' : 'Use dark theme'}
      title={isDark ? 'Light' : 'Dark'}
    >
      {isDark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
}
