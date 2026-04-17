'use client';

import Link from 'next/link';
import AppLayout from '@/components/layouts/AppLayout';
import RoleGate from '@/components/auth/RoleGate';
import { OWNER_SIDEBAR_GROUPS } from '@/lib/owner-workspace';

export default function OwnerLayout({ children }) {
  return (
    <RoleGate allowedRoles={['owner']}>
      <>
        <AppLayout
          roleLabel="owner"
          roleTone="owner"
          workspaceTitle="Питомцы и здоровье"
          sidebarTitle="Lapka"
          sidebarSubtitle="Здоровье питомцев: медкарта, лекарства, визиты и сервисы."
          sidebarVariant="workspace-dark"
          sidebarGroups={OWNER_SIDEBAR_GROUPS}
          headerAction={
            <Link href="/owner/pets?add=1" prefetch={false} className="btn-primary workspace-header-cta">
              + Питомец
            </Link>
          }
          sidebarFooter={
            <div className="grid gap-2">
              <Link href="/owner/quick-triage" prefetch={false} className="btn-danger relative z-10 w-full !justify-start !min-h-[42px] !py-2 text-sm">
                SOS
              </Link>
              <div className="grid grid-cols-2 gap-1.5">
                <Link href="/owner/care" prefetch={false} className="btn-secondary !min-h-[38px] !py-2 text-sm !justify-center">Уход</Link>
                <Link href="/owner/tools/calculators" prefetch={false} className="btn-secondary !min-h-[38px] !py-2 text-sm !justify-center">Калькуляторы</Link>
                <Link href="/owner/knowledge" prefetch={false} className="btn-secondary !min-h-[38px] !py-2 text-sm !justify-center">Знания</Link>
                <Link href="/owner/profile" prefetch={false} className="btn-secondary !min-h-[38px] !py-2 text-sm !justify-center col-span-2">Профиль</Link>
              </div>
            </div>
          }
        >
          {children}
        </AppLayout>
        {/* Plain <a>: works even if a client subtree failed hydration; always on top on small screens */}
        <a
          href="/owner/quick-triage"
          className="fixed bottom-4 right-4 z-[100] flex h-14 min-w-[3.5rem] items-center justify-center rounded-2xl border-2 border-white bg-rose-600 px-3 text-sm font-black uppercase tracking-wide text-white shadow-[0_8px_30px_rgba(190,18,60,0.45)] xl:hidden"
          aria-label="SOS — срочная помощь"
        >
          SOS
        </a>
      </>
    </RoleGate>
  );
}
