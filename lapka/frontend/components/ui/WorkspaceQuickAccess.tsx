'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

function normalizeLinks(links = [], t) {
  const unique = new Map();
  links.forEach((item) => {
    const label = item?.labelKey ? t(item.labelKey) : item?.label;
    if (!item?.href || !label) return;
    if (!unique.has(item.href)) {
      unique.set(item.href, { href: item.href, label });
    }
  });
  return Array.from(unique.values());
}

function scoreLink(link, query) {
  const q = query.toLowerCase();
  const label = link.label.toLowerCase();
  const href = link.href.toLowerCase();
  if (label === q) return 0;
  if (label.startsWith(q)) return 1;
  if (label.includes(q)) return 2;
  if (href.includes(q)) return 3;
  return 99;
}

export default function WorkspaceQuickAccess({ links = [] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const allLinks = useMemo(() => normalizeLinks(links, t), [links, t]);

  const [query, setQuery] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allLinks.slice(0, 6);
    return allLinks
      .map((link) => ({ link, score: scoreLink(link, q) }))
      .filter((item) => item.score < 99)
      .sort((a, b) => a.score - b.score || a.link.label.localeCompare(b.link.label))
      .slice(0, 8)
      .map((item) => item.link);
  }, [allLinks, query]);

  useEffect(() => {
    function onKeyDown(event) {
      const key = String(event.key || '').toLowerCase();
      const openPaletteKey = (event.metaKey || event.ctrlKey) && key === 'k';
      if (openPaletteKey) {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (key === 'escape') {
        setPaletteOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function openLink(href) {
    setPaletteOpen(false);
    setQuery('');
    router.push(href);
  }

  function onSubmit(event) {
    event.preventDefault();
    if (filtered.length > 0) {
      openLink(filtered[0].href);
    }
  }

  return (
    <>
      <section className="surface-card p-3 md:p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <form onSubmit={onSubmit}>
            <label className="block">
              <span className="label">{t('quickAccess.searchLabel')}</span>
              <input
                className="input"
                placeholder={t('quickAccess.searchPlaceholder')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </form>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary" onClick={() => setPaletteOpen(true)}>
              {t('quickAccess.commandPalette')}
            </button>
            <span className="rounded-xl border border-lapka-200 bg-white px-2.5 py-1 text-xs font-semibold text-lapka-600">Ctrl/Cmd + K</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {filtered.map((item) => (
            <button
              key={item.href}
              type="button"
              className="btn-secondary !px-3 !py-1.5 text-xs"
              onClick={() => openLink(item.href)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {paletteOpen ? (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-lapka-900/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-3xl border border-lapka-200 bg-white p-4 shadow-float">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-extrabold tracking-tight text-lapka-900">{t('quickAccess.commandPalette')}</h3>
              <button type="button" className="btn-secondary !px-3 !py-1" onClick={() => setPaletteOpen(false)}>
                Esc
              </button>
            </div>

            <div className="mt-3">
              <input
                autoFocus
                className="input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('quickAccess.modalPlaceholder')}
              />
            </div>

            <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {filtered.length ? (
                filtered.map((item) => (
                  <button
                    key={`palette-${item.href}`}
                    type="button"
                    className="w-full rounded-xl border border-lapka-200 bg-white px-3 py-2 text-left text-sm font-semibold text-lapka-700 transition hover:bg-lapka-50"
                    onClick={() => openLink(item.href)}
                  >
                    <span className="block text-lapka-900">{item.label}</span>
                    <span className="text-xs text-lapka-500">{item.href}</span>
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  {t('quickAccess.empty')}
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-lapka-500">{t('quickAccess.shortcuts')}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
