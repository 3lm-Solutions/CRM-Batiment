import { useEffect, useState } from 'react';

const THEME_KEY = 'theme';
const LEGACY_DARK_MODE_KEY = 'darkMode';
const LANDING_THEME_KEY = 'baticrm-theme';
const THEME_CHANGE_EVENT = 'baticrm-theme-change';

const readInitialDarkMode = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const savedTheme = localStorage.getItem(THEME_KEY) ?? localStorage.getItem(LANDING_THEME_KEY);
  if (savedTheme === 'dark') {
    return true;
  }
  if (savedTheme === 'light') {
    return false;
  }

  const legacyDarkMode = localStorage.getItem(LEGACY_DARK_MODE_KEY);
  if (legacyDarkMode) {
    try {
      return JSON.parse(legacyDarkMode) === true;
    } catch {
      return legacyDarkMode === 'true';
    }
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(readInitialDarkMode);

  useEffect(() => {
    const nextTheme = darkMode ? 'dark' : 'light';

    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem(THEME_KEY, nextTheme);
    localStorage.setItem(LANDING_THEME_KEY, nextTheme);
    localStorage.setItem(LEGACY_DARK_MODE_KEY, JSON.stringify(darkMode));
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { darkMode } }));
  }, [darkMode]);

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const nextDarkMode = (event as CustomEvent<{ darkMode: boolean }>).detail?.darkMode;
      if (typeof nextDarkMode === 'boolean') {
        setDarkMode(nextDarkMode);
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if ([THEME_KEY, LEGACY_DARK_MODE_KEY, LANDING_THEME_KEY].includes(event.key ?? '')) {
        setDarkMode(readInitialDarkMode());
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return {
    darkMode,
    setDarkMode,
    toggleDarkMode: () => setDarkMode((value) => !value),
  };
}
