'use client';

import AppImage from '@/components/ui/AppImage';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';

export default function MapComponent() {
  const { t } = useTranslation();
  const points = [
    ['VetCity', t('mapWidget.clinic'), 'ул. Центральная, 5'],
    ['Питомец+', t('mapWidget.pharmacy'), 'пр-т Мира, 14'],
    ['DogGarden', t('mapWidget.park'), 'Парк Северный'],
    ['Зоомаркет Хвост', t('mapWidget.petStore'), 'ул. Лесная, 9']
  ];

  return (
    <Card title={t('mapWidget.title')} subtitle={t('mapWidget.subtitle')}>
      <div className="grid gap-3 md:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-lapka-200 bg-white p-3">
          <AppImage
            src="/assets/img/map-hero-v2.svg"
            alt={t('mapWidget.imageAlt')}
            width={1200}
            height={900}
            sizes="(max-width: 768px) 100vw, 560px"
            className="h-52 w-full rounded-xl object-cover"
          />
        </div>
        <ul className="space-y-2">
          {points.map((point) => (
            <li key={point.join('-')} className="rounded-xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700">
              <p className="font-semibold text-lapka-900">{point[0]}</p>
              <p>{point[1]} · {point[2]}</p>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
