'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { demoCredentialsRows, DEMO_ROLE_ORDER, DEMO_SCENARIOS } from '@/lib/demoMode';

export default function DemoModeBanner({ compact = false }) {
  const { t } = useTranslation();
  const credentials = demoCredentialsRows();

  function roleLabel(role) {
    if (role === 'vet') return t('roles.vet');
    if (role === 'clinic_admin') return t('roles.clinicAdmin');
    return t('roles.owner');
  }

  if (compact) {
    return (
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
        {t('demo.compactHint')} · пароль <span className="font-semibold">demo12345</span>
      </div>
    );
  }

  return (
    <div className="surface-card border-cyan-200 bg-gradient-to-r from-cyan-50 to-emerald-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">{t('demo.mode')}</p>
      <h3 className="mt-1 text-xl font-extrabold tracking-tight text-lapka-900">{t('demo.bannerTitle')}</h3>
      <div className="mt-3 grid gap-2 text-sm text-lapka-800 sm:grid-cols-3">
        {credentials.map((row) => (
          <div key={row.role} className="rounded-xl border border-lapka-200 bg-white p-3">
            <p className="font-semibold">{roleLabel(row.role)}</p>
            <p>{row.email}</p>
            <p className="font-mono text-xs">{row.password}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {DEMO_ROLE_ORDER.map((role) => {
          const scenario = DEMO_SCENARIOS[role];
          return (
            <div key={role} className="rounded-xl border border-lapka-200 bg-white p-3">
              <p className="text-sm font-bold text-lapka-900">{t(`demo.${role}.roleLabel`)}</p>
              <p className="mt-1 text-xs text-lapka-600">{t(`demo.${role}.description`)}</p>
              <Link href={scenario.startHref} className="btn-secondary mt-2 w-full text-xs">
                {t('demo.startScenario')}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
