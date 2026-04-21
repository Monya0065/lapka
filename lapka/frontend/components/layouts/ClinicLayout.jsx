'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layouts/AppLayout';
import RoleGate from '@/components/auth/RoleGate';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import ClinicScopeSwitcher from '@/components/ui/ClinicScopeSwitcher';
import { CLINIC_SIDEBAR_GROUPS } from '@/lib/clinic-workspace';
import { useClinicScope } from '@/lib/clinic-scope';

export default function ClinicLayout({ children }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { selectedClinic, selectedBranch } = useClinicScope();

  const showContextRail = pathname?.startsWith('/clinic/analytics')
    || pathname?.startsWith('/clinic/inpatient/')
    || pathname?.startsWith('/clinic/billing/');

  return (
    <RoleGate allowedRoles={['clinic_admin']}>
      <AppLayout
        roleLabel="clinic_admin"
        roleTone="clinic"
        workspaceTitle={t('clinic.workspaceUi.workspaceTitle')}
        sidebarTitle={t('clinic.workspaceUi.sidebarRoleTitle')}
        sidebarSubtitle={t('clinic.workspaceUi.sidebarSubtitle')}
        sidebarVariant="workspace-dark"
        sidebarGroups={CLINIC_SIDEBAR_GROUPS}
        headerContext={<ClinicScopeSwitcher showBranchHint />}
        headerAction={
          <Link href="/clinic/schedule" prefetch={false} className="btn-primary workspace-header-cta">
            {t('clinic.workspaceUi.newBooking')}
          </Link>
        }
        sidebarFooter={
          <div className="grid gap-2">
            <Link href="/clinic/checkin" prefetch={false} className="btn-primary w-full !justify-start">
              {t('clinic.workspaceUi.sidebarReceptionRegistration')}
            </Link>
            <Link href="/clinic/inpatient" prefetch={false} className="btn-secondary w-full !justify-start">
              {t('nav.inpatient')}
            </Link>
          </div>
        }
        rightColumn={showContextRail ? (
          <>
            <Card className="overflow-hidden p-0">
              <div className="relative h-40 w-full">
                <Image src="/assets/img/admin-side.svg" alt={t('clinic.workspaceUi.sideImageAlt')} fill sizes="360px" className="object-cover" />
              </div>
              <div className="p-4">
                <h3 className="text-2xl font-black tracking-tight text-lapka-900">{selectedClinic?.name || t('clinic.demoClinic')}</h3>
                <p className="mt-1 text-sm text-lapka-600">{t('clinic.workspaceUi.opsCardSubtitle')}</p>
                {selectedBranch ? (
                  <p className="mt-2 text-xs text-lapka-500">
                    {t('clinic.workspaceUi.activeBranch', { address: selectedBranch.address })}
                  </p>
                ) : null}
              </div>
            </Card>
            <Card title={t('clinic.quickActions')}>
              <div className="grid gap-2">
                <Link href="/clinic/schedule" prefetch={false} className="btn-secondary justify-start">
                  {t('nav.createAppointment')}
                </Link>
                <Link href="/clinic/doctors" prefetch={false} className="btn-secondary justify-start">
                  {t('clinic.workspaceUi.openTeam')}
                </Link>
                <Link href="/clinic/services" prefetch={false} className="btn-secondary justify-start">
                  {t('nav.services')}
                </Link>
                <Link href="/clinic/templates" prefetch={false} className="btn-secondary justify-start">
                  {t('nav.templates')}
                </Link>
              </div>
            </Card>
            <Alert tone="info">{t('clinic.workspaceUi.adminReadOnlyAlert')}</Alert>
          </>
        ) : null}
      >
        {children}
      </AppLayout>
    </RoleGate>
  );
}
