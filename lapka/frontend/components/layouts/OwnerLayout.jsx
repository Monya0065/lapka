'use client';

import Link from 'next/link';
import AppLayout from '@/components/layouts/AppLayout';
import RoleGate from '@/components/auth/RoleGate';
import { OWNER_SIDEBAR_GROUPS } from '@/lib/owner-workspace';

export default function OwnerLayout({ children }) {
  return (
    <RoleGate allowedRoles={['owner']}>
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
            <Link href="/owner/triage?mode=sos" prefetch={false} className="btn-danger w-full !justify-start !min-h-[42px] !py-2 text-sm">
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
    </RoleGate>
  );
}
