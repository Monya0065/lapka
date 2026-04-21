"use client";

import { useTheme } from '@/components/providers/ThemeProvider';

export default function ThemeToggle() {
  const [theme, setTheme] = useTheme();

  const next = () => {
    if (theme === 'light') return 'dark';
    if (theme === 'dark') return 'system';
    return 'light';
  };

  const label = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System';

  return (
    <button
      onClick={() => setTheme(next())}
      className="fixed bottom-4 right-4 z-50 rounded-full bg-gray-200 p-2 shadow-md dark:bg-gray-800 dark:border dark:border-gray-600"
      style={{fontSize: '1.25rem'}}
      title={`Theme: ${label} (click to cycle)`}
    >
      {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️'}
    </button>
  );
}
