import React from 'react';
import useTheme, { THEMES } from '../hooks/useTheme';
import useLanguage from '../hooks/useLanguage';

const ICONS = { auto: '◐', light: '☀', dark: '☾' };

// cycles auto -> light -> dark
export default function ThemeToggle() {
  const { t } = useLanguage();
  const [theme, setTheme] = useTheme();
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  return (
    <button
      type="button"
      className="c-theme-toggle"
      onClick={() => setTheme(next)}
      title={t('theme.' + theme)}
      aria-label={t('theme.label') + ': ' + t('theme.' + theme)}
    >
      {ICONS[theme]}
    </button>
  );
}
