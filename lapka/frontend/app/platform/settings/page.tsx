'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { useTranslation } from 'react-i18next';

export default function PlatformSettingsPage() {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('platform.settingsPage.headerTitle')}</h1>
          <p className="page-subtitle">{t('platform.settingsPage.headerSubtitle')}</p>
        </div>
      </header>

      <ShowcasePanel
        eyebrow={t('platform.settingsPage.showcaseEyebrow')}
        title={t('platform.settingsPage.showcaseTitle')}
        description={t('platform.settingsPage.showcaseDescription')}
        imageSrc="/assets/img/clinic-ops.svg"
        imageAlt={t('platform.settingsPage.showcaseImageAlt')}
        badges={[
          t('platform.settingsPage.badgeNetwork'),
          t('platform.settingsPage.badgeBranches'),
          t('platform.settingsPage.badgeFlags'),
        ]}
      />

      <Card
        title={t('platform.settingsPage.llmCloudReservedTitle')}
        subtitle={t('platform.settingsPage.llmCloudReservedSubtitle')}
      >
        <div className="rounded-[22px] border border-dashed border-lapka-300/90 bg-lapka-50/80 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-lapka-800">{t('platform.settingsPage.llmCloudReservedBody')}</p>
            <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
              {t('platform.settingsPage.llmCloudReservedBadge')}
            </span>
          </div>
          <p className="mt-3 text-xs text-lapka-600">
            <Link href="/platform/ai" className="font-semibold text-lapka-800 underline-offset-2 hover:underline">
              {t('platform.settingsPage.llmCloudReservedLink')}
            </Link>
          </p>
        </div>
      </Card>

      <Card title={t('platform.settingsPage.systemLayerTitle')} subtitle={t('platform.settingsPage.systemLayerSubtitle')}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">{t('platform.settingsPage.baseBrandTitle')}</p>
            <p className="mt-2 text-lg font-bold text-lapka-900">{t('platform.settingsPage.baseBrandText')}</p>
          </div>
          <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">{t('platform.settingsPage.featureFlagsTitle')}</p>
            <p className="mt-2 text-lg font-bold text-lapka-900">{t('platform.settingsPage.featureFlagsText')}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
