'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEMO_ROLE_ORDER, DEMO_SCENARIOS } from '@/lib/demoMode';

export default function TryDemoWidget({ initialRole = 'owner' }) {
  const { t } = useTranslation();
  const [role, setRole] = useState(initialRole in DEMO_SCENARIOS ? initialRole : 'owner');
  const scenario = DEMO_SCENARIOS[role];

  return (
    <div className="surface-card border-cyan-200 bg-white/95 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">{t('demo.tryDemo')}</p>
          <h3 className="text-lg font-extrabold tracking-tight text-lapka-900">{t('demo.guidedSteps')}</h3>
        </div>
        <Link href={scenario.startHref} className="btn-primary text-xs">
          {t('demo.start')}
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {DEMO_ROLE_ORDER.map((itemRole) => (
          <button
            key={itemRole}
            type="button"
            onClick={() => setRole(itemRole)}
            className={itemRole === role ? 'btn-primary !px-3 !py-1 text-xs' : 'btn-secondary !px-3 !py-1 text-xs'}
          >
            {t(`demo.${itemRole}.roleLabel`)}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-lapka-200 bg-lapka-50 p-3">
        <p className="text-sm font-semibold text-lapka-900">{t(`demo.${role}.title`)}</p>
        <p className="mt-1 text-xs text-lapka-600">{t(`demo.${role}.description`)}</p>
        <ol className="mt-3 space-y-2">
          {scenario.steps.map((step, index) => (
            <li key={`${role}-${step.href}`} className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-lapka-700">
                {index + 1}
              </span>
              <Link href={step.href} className="text-sm font-medium text-lapka-800 transition hover:text-cyan-700">
                {t(`demo.${role}.steps.${step.key}`)}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
