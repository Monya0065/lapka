"use client";

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('system');

  // initialize from localStorage or system preference
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('lapka-theme');
      if (stored) {
        setTheme(stored);
        return;
      }
    } catch {}
    setTheme('system');
  }, []);

  // apply side effects when theme changes
  useEffect(() => {
    let applied = theme;
    if (theme === 'system') {
      applied = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(applied);
    try {
      if (theme !== 'system') {
        window.localStorage.setItem('lapka-theme', theme);
      } else {
        window.localStorage.removeItem('lapka-theme');
      }
    } catch {}
  }, [theme]);

  return <ThemeContext.Provider value={[theme, setTheme]}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
