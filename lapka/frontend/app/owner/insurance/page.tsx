'use client';

import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import Badge from '@/components/ui/Badge';
import { apiRequest } from '@/lib/api';

export default function OwnerInsurancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [policyForm, setPolicyForm] = useState({ provider_name: '', policy_number: '' });
  const [claimForm, setClaimForm] = useState({ invoice_id: '', notes: '' });

  async function loadInsurance() {
    setLoading(true);
    setError('');
    try {
      const [policiesPayload, claimsPayload, invoicesPayload] = await Promise.all([
        apiRequest('/api/v1/owner/insurance/policies'),
        apiRequest('/api/v1/owner/insurance/claims'),
        apiRequest('/api/v1/owner/invoices'),
      ]);
      setPolicies(Array.isArray(policiesPayload) ? policiesPayload : []);
      setClaims(Array.isArray(claimsPayload) ? claimsPayload : []);
      setInvoices(Array.isArray(invoicesPayload) ? invoicesPayload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить страховые данные');
      setPolicies([]);
      setClaims([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInsurance();
  }, []);

  const invoicesForClaim = useMemo(
    () => invoices.filter((row) => row.status === 'issued' || row.status === 'paid'),
    [invoices]
  );

  async function addPolicy(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/api/v1/owner/insurance/policies', {
        method: 'POST',
        body: {
          provider_name: policyForm.provider_name.trim(),
          policy_number: policyForm.policy_number.trim(),
        },
      });
      setPolicyForm({ provider_name: '', policy_number: '' });
      await loadInsurance();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось добавить полис');
    } finally {
      setSubmitting(false);
    }
  }

  async function createClaim(event) {
    event.preventDefault();
    if (!claimForm.invoice_id) {
      setError('Выберите счёт для страховой заявки');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/api/v1/owner/insurance/claims', {
        method: 'POST',
        body: {
          invoice_id: claimForm.invoice_id,
          notes: claimForm.notes.trim() || null,
        },
      });
      setClaimForm({ invoice_id: '', notes: '' });
      await loadInsurance();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось создать страховую заявку');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Страхование</h1>
          <p className="page-subtitle">Полисы владельца и маршрут страховых заявок по счетам и визитам.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadInsurance} /> : null}

      <section className="kpi-grid">
        <StatsCard label="Полисы" value={String(policies.length)} />
        <StatsCard label="Заявки" value={String(claims.length)} />
        <StatsCard label="Отправлены" value={String(claims.filter((row) => row.status === 'submitted').length)} />
        <StatsCard label="Одобрены" value={String(claims.filter((row) => row.status === 'approved').length)} />
      </section>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <section className="grid-soft-2">
            <Card title="Добавить полис">
              <form className="grid gap-3" onSubmit={addPolicy}>
                <label className="block">
                  <span className="label">Страховая компания</span>
                  <input
                    className="input"
                    value={policyForm.provider_name}
                    onChange={(event) => setPolicyForm((prev) => ({ ...prev, provider_name: event.target.value }))}
                    required
                  />
                </label>
                <label className="block">
                  <span className="label">Номер полиса</span>
                  <input
                    className="input"
                    value={policyForm.policy_number}
                    onChange={(event) => setPolicyForm((prev) => ({ ...prev, policy_number: event.target.value }))}
                    required
                  />
                </label>
                <button className="btn-primary" type="submit" disabled={submitting}>
                  Добавить полис
                </button>
              </form>
            </Card>

            <Card title="Создать страховую заявку">
              <form className="grid gap-3" onSubmit={createClaim}>
                <label className="block">
                  <span className="label">Счёт</span>
                  <select
                    className="input"
                    value={claimForm.invoice_id}
                    onChange={(event) => setClaimForm((prev) => ({ ...prev, invoice_id: event.target.value }))}
                    required
                  >
                    <option value="">Выберите счёт</option>
                    {invoicesForClaim.map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.id.slice(0, 8)}... · {invoice.status} · {(invoice.total_cents / 100).toFixed(2)} {invoice.currency}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Комментарий</span>
                  <textarea
                    className="input min-h-24"
                    value={claimForm.notes}
                    onChange={(event) => setClaimForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Например, приложить документы по визиту"
                  />
                </label>
                <button className="btn-secondary" type="submit" disabled={submitting}>
                  Отправить заявку
                </button>
              </form>
            </Card>
          </section>

          <Card title="Мои полисы">
            {policies.length === 0 ? (
              <EmptyState title="Полисы не добавлены" text="Добавьте полис, чтобы отправлять страховые заявки по счетам клиники." />
            ) : (
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Провайдер</th>
                      <th>Номер</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map((policy) => (
                      <tr key={policy.id}>
                        <td>{policy.provider_name}</td>
                        <td>{policy.policy_number_masked}</td>
                        <td>{policy.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Страховые заявки">
            {claims.length === 0 ? (
              <EmptyState title="Заявок пока нет" text="После отправки страховая заявка появится здесь." />
            ) : (
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Счёт</th>
                      <th>Статус</th>
                      <th>Заметка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((claim) => (
                      <tr key={claim.id}>
                        <td>{new Date(claim.created_at).toLocaleString('ru-RU')}</td>
                        <td>{claim.invoice_id.slice(0, 8)}...</td>
                        <td>
                          <Badge tone={claim.status === 'approved' ? 'success' : claim.status === 'rejected' ? 'danger' : 'warning'}>
                            {claim.status}
                          </Badge>
                        </td>
                        <td>{claim.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
