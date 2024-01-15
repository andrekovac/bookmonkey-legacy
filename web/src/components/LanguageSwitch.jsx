import React from 'react';
import xhr from '../api/xhr';
import * as session from '../session';
import useLanguage from '../hooks/useLanguage';
import { LANGUAGES, setLanguage } from '../i18n';

// DE | EN in the header. Logged in users get it saved in their profile,
// so the next login on another device has the same language.
export default function LanguageSwitch() {
  const { t, lang } = useLanguage();

  function choose(next) {
    if (next === lang) return;
    setLanguage(next);
    if (session.getUser()) {
      xhr.put('/auth/me', { language: next }, function (err) {
        if (err) console.warn('could not save language', err.message);
      });
    }
  }

  return (
    <span className="language-switch" title={t('nav.language')}>
      {LANGUAGES.map(l => (
        <button
          key={l}
          type="button"
          className={'language-switch__item' + (l === lang ? ' language-switch__item--active' : '')}
          onClick={() => choose(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </span>
  );
}
