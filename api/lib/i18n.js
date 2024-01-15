// Languages for the web app. The web has its own texts (web/src/i18n), the API only
// needs to know which languages exist and which one a user wants.
const LANGUAGES = ['de', 'en'];
const DEFAULT_LANGUAGE = 'de';

function isLanguage(value) {
  return LANGUAGES.indexOf(value) !== -1;
}

// "en-GB,en;q=0.9,de;q=0.8" -> "en"
function fromHeader(header) {
  if (!header) return DEFAULT_LANGUAGE;
  const parts = String(header).split(',').map(function (part) {
    const bits = part.trim().split(';q=');
    return { lang: bits[0].slice(0, 2).toLowerCase(), q: bits[1] ? parseFloat(bits[1]) : 1 };
  });
  parts.sort((a, b) => b.q - a.q);
  const hit = parts.find(p => isLanguage(p.lang));
  return hit ? hit.lang : DEFAULT_LANGUAGE;
}

function languageOf(user) {
  return user && isLanguage(user.language) ? user.language : DEFAULT_LANGUAGE;
}

// pick({ de: 'Hallo', en: 'Hello' }, 'en') -> 'Hello'
function pick(texts, lang) {
  if (!texts) return '';
  return texts[lang] !== undefined ? texts[lang] : texts[DEFAULT_LANGUAGE];
}

module.exports = { LANGUAGES, DEFAULT_LANGUAGE, isLanguage, fromHeader, languageOf, pick };
