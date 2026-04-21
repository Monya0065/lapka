'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layouts/AppLayout';
import RoleGate from '@/components/auth/RoleGate';
import Card from '@/components/ui/Card';
import AIWidget from '@/components/ui/AIWidget';
import Alert from '@/components/ui/Alert';
import ClinicScopeSwitcher from '@/components/ui/ClinicScopeSwitcher';
import VetMobileQuickActions from '@/components/ui/VetMobileQuickActions';
import { VET_SIDEBAR_GROUPS, VET_SHIFT_TASK_KEYS } from '@/lib/vet-workspace';
import { useClinicScope } from '@/lib/clinic-scope';

export default function VetLayout({ children }) {
  const { t } = useTranslation();
  const pathname = usePathname();

  const { selectedBranch } = useClinicScope();

  const showContextRail = pathname?.startsWith('/vet/visit/')
    || pathname?.startsWith('/vet/inpatient/')
    || pathname?.startsWith('/vet/drugs/');

  return (
    <RoleGate allowedRoles={['vet']}>
      <AppLayout
        roleLabel="vet"
        roleTone="vet"
        workspaceTitle={t('vet.workspaceUi.workspaceTitle')}
        sidebarTitle={t('vet.workspaceUi.sidebarRoleTitle')}
        sidebarSubtitle={t('vet.workspaceUi.sidebarSubtitle')}
        sidebarVariant="workspace-dark"
        sidebarGroups={VET_SIDEBAR_GROUPS}
        headerContext={<ClinicScopeSwitcher showBranchHint />}
        headerAction={
          <Link href="/vet/patients" prefetch={false} className="btn-primary workspace-header-cta">
            {t('vet.workspaceUi.startVisit')}
          </Link>
        }
        sidebarFooter={
          <div className="grid gap-2">
            <Link href="/vet/patients" prefetch={false} className="btn-secondary w-full !justify-start">
              {t('vet.workspaceUi.findPatient')}
            </Link>
            <Link href="/vet/appointments" prefetch={false} className="btn-secondary w-full !justify-start">
              {t('vet.workspaceUi.sidebarCheckinFlow')}
            </Link>
          </div>
        }
        rightColumn={showContextRail ? (
          <>
            <Card className="overflow-hidden p-0">
              <div className="relative h-40 w-full">
                <Image src="/assets/img/vet-side.svg" alt={t('vet.workspaceUi.sideImageAlt')} fill sizes="360px" className="object-cover" />
              </div>
              <div className="p-4">
                <h3 className="text-2xl font-black tracking-tight text-lapka-900">{t('vet.workspaceUi.shiftCardTitle')}</h3>
                <p className="mt-1 text-sm text-lapka-600">{t('vet.workspaceUi.shiftCardSubtitle')}</p>
                {selectedBranch ? (
                  <p className="mt-2 text-xs text-lapka-500">
                    {t('vet.workspaceUi.branchLabel', { address: selectedBranch.address })}
                  </p>
                ) : null}
              </div>
            </Card>
            <AIWidget title={t('vet.workspaceUi.aiTitle')} subtitle={t('vet.workspaceUi.aiSubtitle')} mode="vet" />
            <Alert tone="warning">{t('vet.workspaceUi.redFlagsAlert')}</Alert>
            <Card title={t('vet.workspaceUi.criticalTasksTitle')} subtitle={t('vet.workspaceUi.criticalTasksSubtitle')}>
              <ul className="space-y-2 text-sm text-lapka-700">
                {VET_SHIFT_TASK_KEYS.map((key) => (
                  <li key={key}>• {t(key)}</li>
                ))}
              </ul>
            </Card>
          </>
        ) : null}
      >
        {children}
      </AppLayout>
      <VetMobileQuickActions />
    </RoleGate>
  );
}
