'use client';

import LegalCenterPage from '@/components/legal/LegalCenterPage';
import { useTranslation } from 'react-i18next';

export default function PlatformLegalCenterPage() {
  const { t } = useTranslation('common');

  return (
    <LegalCenterPage
      title={t('platform.legalPage.title')}
      subtitle={t('platform.legalPage.subtitle')}
      operationalTitle={t('platform.legalPage.operationalTitle')}
      operationalCards={[
        {
          title: t('platform.legalPage.cardUnconfirmedTitle'),
          value: 'LEGAL',
          text: t('platform.legalPage.cardUnconfirmedText'),
          href: '/platform/security',
          tone: 'text-amber-700 dark:text-amber-300',
        },
        {
          title: t('platform.legalPage.cardAuditTitle'),
          value: 'AUDIT',
          text: t('platform.legalPage.cardAuditText'),
          href: '/platform/inbox',
          tone: 'text-rose-700 dark:text-rose-300',
        },
        {
          title: t('platform.legalPage.cardPoliciesAiTitle'),
          value: 'SAFE',
          text: t('platform.legalPage.cardPoliciesAiText'),
          href: '/platform/ai',
          tone: 'text-violet-700 dark:text-violet-300',
        },
      ]}
    />
  );
}
