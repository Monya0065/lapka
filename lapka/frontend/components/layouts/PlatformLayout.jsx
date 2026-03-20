'use client';

import Link from 'next/link';
import AppLayout from '@/components/layouts/AppLayout';
import RoleGate from '@/components/auth/RoleGate';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import ClinicScopeSwitcher from '@/components/ui/ClinicScopeSwitcher';
import { PLATFORM_SIDEBAR_GROUPS } from '@/lib/platform-workspace';

export default function PlatformLayout({ children }) {
  return (
    <RoleGate allowedRoles={['network_admin']}>
      <AppLayout
        roleLabel="network_admin"
        roleTone="clinic"
        workspaceTitle="Центр платформы"
        sidebarTitle="Платформа"
        sidebarSubtitle="Управление клиниками, ролями, AI-провайдерами, знаниями, безопасностью и системными политиками."
        sidebarVariant="workspace-dark"
        sidebarGroups={PLATFORM_SIDEBAR_GROUPS}
        headerContext={<ClinicScopeSwitcher showBranchHint />}
        headerAction={
          <Link href="/platform/clinics" prefetch={false} className="btn-primary workspace-header-cta">
            + Добавить клинику
          </Link>
        }
        sidebarFooter={
          <div className="grid gap-2">
            <Link href="/platform/ai" prefetch={false} className="btn-secondary w-full !justify-start">
              Центр AI
            </Link>
            <Link href="/platform/security" prefetch={false} className="btn-secondary w-full !justify-start">
              Аудит и безопасность
            </Link>
          </div>
        }
        rightColumn={(
          <>
            <Card title="Уровень платформы" subtitle="Сеть клиник, AI, шаблоны, безопасность и правила доступа собираются в одном контуре.">
              <div className="grid gap-2">
                <Link href="/platform/clinics" prefetch={false} className="btn-secondary justify-start">Клиники</Link>
                <Link href="/platform/users" prefetch={false} className="btn-secondary justify-start">Пользователи</Link>
                <Link href="/platform/templates" prefetch={false} className="btn-secondary justify-start">Контент</Link>
              </div>
            </Card>
            <Alert tone="info">Это единый контур управления сетью клиник: здесь собираются роли, AI, шаблоны, безопасность и системные политики.</Alert>
          </>
        )}
      >
        {children}
      </AppLayout>
    </RoleGate>
  );
}
