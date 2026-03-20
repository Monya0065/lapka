'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import TopNavigation from '@/components/ui/TopNavigation';
import AuthDropdown from '@/components/auth/AuthDropdown';
import DemoModeBanner from '@/components/ui/DemoModeBanner';
import TryDemoWidget from '@/components/ui/TryDemoWidget';

const links = [
  { href: '/', labelKey: 'nav.home' },
  { href: '/about', labelKey: 'nav.about' },
  { href: '/for-owners', labelKey: 'nav.forOwners' },
  { href: '/for-vets', labelKey: 'nav.forVets' },
  { href: '/for-clinics', labelKey: 'nav.forClinics' },
  { href: '/security', labelKey: 'nav.security' },
];

export default function LoginPageClient({ role = 'owner', nextUrl = '' }) {
  const { t } = useTranslation();

  return (
    <>
      <TopNavigation links={links} />
      <main className="page-wrap py-6 pb-10 md:py-8">
        <section className="mb-4">
          <DemoModeBanner />
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <article className="surface-card p-6 md:p-8">
            <p className="pill">{t('login.eyebrow')}</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-lapka-900">{t('login.title')}</h1>
            <p className="mt-3 text-lapka-700">{t('login.subtitle')}</p>

            {nextUrl ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {t('login.redirectNotice')}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/owner/dashboard" className="btn-secondary">{t('login.ownerCabinet')}</Link>
              <Link href="/vet/dashboard" className="btn-secondary">{t('login.vetCabinet')}</Link>
              <Link href="/clinic/dashboard" className="btn-secondary">{t('login.clinicCrm')}</Link>
            </div>

            <div className="mt-5 rounded-2xl border border-lapka-200 bg-lapka-50 p-3 text-sm text-lapka-700">
              <p className="font-semibold text-lapka-900">{t('login.tryScenarios')}:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>{t('login.ownerScenario')}</li>
                <li>{t('login.vetScenario')}</li>
                <li>{t('login.clinicScenario')}</li>
              </ul>
            </div>

            <div className="mt-4">
              <TryDemoWidget initialRole={role} />
            </div>
          </article>

          <AuthDropdown mode="card" initialRole={role} />
        </section>
      </main>
    </>
  );
}
