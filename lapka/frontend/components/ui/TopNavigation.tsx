'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';

function toneClass(roleTone) {
  if (roleTone === 'vet') return 'bg-emerald-100 text-emerald-700';
  if (roleTone === 'clinic') return 'bg-amber-100 text-amber-700';
  return 'bg-cyan-100 text-cyan-700';
}

export default function TopNavigation({ links = [], roleTag, roleTone = 'owner', actions }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const isActive = (href) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="topbar-glass">
      <div className="page-wrap grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-3 md:flex md:flex-wrap md:items-center md:justify-between">
        <Link href="/" prefetch={false} className="flex shrink-0 items-center gap-2 text-3xl font-black tracking-tight text-lapka-900 md:text-4xl">
          <span className="h-8 w-8 shrink-0 rounded-full bg-[url('/assets/img/logo-paw.svg')] bg-contain bg-center bg-no-repeat" aria-hidden />
          {t('app.name')}
        </Link>

        <div className="col-start-2 row-start-1 ml-auto flex min-w-0 items-center justify-end gap-2 md:order-3 md:ml-0 md:shrink-0">
          <LanguageSwitcher />
          {roleTag ? (
            <span className={`hidden rounded-full px-3 py-1 text-xs font-bold shadow-sm md:inline-flex ${toneClass(roleTone)}`}>
              {roleTag}
            </span>
          ) : null}
          <div className="min-w-0">{actions}</div>
        </div>

        <nav className="col-span-2 order-3 flex min-w-0 items-center gap-1 overflow-x-auto rounded-2xl border border-lapka-200 bg-white/85 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] md:order-2 md:w-auto md:flex-1 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          {links.map((link) => (
            <Link key={link.href} href={link.href} prefetch={false} className={`nav-link shrink-0 ${isActive(link.href) ? 'nav-link-active' : ''}`}>
              {link.labelKey ? t(link.labelKey) : link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
