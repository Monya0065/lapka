'use client';

import Card from '@/components/ui/Card';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { useTranslation } from 'react-i18next';

export default function PlatformSecurityPage() {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('platform.securityPage.headerTitle')}</h1>
          <p className="page-subtitle">{t('platform.securityPage.headerSubtitle')}</p>
        </div>
      </header>

      <ShowcasePanel
        eyebrow={t('platform.securityPage.showcaseEyebrow')}
        title={t('platform.securityPage.showcaseTitle')}
        description={t('platform.securityPage.showcaseDescription')}
        imageSrc="/assets/img/admin-side.svg"
        imageAlt={t('platform.securityPage.showcaseImageAlt')}
        badges={[
          t('platform.securityPage.badgeRbac'),
          t('platform.securityPage.badgeAiPolicies'),
          t('platform.securityPage.badgePublicLinks'),
          t('platform.securityPage.badgeSystemAudit'),
        ]}
      />

      <section className="grid gap-4 2xl:grid-cols-3">
        <Card title={t('platform.securityPage.cardControlledTitle')}>
          <ul className="space-y-2 text-sm text-lapka-700">
            <li>{t('platform.securityPage.controlledItem1')}</li>
            <li>{t('platform.securityPage.controlledItem2')}</li>
            <li>{t('platform.securityPage.controlledItem3')}</li>
          </ul>
        </Card>
        <Card title={t('platform.securityPage.cardVisibleTitle')}>
          <ul className="space-y-2 text-sm text-lapka-700">
            <li>{t('platform.securityPage.visibleItem1')}</li>
            <li>{t('platform.securityPage.visibleItem2')}</li>
            <li>{t('platform.securityPage.visibleItem3')}</li>
          </ul>
        </Card>
        <Card title={t('platform.securityPage.cardNextLayerTitle')}>
          <ul className="space-y-2 text-sm text-lapka-700">
            <li>{t('platform.securityPage.nextLayerItem1')}</li>
            <li>{t('platform.securityPage.nextLayerItem2')}</li>
            <li>{t('platform.securityPage.nextLayerItem3')}</li>
          </ul>
        </Card>
      </section>

      <Card title={t('platform.securityPage.securityControlTitle')} subtitle={t('platform.securityPage.securityControlSubtitle')}>
        <ul className="space-y-3 text-sm text-lapka-700">
          <li>{t('platform.securityPage.securityControlItem1')}</li>
          <li>{t('platform.securityPage.securityControlItem2')}</li>
          <li>{t('platform.securityPage.securityControlItem3')}</li>
          <li>{t('platform.securityPage.securityControlItem4')}</li>
        </ul>
      </Card>
    </div>
  );
}
