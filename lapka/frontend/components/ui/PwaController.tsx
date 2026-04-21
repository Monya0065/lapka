'use client';

import { useEffect, useState } from 'react';

export default function PwaController() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          // ignore registration errors in demo mode
        });
      });
    }

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };

    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function onInstall() {
    if (!promptEvent) return;
    promptEvent.prompt();
    try {
      await promptEvent.userChoice;
    } finally {
      setPromptEvent(null);
    }
  }

  if (dismissed || installed || !promptEvent) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[90] w-[min(92vw,320px)] rounded-2xl border border-cyan-200 bg-white/95 p-3 shadow-float backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">PWA</p>
      <h3 className="mt-1 text-lg font-extrabold tracking-tight text-lapka-900">Установить Lapka</h3>
      <p className="mt-1 text-sm text-lapka-600">Добавьте приложение на устройство для быстрого доступа и офлайн-черновиков.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-primary" onClick={onInstall}>
          Установить
        </button>
        <button type="button" className="btn-secondary" onClick={() => setDismissed(true)}>
          Позже
        </button>
      </div>
    </div>
  );
}
