import { useEffect, useState } from 'react';

const KEY = 'crm.theme';

/** Light / dark theme, shared by the app and the public pages; remembered in this browser. */
export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(KEY) === 'dark';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(KEY, dark ? 'dark' : 'light');
    } catch {
      /* private mode: theme just isn't remembered */
    }
  }, [dark]);
  return [dark, setDark] as const;
}
