'use client';

import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import { apiRequest } from '@/lib/api';

export default function OwnerRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processingId, setProcessingId] = useState('');

  async function loadRequests() {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest('/api/v1/owner/requests');
      setRequests(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить запросы доступа');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function resolveRequest(id, decision) {
    setProcessingId(id);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/owner/requests/${id}/${decision}`, {
        method: 'POST',
        body: {
          decision_note: decision === 'approve' ? 'Доступ подтверждён владельцем.' : 'Доступ отклонён владельцем.',
        },
      });
      setSuccess(decision === 'approve' ? 'Доступ выдан клинике.' : 'Запрос отклонён.');
      await loadRequests();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось обработать запрос');
    } finally {
      setProcessingId('');
    }
  }

  const pending = useMemo(() => requests.filter((row) => row.status === 'pending'), [requests]);

  const rows = requests.map((row) => [
    row.pet?.name || '—',
    row.clinic?.name || '—',
    row.requested_scope || '—',
    row.message || '—',
    row.status,
    row.status === 'pending' ? (
      <div key={row.id} className="flex flex-wrap gap-2">
        <button
          className="btn-primary !px-3 !py-1"
          type="button"
          onClick={() => resolveRequest(row.id, 'approve')}
          disabled={processingId === row.id}
        >
          Одобрить
        </button>
        <button
          className="btn-secondary !px-3 !py-1"
          type="button"
          onClick={() => resolveRequest(row.id, 'reject')}
          disabled={processingId === row.id}
        >
          Отклонить
        </button>
      </div>
    ) : (
      <span key={row.id} className="text-sm text-lapka-600">{row.resolved_at ? new Date(row.resolved_at).toLocaleString('ru-RU') : '—'}</span>
    ),
  ]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Запросы доступа от клиник</h1>
          <p className="page-subtitle">Владелец подтверждает доступ клиники по каждому питомцу и уровню просмотра карты.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadRequests} /> : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
      ) : null}

      <section className="kpi-grid">
        <Card title="Ожидают решения"><p className="text-3xl font-black text-lapka-900">{pending.length}</p></Card>
        <Card title="Всего запросов"><p className="text-3xl font-black text-lapka-900">{requests.length}</p></Card>
        <Card title="Памятка">
          <p className="text-sm text-lapka-700">Без одобрения владельца клиника видит только обезличенную карточку пациента.</p>
        </Card>
      </section>

      {loading ? (
        <section className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </section>
      ) : rows.length ? (
        <Card title="История запросов">
          <Table columns={['Питомец', 'Клиника', 'Уровень доступа', 'Сообщение', 'Статус', 'Действие']} rows={rows} />
        </Card>
      ) : (
        <EmptyState title="Запросов пока нет" text="Когда клиника запросит доступ к карте питомца, они появятся здесь." />
      )}
    </>
  );
}
