'use client';

import { useTranslation } from 'react-i18next';
import MarketingPage from '@/components/blocks/MarketingPage';

export default function MapPage() {
  const { t } = useTranslation();

  return (
    <MarketingPage
      eyebrow={t('marketing.map.eyebrow')}
      title={t('marketing.map.title')}
      subtitle={t('marketing.map.subtitle')}
      bullets={[
        t('marketing.map.bullets.filters'),
        t('marketing.map.bullets.linking'),
        t('marketing.map.bullets.booking')
      ]}
      ctaHref="/public-booking"
      ctaLabel={t('marketing.map.cta')}
      sideImage="/assets/img/map-hero-v2.svg"
      sideImageAlt={t('marketing.map.imageAlt')}
      cards={[
        { title: 'VetCity', subtitle: t('marketing.map.cards.clinic') },
        { title: 'Питомец+', subtitle: t('marketing.map.cards.pharmacy') },
        { title: 'DogGarden', subtitle: t('marketing.map.cards.park') }
      ]}
    />
  );
}
