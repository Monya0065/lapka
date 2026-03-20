'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layouts/AppLayout';
import RoleGate from '@/components/auth/RoleGate';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import ClinicScopeSwitcher from '@/components/ui/ClinicScopeSwitcher';
import { CLINIC_SIDEBAR_GROUPS } from '@/lib/clinic-workspace';
import { useClinicScope } from '@/lib/clinic-scope';

export default function ClinicLayout({ children }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { selectedClinic, selectedBranch } = useClinicScope();

  const showContextRail = pathname?.startsWith('/clinic/analytics')
    || pathname?.startsWith('/clinic/inpatient/')
    || pathname?.startsWith('/clinic/billing/');

  return (
    <RoleGate allowedRoles={['clinic_admin']}>
      <AppLayout
        roleLabel="clinic_admin"
        roleTone="clinic"
        workspaceTitle="Операционный центр"
        sidebarTitle="Клиника"
        sidebarSubtitle="Расписание, команда, стационар и финансы."
        sidebarVariant="workspace-dark"
        sidebarGroups={CLINIC_SIDEBAR_GROUPS}
        headerContext={<ClinicScopeSwitcher showBranchHint />}
        headerAction={
          <Link href="/clinic/schedule" prefetch={false} className="btn-primary workspace-header-cta">
            + Новая запись
          </Link>
        }
        sidebarFooter={
          <div className="grid gap-2">
            <Link href="/clinic/checkin" prefetch={false} className="btn-primary w-full !justify-start">
              Ресепшн и регистрация
            </Link>
            <Link href="/clinic/inpatient" prefetch={false} className="btn-secondary w-full !justify-start">
              Стационар
            </Link>
          </div>
        }
        rightColumn={showContextRail ? (
          <>
            <Card className="overflow-hidden p-0">
              <div className="relative h-40 w-full">
                <Image src="/assets/img/admin-side.svg" alt="Центр управления клиникой" fill sizes="360px" className="object-cover" />
              </div>
              <div className="p-4">
                <h3 className="text-2xl font-black tracking-tight text-lapka-900">{selectedClinic?.name || 'Клиника Санкт-Петербурга'}</h3>
                <p className="mt-1 text-sm text-lapka-600">Центральный филиал, операционный контроль, загрузка, команда и качество.</p>
                {selectedBranch ? <p className="mt-2 text-xs text-lapka-500">Активный филиал: {selectedBranch.address}</p> : null}
              </div>
            </Card>
            <Card title="Быстрые действия">
              <div className="grid gap-2">
                <Link href="/clinic/schedule" prefetch={false} className="btn-secondary justify-start">Создать запись</Link>
                <Link href="/clinic/doctors" prefetch={false} className="btn-secondary justify-start">Открыть команду</Link>
                <Link href="/clinic/services" prefetch={false} className="btn-secondary justify-start">Услуги</Link>
                <Link href="/clinic/templates" prefetch={false} className="btn-secondary justify-start">Шаблоны</Link>
              </div>
            </Card>
            <Alert tone="info">Медицинские разделы для администратора остаются только для чтения и зависят от действующего согласия владельца.</Alert>
          </>
        ) : null}
      >
        {children}
      </AppLayout>
    </RoleGate>
  );
}
