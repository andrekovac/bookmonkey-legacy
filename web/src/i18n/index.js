// Texts for the web app in German and English (2024).
//
//   import { t } from '../i18n';
//   t('nav.cart', { count: 3 })  -> "Warenkorb (3)"
//
// Missing keys fall back to German, then to the key itself, so a page never shows nothing.
// Not every page uses this yet, most admin pages are still German only.
import de from './de.json';
import en from './en.json';

export const LANGUAGES = ['de', 'en'];
const TEXTS = { de: de, en: en };
const STORAGE_KEY = 'bm.language';

const listeners = [];
let current = initial();

function initial() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.indexOf(stored) !== -1) return stored;
  } catch (e) {
    // private mode, no localStorage
  }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'de';
  return nav.slice(0, 2) === 'en' ? 'en' : 'de';
}

function lookup(texts, key) {
  const parts = key.split('.');
  let node = texts;
  for (let i = 0; i < parts.length; i++) {
    if (node === undefined || node === null) return undefined;
    node = node[parts[i]];
  }
  return typeof node === 'string' ? node : undefined;
}

export function t(key, vars) {
  let text = lookup(TEXTS[current], key);
  if (text === undefined) text = lookup(TEXTS.de, key);
  if (text === undefined) {
    if (import.meta.env && import.meta.env.DEV) console.warn('[i18n] missing', current, key);
    return key;
  }
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, function (all, name) {
    return vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : all;
  });
}

export function getLanguage() {
  return current;
}

// for Intl (dates, numbers)
export function locale() {
  return current === 'en' ? 'en-GB' : 'de-DE';
}

export function setLanguage(lang) {
  if (LANGUAGES.indexOf(lang) === -1 || lang === current) return;
  current = lang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {
    // ignore
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  listeners.forEach(fn => fn(lang));
}

export function subscribe(fn) {
  listeners.push(fn);
  return function () {
    const idx = listeners.indexOf(fn);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}
