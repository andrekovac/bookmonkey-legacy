import React, { useEffect, useState } from 'react';
import api from '../api/client';
import * as session from '../session';
import useLanguage from '../hooks/useLanguage';
import { LANGUAGES, setLanguage } from '../i18n';

// Account page: mails yes/no and language. Saved right away, no save button.
export default function NotificationSettings() {
  const { t } = useLanguage();
  const [user, setUser] = useState(session.getUser());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => session.subscribe(setUser), []);

  if (!user) return null;

  function save(changes) {
    setSaving(true);
    setMessage(null);
    setError(null);
    return api.put('/auth/me', changes)
      .then(updated => {
        setUser(updated);
        if (changes.language) setLanguage(changes.language);
        setMessage(t('settings.saved'));
        session.load();
      })
      .catch(err => setError(err.message))
      .finally(() => setSaving(false));
  }

  return (
    <fieldset className="c-settings" disabled={saving}>
      <legend>{t('settings.title')}</legend>
      <div aria-live="polite">
        {message && <div className="success">{message}</div>}
        {error && <div className="error">{error}</div>}
      </div>
      <div className="c-settings__group" role="radiogroup" aria-labelledby="notify-label">
        <div id="notify-label" className="c-settings__label">{t('settings.notify')}</div>
        <label className="radio">
          <input type="radio" name="notify" checked={user.notify !== 'none'} onChange={() => save({ notify: 'mail' })} />
          {t('settings.notifyMail')}
        </label>
        <label className="radio">
          <input type="radio" name="notify" checked={user.notify === 'none'} onChange={() => save({ notify: 'none' })} />
          {t('settings.notifyNone')}
        </label>
        <div className="u-muted c-settings__hint">{t('settings.notifyHint')}</div>
      </div>
      <label className="c-settings__group">
        <span className="c-settings__label">{t('settings.language')}</span>
        <select value={user.language || 'de'} onChange={e => save({ language: e.target.value })}>
          {LANGUAGES.map(l => <option key={l} value={l}>{t('languages.' + l)}</option>)}
        </select>
      </label>
    </fieldset>
  );
}
