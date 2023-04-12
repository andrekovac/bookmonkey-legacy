// ISBN checks for v2. lib/isbn.js (v1) only knows ISBN-13 and does not say what is wrong,
// the mobile app wants a reason it can show next to the input field.

export type IsbnKind = 'isbn10' | 'isbn13';

export type IsbnCheck =
  | { valid: true; kind: IsbnKind; isbn13: string }
  | { valid: false; reason: string };

// keeps digits and a trailing X (ISBN-10 check digit)
export function digits(value: string): string {
  return String(value || '').replace(/[\s-]/g, '').toUpperCase();
}

export function checkDigit10(first9: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(first9[i]);
  const rest = (11 - (sum % 11)) % 11;
  return rest === 10 ? 'X' : String(rest);
}

export function checkDigit13(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

export function isValidIsbn10(value: string): boolean {
  const d = digits(value);
  if (!/^[0-9]{9}[0-9X]$/.test(d)) return false;
  return checkDigit10(d.slice(0, 9)) === d[9];
}

export function isValidIsbn13(value: string): boolean {
  const d = digits(value);
  if (!/^97[89][0-9]{10}$/.test(d)) return false;
  return checkDigit13(d.slice(0, 12)) === d[12];
}

export function toIsbn13(value: string): string | null {
  const d = digits(value);
  if (isValidIsbn13(d)) return d;
  if (!isValidIsbn10(d)) return null;
  const first12 = '978' + d.slice(0, 9);
  return first12 + checkDigit13(first12);
}

export function check(value: string): IsbnCheck {
  const d = digits(value);
  if (!d) return { valid: false, reason: 'isbn is empty' };
  if (/[^0-9X]/.test(d)) return { valid: false, reason: 'isbn may only contain digits, hyphens and X' };
  if (d.length === 10) {
    if (!isValidIsbn10(d)) return { valid: false, reason: 'wrong check digit (ISBN-10)' };
    return { valid: true, kind: 'isbn10', isbn13: toIsbn13(d) as string };
  }
  if (d.length === 13) {
    if (!/^97[89]/.test(d)) return { valid: false, reason: 'ISBN-13 must start with 978 or 979' };
    if (!isValidIsbn13(d)) return { valid: false, reason: 'wrong check digit (ISBN-13)' };
    return { valid: true, kind: 'isbn13', isbn13: d };
  }
  return { valid: false, reason: 'isbn must have 10 or 13 digits' };
}
