import { useEffect, useState } from 'react';
import { LANG_EVENT, getLang, type Lang } from '../shared/i18n';

/** Re-renders the component when the interface language changes. */
export function useLang(): Lang {
  const [lang, setLangState] = useState(getLang());
  useEffect(() => {
    const on = () => setLangState(getLang());
    window.addEventListener(LANG_EVENT, on);
    return () => window.removeEventListener(LANG_EVENT, on);
  }, []);
  return lang;
}
