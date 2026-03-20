'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiRequest } from '@/lib/api';

export default function ClinicInvitesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadInvites() {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest('/api/v1/admin/clinic-invites');
      setRows(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить приглашения клиник');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvites();
  }, []);

  async function moderate(invite, status) {
    setSavingId(invite.id);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/admin/clinic-invites/${invite.id}/moderate`, {
        method: 'PATCH',
        body: {
          status,
          reason:
            status === 'approved'
              ? 'Клиника приглашена в onboarding поток.'
              : 'Нужна дополнительная проверка данных клиники.',
        },
      });
      setSuccess(status === 'approved' ? 'Инвайт одобрен.' : 'Инвайт отклонён.');
      await loadInvites();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось изменить статус инвайта');
    } finally {
      setSavingId('');
    }
  }

  const tableRows = rows.map((row) => [
    row.clinic_name,
    row.clinic_email,
    row.inviter_name || row.inviter_email || row.inviter_user_id,
    row.status,
    row.created_at ? new Date(row.created_at).toLocaleString('ru-RU') : '—',
    row.status === 'pending' ? (
      <div key={row.id} className="flex flex-wrap gap-2">
        <button className="btn-primary !px-3 !py-1" type="button" onClick={() => moderate(row, 'approved')} disabled={savingId === row.id}>
          Одобрить
        </button>
        <button className="btn-secondary !px-3 !py-1" type="button" onClick={() => moderate(row, 'rejected')} disabled={savingId === row.id}>
          Отклонить
        </button>
      </div>
    ) : (
      row.review_note || '—'
    ),
  ]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Приглашения клиник</h1>
          <p className="page-subtitle">Приглашения от владельцев в клиники, которые обрабатывает администратор.</p>
        </div>
        <button className="btn-secondary" type="button" onClick={loadInvites}>Обновить</button>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadInvites} /> : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
      ) : null}

      <section className="kpi-grid">
        <Card title="Всего"><p className="text-3xl font-black text-lapka-900">{rows.length}</p></Card>
        <Card title="Ожидают"><p className="text-3xl font-black text-lapka-900">{rows.filter((row) => row.status === 'pending').length}</p></Card>
        <Card title="Одобрены"><p className="text-3xl font-black text-lapka-900">{rows.filter((row) => row.status === 'approved').length}</p></Card>
      </section>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : tableRows.length ? (
        <Card title="Входящие приглашения клиник" subtitle="Поток одобрения и отклонения">
          <Table columns={['Клиника', 'Email', 'От кого', 'Статус', 'Дата', 'Действия']} rows={tableRows} />
        </Card>
      ) : (
        <EmptyState title="Инвайтов нет" text="Новые приглашения клиник появятся здесь." />
      )}
    </>
  );
}
