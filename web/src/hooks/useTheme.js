import { useEffect, useState } from 'react';

// light / dark / auto (= what the operating system says). Stored per browser, not per user.
const STORAGE_KEY = 'bm.theme';
export const THEMES = ['auto', 'light', 'dark'];

function stored() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return THEMES.indexOf(value) !== -1 ? value : 'auto';
  } catch (e) {
    return 'auto';
  }
}

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(theme) {
  const resolved = theme === 'auto' ? (systemDark() ? 'dark' : 'light') : theme;
  document.documentElement.setAttribute('data-theme', resolved);
  return resolved;
}

// called once in main.jsx before the first render, so there is no white flash
export function initTheme() {
  return applyTheme(stored());
}

export default function useTheme() {
  const [theme, setThemeState] = useState(stored());

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'auto' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('auto');
    if (media.addEventListener) media.addEventListener('change', onChange);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', onChange);
    };
  }, [theme]);

  function setTheme(next) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      // ignore
    }
    setThemeState(next);
  }

  return [theme, setTheme];
}
