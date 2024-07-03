// formatting helpers for the shop. German by default, English when switched in the header
import { locale } from '../i18n';

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function joinAuthors(author, coAuthors) {
  const all = [author].concat(coAuthors || []).filter(Boolean);
  if (all.length <= 1) return all.join('');
  return all.slice(0, -1).join(', ') + ' und ' + all[all.length - 1];
}

export function formatPrice(value, currency) {
  if (value === null || value === undefined || value === '') return '';
  return Number(value).toLocaleString(locale(), { style: 'currency', currency: currency || 'EUR' });
}
