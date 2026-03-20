'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/ui/Sidebar';
import OfflineModeBanner from '@/components/ui/OfflineModeBanner';
import WorkspaceHeader from '@/components/ui/WorkspaceHeader';

export default function AppLayout({
  roleLabel,
  roleTone,
  topLinks,
  sidebarTitle,
  sidebarSubtitle,
  sidebarLinks,
  sidebarGroups,
  sidebarFooter,
  sidebarVariant,
  headerAction,
  headerContext,
  workspaceTitle,
  rightColumn,
  children
}) {
  const compactStorageKey = `lapka.sidebar.compact.${roleLabel || 'workspace'}`;
  const [sidebarCompact, setSidebarCompact] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setSidebarCompact(window.localStorage.getItem(compactStorageKey) === '1');
    } catch {
      setSidebarCompact(false);
    }
  }, [compactStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(compactStorageKey, sidebarCompact ? '1' : '0');
    } catch {
      // ignore storage failures
    }
  }, [compactStorageKey, sidebarCompact]);

  const groupedLinks = (sidebarGroups || []).flatMap((group) => group.links || []);
  const quickLinks = groupedLinks.length ? groupedLinks : (sidebarLinks || []);
  const sidebarWidth = sidebarCompact ? '112px' : '292px';
  const layoutGridClass = rightColumn
    ? 'grid min-w-0 grid-cols-1 gap-6 overflow-x-hidden xl:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] min-[1900px]:grid-cols-[var(--sidebar-width)_minmax(0,1fr)_340px]'
    : 'grid min-w-0 grid-cols-1 gap-6 overflow-x-hidden xl:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]';

  return (
    <>
      <WorkspaceHeader
        links={quickLinks}
        primaryAction={headerAction}
        contextControls={headerContext}
        workspaceTitle={workspaceTitle}
      />

      <main className="page-wrap py-5 pb-10 md:py-6">
        <div className="mb-4 space-y-2">
          <OfflineModeBanner />
        </div>
        <div className={layoutGridClass} style={{ '--sidebar-width': sidebarWidth }}>
          <Sidebar
            title={sidebarTitle}
            subtitle={sidebarSubtitle}
            links={sidebarLinks}
            groups={sidebarGroups}
            variant={sidebarVariant}
            footer={sidebarFooter}
            homeHref={
              roleLabel === 'owner'
                ? '/owner/dashboard'
                : roleLabel === 'vet'
                  ? '/vet/dashboard'
                  : roleLabel === 'network_admin'
                    ? '/platform/dashboard'
                    : '/clinic/dashboard'
            }
            compact={sidebarCompact}
            onCompactChange={setSidebarCompact}
            storageId={roleLabel || 'workspace'}
          />

          <section className="min-w-0 space-y-5 overflow-hidden md:space-y-7">
            {children}
            {rightColumn ? <div className="space-y-4 min-[1900px]:hidden">{rightColumn}</div> : null}
          </section>

          {rightColumn ? (
            <aside className="hidden min-w-0 space-y-4 min-[1900px]:sticky min-[1900px]:top-[108px] min-[1900px]:block min-[1900px]:self-start">{rightColumn}</aside>
          ) : null}
        </div>
      </main>
    </>
  );
}
