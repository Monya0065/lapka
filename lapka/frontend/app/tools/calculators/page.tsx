'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import { getStoredSession } from '@/lib/auth';

export default function ToolsCalculatorsEntryPage() {
  const router = useRouter();

  useEffect(() => {
    const session = getStoredSession();
    if (!session?.role) {
      router.replace('/login?next=%2Ftools%2Fcalculators');
      return;
    }

    if (session.role === 'owner') {
      router.replace('/owner/tools/calculators');
      return;
    }

    if (session.role === 'vet' || session.role === 'clinic_admin') {
      router.replace('/vet/tools');
      return;
    }

    router.replace('/login');
  }, [router]);

  return (
    <main className="page-wrap py-8">
      <Card title="Открываем калькуляторы" subtitle="Перенаправление в рабочий раздел">
        <p className="text-sm text-lapka-700">
          Подбираем правильный раздел по вашей роли. Если переход не выполнился, обновите страницу.
        </p>
      </Card>
    </main>
  );
}
