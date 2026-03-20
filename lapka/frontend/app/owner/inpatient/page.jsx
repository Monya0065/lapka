'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

function statusBadge(stay) {
  if (stay.public_status_label === 'stable') {
    return <span className="badge-green">Стабильно</span>;
  }
  if (stay.public_status_label === 'needs_attention') {
    return <span className="badge-red">Требуется внимание</span>;
  }
  return <span className="badge-yellow">Под наблюдением</span>;
}

export default function OwnerInpatientListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest('/api/v1/inpatient/owner/inpatient?status=active');
      setRows(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить стационарные кейсы');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const withCamera = rows.filter((row) => row.camera_available).length;
    const updatedRecently = rows.filter((row) => {
      const updated = row.last_update_at ? new Date(row.last_update_at).getTime() : 0;
      return Date.now() - updated < 6 * 60 * 60 * 1000;
    }).length;
    return { total, withCamera, updatedRecently };
  }, [rows]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Мой питомец в стационаре</h1>
          <p className="page-subtitle">
            Прозрачные обновления, фото-отчёты и защищённый доступ к камерам. Только спокойные и понятные данные для
            владельца без назначения лечения.
          </p>
        </div>
        <button className="btn-secondary" type="button" onClick={loadData}>
          Обновить
        </button>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}

      <ShowcasePanel
        eyebrow="Стационар владельца"
        title="Прозрачное наблюдение за питомцем в клинике"
        description="Владелец видит спокойный статус, свежие обновления, фото-отчёты и, при наличии доступа, камеры стационара без перегрузки медицинскими деталями."
        imageSrc="/assets/img/inpatient-photo.svg"
        imageAlt="Наблюдение за питомцем в стационаре"
        badges={[
          `${stats.total} активных кейсов`,
          `${stats.withCamera} с камерами`,
          `${stats.updatedRecently} со свежими обновлениями`,
        ]}
      />

      <section className="kpi-grid">
        <Card title="Активные стационары" subtitle="текущий момент">
          <p className="text-4xl font-black text-lapka-900">{stats.total}</p>
        </Card>
        <Card title="Камеры доступны" subtitle="только при активной госпитализации и выданном доступе">
          <p className="text-4xl font-black text-lapka-900">{stats.withCamera}</p>
        </Card>
        <Card title="Свежие обновления" subtitle="за последние 6 часов">
          <p className="text-4xl font-black text-lapka-900">{stats.updatedRecently}</p>
        </Card>
      </section>

      <Card
        title="Госпитализированные питомцы"
        subtitle="Каждая карточка показывает безопасный статус, время последнего обновления и доступ к прямому эфиру"
      >
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : rows.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((stay) => (
              <article
                key={stay.id}
                className="rounded-3xl border border-lapka-200 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-2xl font-black tracking-tight text-lapka-900">{stay.pet_name}</h3>
                  {statusBadge(stay)}
                </div>

                <p className="mt-1 text-sm text-lapka-600">
                  {stay.pet_species} · Палата {stay.ward}/{stay.bed}
                </p>
                <p className="mt-2 text-sm text-lapka-700">{stay.owner_visible_summary}</p>

                <div className="mt-4 grid gap-2 text-sm text-lapka-700 sm:grid-cols-2">
                  <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">События: {stay.event_count}</div>
                  <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">Фото: {stay.photo_count}</div>
                  <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 sm:col-span-2">
                    Последнее обновление: {formatDate(stay.last_update_at)}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/owner/inpatient/${stay.id}`} className="btn-primary">
                    Карточка стационара
                  </Link>
                  {stay.camera_available ? (
                    <span className="pill">Камера доступна</span>
                  ) : (
                    <span className="pill">Камера недоступна по текущему уровню доступа</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Активных стационаров нет"
            text="Когда питомец поступит в стационар, здесь появится карточка с обновлениями и фото-отчётами."
          />
        )}
      </Card>
    </>
  );
}
