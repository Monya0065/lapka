'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { DEMO_ROLE_ORDER, DEMO_SCENARIOS, resolveDemoRoleFromPath } from '@/lib/demoMode';

export default function DemoHelperCard({ inline = false }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const resolvedRole = useMemo(() => resolveDemoRoleFromPath(pathname || ''), [pathname]);
  const [collapsed, setCollapsed] = useState(Boolean(inline));
  const [role, setRole] = useState(resolvedRole);
  const scenario = DEMO_SCENARIOS[role] || DEMO_SCENARIOS.owner;

  useEffect(() => {
    setRole(resolvedRole);
  }, [resolvedRole]);

  return (
    <div className={inline ? 'w-full' : 'fixed bottom-4 right-4 z-[70] w-[min(92vw,340px)]'}>
      <div className={`surface-card border-cyan-200 p-3 ${inline ? 'bg-white' : 'bg-white/95 shadow-float backdrop-blur'}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">{t('demo.helperEyebrow')}</p>
          <button
            type="button"
            className="btn-secondary !px-2 !py-1 text-xs"
            onClick={() => setCollapsed((prev) => !prev)}
            title={collapsed ? t('demo.show') : t('demo.hide')}
          >
            {collapsed ? t('demo.show') : t('demo.hide')}
          </button>
        </div>

        {!collapsed ? (
          <>
            <h4 className="mt-2 text-base font-extrabold tracking-tight text-lapka-900">{t('demo.helperTitle')}</h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DEMO_ROLE_ORDER.map((itemRole) => (
                <button
                  key={itemRole}
                  type="button"
                  onClick={() => setRole(itemRole)}
                  className={itemRole === role ? 'btn-primary !px-2.5 !py-1 text-xs' : 'btn-secondary !px-2.5 !py-1 text-xs'}
                >
                  {t(`demo.${itemRole}.roleLabel`)}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {scenario.steps.slice(0, 4).map((action) => (
                <Link key={`${role}-${action.href}`} href={action.href} className="btn-secondary w-full justify-start text-sm">
                  {t(`demo.${role}.steps.${action.key}`)}
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
