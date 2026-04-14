'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const [rows, setRows] = useState([]);
  const [digestRows, setDigestRows] = useState([]);
  const [digestByStay, setDigestByStay] = useState([]);
  const [digestWindowHours, setDigestWindowHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [digestFocusEnabled, setDigestFocusEnabled] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [payload, digestPayload] = await Promise.all([
        apiRequest('/api/v1/inpatient/owner/inpatient?status=active'),
        apiRequest('/api/v1/inpatient/owner/inpatient/digest?window_hours=24'),
      ]);
      setRows(Array.isArray(payload) ? payload : []);
      const digest = (Array.isArray(digestPayload?.recent_items) ? digestPayload.recent_items : [])
        .slice(0, 12)
        .map((row) => ({
          id: row.id,
          title: row.title || 'Обновление стационара',
          body: row.body || '',
          created_at: row.created_at,
          stay_id: row.stay_id || '',
          kind: row.kind || 'update',
        }));
      setDigestRows(digest);
      setDigestByStay(Array.isArray(digestPayload?.by_stay) ? digestPayload.by_stay : []);
      setDigestWindowHours(Number(digestPayload?.window_hours) > 0 ? Number(digestPayload.window_hours) : 24);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить стационарные кейсы');
      setRows([]);
      setDigestRows([]);
      setDigestByStay([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const digestFlag = (searchParams?.get('digest') || '').trim();
    setDigestFocusEnabled(digestFlag === '1' || digestFlag === 'true');
  }, [searchParams]);

  useEffect(() => {
    if (!digestFocusEnabled || loading) return;
    const section = document.getElementById('digest-section');
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [digestFocusEnabled, loading]);

  const stats = useMemo(() => {
    const total = rows.length;
    const withCamera = rows.filter((row) => row.camera_available).length;
    const updatedRecently = rows.filter((row) => {
      const updated = row.last_update_at ? new Date(row.last_update_at).getTime() : 0;
      return Date.now() - updated < 6 * 60 * 60 * 1000;
    }).length;
    return { total, withCamera, updatedRecently };
  }, [rows]);

  const staleRows = useMemo(
    () =>
      rows.filter((row) => {
        const updated = row.last_update_at ? new Date(row.last_update_at).getTime() : 0;
        return updated > 0 && Date.now() - updated > 8 * 60 * 60 * 1000;
      }),
    [rows]
  );

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

      {digestFocusEnabled ? (
        <Card
          title="Digest-режим"
          subtitle="Вы открыли стационар из digest-уведомления. Ниже показана сводка обновлений за последние часы."
        >
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
            Фокус включён: сначала просмотрите блок digest и карточки с последними изменениями по кейсам.
          </div>
        </Card>
      ) : null}

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
        id="digest-section"
        title={`Digest обновлений (${digestWindowHours}ч)`}
        subtitle="Короткая сводка последних сигналов стационара в хронологическом порядке."
      >
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : digestRows.length ? (
          <div className="space-y-2">
            {digestRows.map((row) => (
              <article key={row.id} className="rounded-xl border border-lapka-200 bg-white px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-lapka-900">{row.title}</p>
                  <span className="text-xs text-lapka-500">{formatDate(row.created_at)}</span>
                </div>
                {row.body ? <p className="mt-1 text-lapka-700">{row.body}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="pill !px-2 !py-1 !text-[11px]">{row.kind}</span>
                  {row.stay_id ? (
                    <Link href={`/owner/inpatient/${row.stay_id}`} className="text-xs font-semibold text-teal-700 hover:underline">
                      Открыть карточку →
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Digest пока пуст" text="Новые события стационара появятся в этой сводке автоматически." />
        )}
      </Card>

      {digestByStay.length ? (
        <Card title="Сводка по кейсам" subtitle="Количество событий и фото по каждому стационару за окно digest.">
          <div className="grid gap-2">
            {digestByStay.map((row) => (
              <div key={row.stay_id} className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-lapka-900">{row.pet_name}</p>
                  <span className="text-xs text-lapka-500">{formatDate(row.last_update_at)}</span>
                </div>
                <p className="mt-1 text-lapka-700">
                  События: {row.event_count} · Фото: {row.photo_count}
                </p>
                <Link href={`/owner/inpatient/${row.stay_id}`} className="mt-1 inline-block text-xs font-semibold text-teal-700 hover:underline">
                  Открыть кейс →
                </Link>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {staleRows.length ? (
        <Card title="Нужна проверка обновлений" subtitle="По некоторым кейсам давно не было новых событий.">
          <div className="space-y-2">
            {staleRows.map((row) => (
              <div key={row.id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <span className="font-semibold">{row.pet_name}</span> — последнее обновление: {formatDate(row.last_update_at)}.{' '}
                <Link href={`/owner/inpatient/${row.id}`} className="font-semibold underline">
                  Открыть карточку
                </Link>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

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
