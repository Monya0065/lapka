'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function VetMobileQuickActions() {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-lapka-200 bg-white/95 p-2 shadow-soft backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-4 gap-2">
        <Link href="/vet/patients" className="btn-secondary !px-2 !py-2 text-[11px]">
          {t('nav.patients')}
        </Link>
        <Link href="/vet/appointments" className="btn-secondary !px-2 !py-2 text-[11px]">
          {t('nav.appointments')}
        </Link>
        <Link href="/vet/inpatient" className="btn-secondary !px-2 !py-2 text-[11px]">
          {t('nav.inpatient')}
        </Link>
        <Link href="/vet/documents" className="btn-secondary !px-2 !py-2 text-[11px]">
          {t('nav.documents')}
        </Link>
      </div>
    </div>
  );
}
