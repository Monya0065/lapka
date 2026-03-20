'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';

export default function OwnerPetInpatientShortcutPage() {
  const params = useParams();
  const petId = useMemo(() => params?.id || '', [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stay, setStay] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest('/api/v1/inpatient/owner/inpatient?status=active');
      const rows = Array.isArray(payload) ? payload : [];
      setStay(rows.find((row) => row.pet_id === petId) || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить стационар');
      setStay(null);
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Стационар питомца</h1>
          <p className="page-subtitle">Переход к полной продуктовой странице стационара с таймлайном, фото и защищённой трансляцией.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {loading ? (
        <Skeleton className="h-56 w-full" />
      ) : stay ? (
        <>
          <ShowcasePanel
            eyebrow="Стационар питомца"
            title={`${stay.pet_name}: все обновления по госпитализации в одном месте`}
            description={stay.owner_visible_summary}
            imageSrc="/assets/img/inpatient-photo.svg"
            imageAlt="Карточка стационара питомца"
            badges={[
              `Палата ${stay.ward}`,
              `Место ${stay.bed}`,
              stay.camera_available ? 'Камера доступна' : 'Камера недоступна',
            ]}
            compact
          />
          <Card title="Быстрый переход" subtitle="Откройте полную страницу стационара с лентой, фото-отчётами и камерой">
            <div className="grid gap-2 text-sm text-lapka-700 sm:grid-cols-2">
              <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">Палата: {stay.ward}</div>
              <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">Место: {stay.bed}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/owner/inpatient/${stay.id}`} className="btn-primary">
                Открыть полную карточку стационара
              </Link>
              <Link href="/owner/inpatient" className="btn-secondary">
                Все стационары
              </Link>
            </div>
          </Card>
        </>
      ) : (
        <EmptyState title="Стационар не активен" text="Для выбранного питомца сейчас нет активной госпитализации." />
      )}
    </>
  );
}
