'use client';

import { useCallback, useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import ErrorBanner from '@/components/ui/ErrorBanner';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import Badge from '@/components/ui/Badge';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';

function localizeClaimStatus(status) {
  return (
    {
      all: 'Все',
      draft: 'Черновик',
      submitted: 'Подана',
      approved: 'Одобрена',
      rejected: 'Отклонена',
    }[status] || status
  );
}

export default function ClinicInsurancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claims, setClaims] = useState([]);
  const [updatingId, setUpdatingId] = useState('');
  const [filter, setFilter] = useState('all');

  const loadClaims = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = filter === 'all' ? '/api/v1/clinic/insurance/claims' : `/api/v1/clinic/insurance/claims?status=${filter}`;
      const payload = await apiRequest(endpoint);
      setClaims(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить страховые заявки');
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  async function updateClaim(claimId, status) {
    setUpdatingId(claimId);
    setError('');
    try {
      await apiRequest(`/api/v1/clinic/insurance/claims/${claimId}`, {
        method: 'PATCH',
        body: {
          status,
          notes: `Обновлено администратором клиники: ${status}`,
        },
      });
      await loadClaims();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось обновить страховую заявку');
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Очередь страховых заявок</h1>
          <p className="page-subtitle">Очередь страховых заявок по invoice с обновлением статуса.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadClaims} /> : null}

      <ShowcasePanel
        eyebrow="Страховые заявки"
        title="Входящая очередь заявок по счетам и посещениям"
        description="Экран помогает быстро разобрать поток заявок, понять текущий статус и обновить решение без лишней навигации по CRM."
        imageSrc="/assets/img/clinic.svg"
        imageAlt="Страховые заявки клиники"
        badges={[
          `${claims.length} заявок`,
          `${claims.filter((row) => row.status === 'submitted').length} поданы`,
          `${claims.filter((row) => row.status === 'approved').length} одобрены`,
        ]}
      />

      <section className="kpi-grid">
        <StatsCard label="Всего заявок" value={String(claims.length)} />
        <StatsCard label="Поданы" value={String(claims.filter((row) => row.status === 'submitted').length)} />
        <StatsCard label="Одобрены" value={String(claims.filter((row) => row.status === 'approved').length)} />
        <StatsCard label="Отклонены" value={String(claims.filter((row) => row.status === 'rejected').length)} />
      </section>

      <Card title="Фильтр статуса">
        <div className="flex flex-wrap gap-2">
          {['all', 'draft', 'submitted', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              type="button"
              className={filter === status ? 'btn-primary !px-3 !py-1.5' : 'btn-secondary !px-3 !py-1.5'}
              onClick={() => setFilter(status)}
            >
              {localizeClaimStatus(status)}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Страховые заявки">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : claims.length === 0 ? (
          <EmptyState title="Заявки не найдены" text="Попробуйте изменить фильтр или дождитесь новых заявок." />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Владелец</th>
                  <th>Питомец</th>
                  <th>Счёт</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleString('ru-RU')}</td>
                    <td>{row.owner_name || `${row.owner_id.slice(0, 8)}...`}</td>
                    <td>{row.pet_name || `${row.pet_id.slice(0, 8)}...`}</td>
                    <td>{row.invoice_number || `${row.invoice_id.slice(0, 8)}...`}</td>
                    <td>
                      <Badge tone={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'}>
                        {localizeClaimStatus(row.status)}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="btn-secondary !px-3 !py-1 text-xs"
                          type="button"
                          disabled={updatingId === row.id}
                          onClick={() => updateClaim(row.id, 'approved')}
                        >
                          Одобрить
                        </button>
                        <button
                          className="btn-danger !px-3 !py-1 text-xs"
                          type="button"
                          disabled={updatingId === row.id}
                          onClick={() => updateClaim(row.id, 'rejected')}
                        >
                          Отклонить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
