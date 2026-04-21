'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';

type LocalizedString = string | { ru?: string; en?: string };

interface MarketingPageProps {
  eyebrow?: LocalizedString;
  title?: LocalizedString;
  subtitle?: LocalizedString;
  bullets?: LocalizedString[];
  ctaHref?: string;
  ctaLabel?: LocalizedString;
  sideImage?: string;
  cards?: Array<{ title?: LocalizedString; subtitle?: LocalizedString; href?: string; icon?: string }>;
  sideImageAlt?: string;
  primaryCtaLabel?: LocalizedString;
}

export default function MarketingPage({
  eyebrow = 'Платформа Лапка',
  title,
  subtitle,
  bullets = [],
  ctaHref = '/login?role=owner',
  ctaLabel = 'Открыть демо',
  sideImage = '/assets/img/hero-family.svg',
  cards = [],
  sideImageAlt,
  primaryCtaLabel
}: MarketingPageProps) {
  const { t, i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const lang = langCode.startsWith('en') ? 'en' : 'ru';
  const resolveText = (value: LocalizedString): string => {
    if (value && typeof value === 'object') {
      return value[lang as keyof typeof value] || value.ru || value.en || '';
    }
    return value || '';
  };
  const resolveList = (value: LocalizedString[]): string[] => (Array.isArray(value) ? value.map(resolveText) : []);
  const resolveCards = (value: MarketingPageProps['cards']) =>
    (Array.isArray(value) ? value : []).map((card) => ({
      ...card,
      title: resolveText(card?.title),
      subtitle: resolveText(card?.subtitle),
    }));

  const eyebrowText = resolveText(eyebrow);
  const titleText = resolveText(title);
  const subtitleText = resolveText(subtitle);
  const ctaLabelText = resolveText(ctaLabel);
  const primaryCtaLabelText = resolveText(primaryCtaLabel);
  const bulletsList = resolveList(bullets);
  const cardsList = resolveCards(cards);

  return (
    <main className="page-wrap space-y-8 py-6 pb-10 md:space-y-10 md:py-8">
      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6 md:p-8">
          <p className="pill">{eyebrowText}</p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-lapka-900 md:text-6xl">{titleText}</h1>
          <p className="mt-4 max-w-3xl text-lg text-lapka-700 md:text-xl">{subtitleText}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/login?role=owner" className="btn-primary">{primaryCtaLabelText || t('marketing.createPetProfile')}</Link>
            <Link href={ctaHref} className="btn-secondary">{ctaLabelText}</Link>
          </div>

          {bulletsList.length ? (
            <ul className="mt-6 grid gap-2 text-sm text-lapka-700 md:grid-cols-2">
              {bulletsList.map((item) => (
                <li key={item} className="rounded-xl border border-lapka-200 bg-white px-3 py-2">{item}</li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="relative h-full min-h-[280px] w-full">
            <Image
              src={sideImage}
              alt={sideImageAlt || t('app.name')}
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        </Card>
      </section>

      {cardsList.length ? (
        <section className="grid-soft-3">
          {cardsList.map((card) => (
            <Card key={card.title} title={card.title} subtitle={card.subtitle}>
              {card.href ? <Link href={card.href} className="btn-secondary">{t('marketing.learnMore')}</Link> : null}
            </Card>
          ))}
        </section>
      ) : null}
    </main>
  );
}
