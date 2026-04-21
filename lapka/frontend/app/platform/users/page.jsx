'use client';

import Card from '@/components/ui/Card';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { useTranslation } from 'react-i18next';

export default function PlatformUsersPage() {
  const { t } = useTranslation('common');

  const accessRoles = [
    {
      id: 'owner',
      title: t('platform.usersPage.roleOwnerTitle'),
      label: t('platform.usersPage.roleOwnerLabel'),
    },
    {
      id: 'vet',
      title: t('platform.usersPage.roleVetTitle'),
      label: t('platform.usersPage.roleVetLabel'),
    },
    {
      id: 'clinic',
      title: t('platform.usersPage.roleClinicTitle'),
      label: t('platform.usersPage.roleClinicLabel'),
    },
    {
      id: 'network',
      title: t('platform.usersPage.roleNetworkTitle'),
      label: t('platform.usersPage.roleNetworkLabel'),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('platform.usersPage.headerTitle')}</h1>
          <p className="page-subtitle">{t('platform.usersPage.headerSubtitle')}</p>
        </div>
      </header>
      <ShowcasePanel
        eyebrow={t('platform.usersPage.showcaseEyebrow')}
        title={t('platform.usersPage.showcaseTitle')}
        description={t('platform.usersPage.showcaseDescription')}
        imageSrc="/assets/img/admin-side.svg"
        imageAlt={t('platform.usersPage.showcaseImageAlt')}
        badges={[
          t('platform.usersPage.badgeRbac'),
          t('platform.usersPage.badgeOrganizations'),
          t('platform.usersPage.badgeActivation'),
          t('platform.usersPage.badgeAudit'),
        ]}
        compact
      />
      <Card title={t('platform.usersPage.accessModelTitle')} subtitle={t('platform.usersPage.accessModelSubtitle')}>
        <div className="grid gap-3 md:grid-cols-2">
          {accessRoles.map((role) => (
            <div key={role.id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">{role.title}</p>
              <p className="mt-2 text-lg font-bold text-lapka-900">{role.label}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
