'use client';

import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import Table from '@/components/ui/Table';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiRequest } from '@/lib/api';

export default function ClinicAuditPage() {
  const [rows, setRows] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moderatingId, setModeratingId] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  async function loadAudit() {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest('/api/v1/audit?limit=200');
      setRows(Array.isArray(payload) ? payload : []);
      const reviewsPayload = await apiRequest('/api/v1/reviews?status_filter=pending&limit=100');
      setPendingReviews(Array.isArray(reviewsPayload) ? reviewsPayload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить журнал аудита');
      setRows([]);
      setPendingReviews([]);
    } finally {
      setLoading(false);
    }
  }

  async function moderateReview(reviewId, statusValue) {
    setModeratingId(reviewId);
    setError('');
    try {
      await apiRequest(`/api/v1/reviews/${reviewId}/moderate`, {
        method: 'PATCH',
        body: {
          status: statusValue,
          reason: statusValue === 'rejected' ? 'Отклонено модератором' : 'Проверено модератором',
        },
      });
      await loadAudit();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось применить модерацию');
    } finally {
      setModeratingId('');
    }
  }

  useEffect(() => {
    loadAudit();
  }, []);

  const actionOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((row) => set.add(row.action));
    return ['all', ...Array.from(set).sort()];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const actionMatch = actionFilter === 'all' || row.action === actionFilter;
      if (!actionMatch) return false;
      if (!normalizedQuery) return true;
      return [row.action, row.target_type, row.target_id, row.actor_user_id, row.clinic_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [rows, query, actionFilter]);

  const tableRows = filteredRows.map((row) => [
    new Date(row.created_at).toLocaleString('ru-RU'),
    row.actor_user_id || 'system',
    row.action,
    row.target_type,
    row.target_id || '—',
    row.clinic_id || '—',
  ]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Журнал аудита</h1>
          <p className="page-subtitle">
            Логируются ключевые действия: вход, выдача и отзыв доступа, просмотр документов, просмотр публичных ссылок и завершение визита.
          </p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadAudit} /> : null}

      <section className="kpi-grid">
        <StatsCard label="Всего событий" value={String(rows.length)} />
        <StatsCard label="Отфильтровано" value={String(filteredRows.length)} />
        <StatsCard label="Входов в систему" value={String(rows.filter((row) => row.action === 'auth.login').length)} />
        <StatsCard label="Отзывы на модерации" value={String(pendingReviews.length)} />
      </section>

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_280px_auto] md:items-end">
          <SearchInput
            label="Поиск по аудиту"
            value={query}
            placeholder="action, actor_user_id, target_id..."
            onChange={(event) => setQuery(event.target.value)}
          />

          <label className="block">
            <span className="label">Фильтр по действию</span>
            <select className="input" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>

          <button className="btn-secondary" type="button" onClick={() => loadAudit()}>
            Обновить
          </button>
        </div>
      </Card>

      <Card title="Журнал действий API">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : filteredRows.length ? (
          <Table columns={['Дата', 'Исполнитель', 'Действие', 'Цель', 'ID цели', 'ID клиники']} rows={tableRows} />
        ) : (
          <EmptyState title="События не найдены" text="Измените фильтр или выполните действия в системе." />
        )}
      </Card>

      <Card title="Модерация отзывов" subtitle="Публикация или отклонение pending-отзывов">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : pendingReviews.length ? (
          <div className="space-y-2">
            {pendingReviews.map((row) => (
              <article key={row.id} className="rounded-xl border border-lapka-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-lapka-900">{row.title || 'Отзыв без заголовка'}</p>
                    <p className="text-xs text-lapka-600">
                      {row.target_type} · {row.target_id} · {new Date(row.created_at).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-amber-600">{'★'.repeat(row.rating)}{'☆'.repeat(Math.max(0, 5 - row.rating))}</p>
                </div>
                <p className="mt-1 text-sm text-lapka-700">{row.text}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="btn-primary !px-3 !py-1.5"
                    type="button"
                    onClick={() => moderateReview(row.id, 'published')}
                    disabled={moderatingId === row.id}
                  >
                    Опубликовать
                  </button>
                  <button
                    className="btn-danger !px-3 !py-1.5"
                    type="button"
                    onClick={() => moderateReview(row.id, 'rejected')}
                    disabled={moderatingId === row.id}
                  >
                    Отклонить
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Нет отзывов в модерации" text="Все отзывы уже обработаны." />
        )}
      </Card>
    </>
  );
}
