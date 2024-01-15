import { useEffect, useState } from 'react';
import { getLanguage, subscribe, t } from '../i18n';

// function components: const { t, lang } = useLanguage();
// re-renders the component when the language is switched in the header
export default function useLanguage() {
  const [lang, setLang] = useState(getLanguage());
  useEffect(() => subscribe(setLang), []);
  return { t: t, lang: lang };
}
