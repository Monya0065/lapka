'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';

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
}) {
  const { t } = useTranslation();

  return (
    <main className="page-wrap space-y-8 py-6 pb-10 md:space-y-10 md:py-8">
      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6 md:p-8">
          <p className="pill">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-lapka-900 md:text-6xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg text-lapka-700 md:text-xl">{subtitle}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/login?role=owner" className="btn-primary">{primaryCtaLabel || t('marketing.createPetProfile')}</Link>
            <Link href={ctaHref} className="btn-secondary">{ctaLabel}</Link>
          </div>

          {bullets.length ? (
            <ul className="mt-6 grid gap-2 text-sm text-lapka-700 md:grid-cols-2">
              {bullets.map((item) => (
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

      {cards.length ? (
        <section className="grid-soft-3">
          {cards.map((card) => (
            <Card key={card.title} title={card.title} subtitle={card.subtitle}>
              {card.href ? <Link href={card.href} className="btn-secondary">{t('marketing.learnMore')}</Link> : null}
            </Card>
          ))}
        </section>
      ) : null}
    </main>
  );
}
