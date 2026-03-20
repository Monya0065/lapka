'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import OwnerPetSwitcher from '@/components/ui/OwnerPetSwitcher';

export default function OwnerPetTabs({ id }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const items = [
    { href: `/owner/pet/${id}`, labelKey: 'pet.profile' },
    { href: `/owner/pet/${id}/passport`, labelKey: 'pet.passport' },
    { href: `/owner/pet/${id}/records`, labelKey: 'pet.records' },
    { href: `/owner/pet/${id}/documents`, labelKey: 'pet.documents' },
    { href: `/owner/pet/${id}/calendar`, labelKey: 'pet.calendar' },
    { href: `/owner/pet/${id}/inpatient`, labelKey: 'nav.inpatient' },
    { href: `/owner/pet/${id}/consents`, labelKey: 'pet.consents' },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <nav
        className="flex min-w-0 flex-1 gap-2 overflow-x-auto rounded-2xl border border-lapka-200 bg-white/80 p-1.5"
        aria-label={t('common.sections')}
      >
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${
                active ? 'bg-lapka-gradient text-white shadow-soft' : 'text-lapka-700 hover:bg-lapka-100'
              }`}
            >
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <OwnerPetSwitcher currentPetId={id} />
    </div>
  );
}
