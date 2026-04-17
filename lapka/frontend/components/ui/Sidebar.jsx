'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import SidebarIcon from '@/components/ui/SidebarIcon';

function normalizeGroups({ links = [], groups = [] }) {
  if (Array.isArray(groups) && groups.length) return groups;
  return links.length ? [{ title: '', links }] : [];
}

export default function Sidebar({
  title,
  subtitle,
  links = [],
  groups = [],
  footer,
  variant = 'default',
  homeHref = '/',
  compact = false,
  onCompactChange = () => {},
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const normalizedGroups = normalizeGroups({ links, groups });
  const isDark = variant === 'workspace-dark';
  const storageKey = `lapka.sidebar.groups.${homeHref}`;

  const isActive = useCallback((href) => pathname === href || pathname.startsWith(`${href}/`), [pathname]);
  const label = (link) => (link.labelKey ? t(link.labelKey) : link.label);
  const groupTitle = (group) => (group.titleKey ? t(group.titleKey) : group.title);
  const groupKey = (group, index) => String(group.title || group.titleKey || group.links?.[0]?.href || `group-${index}`);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fallback = normalizedGroups.reduce((acc, group, index) => {
      acc[groupKey(group, index)] = true;
      return acc;
    }, {});

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setExpandedGroups(fallback);
        return;
      }
      const parsed = JSON.parse(raw);
      setExpandedGroups({ ...fallback, ...(parsed || {}) });
    } catch {
      setExpandedGroups(fallback);
    }
  }, [storageKey, pathname, normalizedGroups]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(expandedGroups));
    } catch {
      // ignore storage failures
    }
  }, [expandedGroups, storageKey]);

  useEffect(() => {
    setExpandedGroups((current) => {
      const next = { ...current };
      let changed = false;
      normalizedGroups.forEach((group, index) => {
        const key = groupKey(group, index);
        const hasActiveLink = (group.links || []).some((link) => isActive(link.href));
        if (hasActiveLink && !next[key]) {
          next[key] = true;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [isActive, normalizedGroups]);

  function toggleGroup(key) {
    setExpandedGroups((current) => ({ ...current, [key]: !current[key] }));
  }

  function expandAll(value) {
    setExpandedGroups(
      normalizedGroups.reduce((acc, group, index) => {
        acc[groupKey(group, index)] = value;
        return acc;
      }, {})
    );
  }

  return (
    <aside className="space-y-3 xl:sticky xl:top-[108px] xl:self-start">
      <div className={`${isDark ? 'sidebar-shell sidebar-shell-dark' : 'sidebar-shell'} ${compact ? 'sidebar-shell-compact' : ''}`}>
        <div className={`px-4 pt-4 md:px-5 md:pt-5 ${compact ? 'sidebar-header-compact' : ''}`}>
          <Link href={homeHref} prefetch={false} className={`workspace-sidebar-brand ${isDark ? 'workspace-sidebar-brand-dark' : ''}`}>
            <span className="workspace-sidebar-brand-mark" aria-hidden />
            <span className={`workspace-sidebar-brand-copy ${compact ? 'hidden' : ''}`}>
              <span className={`workspace-sidebar-brand-name ${isDark ? 'text-white' : 'text-lapka-900'}`}>{t('app.name')}</span>
              {title ? <span className={`${isDark ? 'text-slate-300' : 'text-lapka-500'} text-xs font-semibold uppercase tracking-[0.18em]`}>{title}</span> : null}
            </span>
          </Link>

          <div className={`mt-4 flex items-start justify-between gap-3 ${compact ? 'hidden md:flex md:justify-center' : ''}`}>
            <div>
              {!compact && subtitle ? <p className={`max-w-[240px] text-[0.96rem] leading-relaxed ${isDark ? 'text-slate-300' : 'text-lapka-600'}`}>{subtitle}</p> : null}
            </div>
            <button
              type="button"
              className={isDark ? 'btn-ghost !px-3 !py-2 text-sm md:hidden !text-white' : 'btn-secondary !px-3 !py-2 text-sm md:hidden'}
              onClick={() => setMobileOpen((current) => !current)}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? t('sidebar.hideSections') : t('sidebar.showSections')}
            </button>
          </div>

          <div className={`mt-4 hidden gap-2 md:flex ${compact ? 'justify-center' : 'justify-between'}`}>
            <button type="button" className={isDark ? 'sidebar-mini-action sidebar-mini-action-dark' : 'sidebar-mini-action'} onClick={() => expandAll(true)} title="Раскрыть всё">
              + Все
            </button>
            {!compact ? (
              <button type="button" className={isDark ? 'sidebar-mini-action sidebar-mini-action-dark' : 'sidebar-mini-action'} onClick={() => expandAll(false)} title="Свернуть всё">
                – Все
              </button>
            ) : null}
            <button
              type="button"
              className={isDark ? 'sidebar-mini-action sidebar-mini-action-dark' : 'sidebar-mini-action'}
              onClick={() => onCompactChange(!compact)}
              title={compact ? 'Развернуть меню' : 'Компактный режим'}
            >
              {compact ? '→' : '⇤'}
            </button>
          </div>
        </div>

        <nav className={`mt-5 space-y-5 px-3 pb-4 md:px-4 md:pb-5 ${mobileOpen ? 'block' : 'hidden md:block'}`}>
          {normalizedGroups.map((group, groupIndex) => {
            const key = groupKey(group, groupIndex);
            const expanded = expandedGroups[key] ?? true;
            return (
            <section key={key} className="space-y-2.5">
              {groupTitle(group) ? (
                <button
                  type="button"
                  className={`sidebar-group-toggle ${isDark ? 'sidebar-group-toggle-dark' : ''} ${compact ? 'justify-center' : ''}`}
                  onClick={() => toggleGroup(key)}
                  title={groupTitle(group)}
                >
                  {!compact ? <span>{groupTitle(group)}</span> : null}
                  <span className={`transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}>⌄</span>
                </button>
              ) : null}
              <div className={`grid gap-1.5 ${expanded ? '' : 'hidden'}`}>
                {(group.links || []).map((link) => {
                  if (link.disabled) {
                    return (
                      <span
                        key={link.href || link.labelKey || link.label}
                        className={`sidebar-nav-link sidebar-nav-link-disabled ${isDark ? 'sidebar-nav-link-dark' : ''}`}
                        title={link.tooltip || (link.disabled ? t('common.inDevelopment') : '')}
                      >
                        <span className="flex items-center gap-3">
                          {link.icon ? <SidebarIcon name={link.icon} dark={isDark} /> : null}
                          <span className={compact ? 'hidden' : ''}>{label(link)}</span>
                        </span>
                      </span>
                    );
                  }

                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      prefetch={false}
                      className={`sidebar-nav-link ${isDark ? 'sidebar-nav-link-dark' : ''} ${active ? (isDark ? 'sidebar-nav-link-active-dark' : 'sidebar-nav-link-active') : ''} group`}
                      title={link.tooltip || ''}
                    >
                      <span
                        className={`absolute bottom-2 left-2 top-2 w-1 rounded-full transition ${
                          active ? (isDark ? 'bg-emerald-300/90' : 'bg-cyan-500/90') : 'bg-transparent'
                        }`}
                      />
                      <span className="flex items-center gap-3">
                        {link.icon ? <SidebarIcon name={link.icon} dark={isDark} /> : null}
                        <span className={compact ? 'hidden' : ''}>{label(link)}</span>
                      </span>
                      {active ? (
                        <span className={`h-2 w-2 rounded-full ${isDark ? 'bg-emerald-300 shadow-[0_0_0_4px_rgba(74,222,128,0.16)]' : 'bg-cyan-500 shadow-[0_0_0_4px_rgba(61,147,220,0.16)]'}`} />
                      ) : (
                        <span className={`h-2 w-2 rounded-full bg-transparent transition ${isDark ? 'group-hover:bg-white/30' : 'group-hover:bg-lapka-300'}`} />
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          )})}
        </nav>

        {/* Footer outside collapsible nav: SOS must work on mobile and in compact sidebar */}
        {footer ? (
          <div
            className={`relative z-20 border-t px-3 pb-5 pt-4 md:px-4 ${
              isDark ? 'border-white/10' : 'border-lapka-200/80'
            } ${compact ? 'sidebar-footer-compact' : ''}`}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
