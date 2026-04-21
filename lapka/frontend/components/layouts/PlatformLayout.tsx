'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layouts/AppLayout';
import RoleGate from '@/components/auth/RoleGate';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import ClinicScopeSwitcher from '@/components/ui/ClinicScopeSwitcher';
import { PLATFORM_SIDEBAR_GROUPS } from '@/lib/platform-workspace';

export default function PlatformLayout({ children }) {
  const { t } = useTranslation();
  return (
    <RoleGate allowedRoles={['network_admin']}>
      <AppLayout
        roleLabel="network_admin"
        roleTone="clinic"
        workspaceTitle={t('platform.workspaceUi.workspaceTitle')}
        sidebarTitle={t('platform.workspaceUi.sidebarRoleTitle')}
        sidebarSubtitle={t('platform.workspaceUi.sidebarSubtitle')}
        sidebarVariant="workspace-dark"
        sidebarGroups={PLATFORM_SIDEBAR_GROUPS}
        headerContext={<ClinicScopeSwitcher showBranchHint />}
        headerAction={
          <Link href="/platform/clinics" prefetch={false} className="btn-primary workspace-header-cta">
            {t('platform.workspaceUi.addClinic')}
          </Link>
        }
        sidebarFooter={
          <div className="grid gap-2">
            <Link href="/platform/ai" prefetch={false} className="btn-secondary w-full !justify-start">
              {t('platform.workspaceUi.sidebarAiCenter')}
            </Link>
            <Link href="/platform/security" prefetch={false} className="btn-secondary w-full !justify-start">
              {t('platform.workspaceUi.sidebarAuditSecurity')}
            </Link>
          </div>
        }
        rightColumn={(
          <>
            <Card title={t('platform.workspaceUi.railTitle')} subtitle={t('platform.workspaceUi.railSubtitle')}>
              <div className="grid gap-2">
                <Link href="/platform/clinics" prefetch={false} className="btn-secondary justify-start">
                  {t('platform.workspaceUi.railLinkClinics')}
                </Link>
                <Link href="/platform/users" prefetch={false} className="btn-secondary justify-start">
                  {t('platform.workspaceUi.railLinkUsers')}
                </Link>
                <Link href="/platform/templates" prefetch={false} className="btn-secondary justify-start">
                  {t('platform.workspaceUi.railLinkContent')}
                </Link>
              </div>
            </Card>
            <Alert tone="info">{t('platform.workspaceUi.railAlert')}</Alert>
          </>
        )}
      >
        {children}
      </AppLayout>
    </RoleGate>
  );
}
