'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Alert from '@/components/ui/Alert';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';
import { localizeAccessScope } from '@/lib/access';
import { useClinicScope } from '@/lib/clinic-scope';

const SCOPES = [
  'PRESCRIPTIONS_ONLY',
  'BASIC_MEDICAL',
  'FULL_RECORD',
  'INPATIENT_VIEW',
  'CAMERA_VIEW',
];

export default function OwnerPetConsentsPage() {
  const params = useParams();
  const petId = useMemo(() => params?.id || '', [params]);
  const { clinicId: scopedClinicId, setClinicId: setScopedClinicId } = useClinicScope();

  const [consents, setConsents] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState('');
  const [confirmRevokeId, setConfirmRevokeId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [clinicId, setClinicId] = useState('');
  const [scopeLevel, setScopeLevel] = useState('FULL_RECORD');
  const [expiresAt, setExpiresAt] = useState('');

  const loadData = useCallback(async () => {
    if (!petId) return;
    setLoading(true);
    setError('');
    try {
      const [consentPayload, auditPayload, clinicsPayload] = await Promise.all([
        apiRequest('/api/v1/consents'),
        apiRequest('/api/v1/audit/owner-view?limit=200'),
        apiRequest('/api/v1/clinics'),
      ]);
      setConsents(Array.isArray(consentPayload) ? consentPayload : []);
      setAuditRows(Array.isArray(auditPayload) ? auditPayload : []);
      setClinics(Array.isArray(clinicsPayload) ? clinicsPayload : []);
      if (!clinicId && (scopedClinicId || clinicsPayload?.[0]?.id)) {
        setClinicId(scopedClinicId || clinicsPayload[0].id);
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить доступы и журнал просмотров');
      setConsents([]);
      setAuditRows([]);
      setClinics([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId, petId, scopedClinicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const clinicNameById = useMemo(
    () =>
      clinics.reduce((acc, row) => {
        acc[row.id] = row.name;
        return acc;
      }, {}),
    [clinics]
  );

  const petConsents = useMemo(
    () => consents.filter((row) => row.pet_id === petId),
    [consents, petId]
  );

  async function onGrant(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!clinicId) {
      setError('Выберите клинику для выдачи доступа.');
      return;
    }
    if (!scopeLevel) {
      setError('Выберите уровень доступа.');
      return;
    }

    setSaving(true);
    try {
      await apiRequest('/api/v1/consents', {
        method: 'POST',
        body: {
          pet_id: petId,
          clinic_id: clinicId,
          scope_level: scopeLevel,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        },
      });
      setScopedClinicId(clinicId);
      setSuccess('Доступ выдан. Событие зафиксировано в журнале действий.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось выдать доступ');
    } finally {
      setSaving(false);
    }
  }

  async function onRevoke(consentId) {
    setError('');
    setSuccess('');
    setConfirmRevokeId('');
    setRevokingId(consentId);
    try {
      await apiRequest(`/api/v1/consents/${consentId}/revoke`, { method: 'POST' });
      setSuccess('Доступ отозван. Клиника потеряла доступ к карте.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отозвать доступ');
    } finally {
      setRevokingId('');
    }
  }

  const consentRows = petConsents.map((row) => [
    clinicNameById[row.clinic_id] || row.clinic_id,
    localizeAccessScope(row.scope_level),
    row.expires_at ? new Date(row.expires_at).toLocaleString('ru-RU') : 'Без срока',
    row.revoked_at ? 'Отозван' : 'Активен',
    row.revoked_at ? (
      '—'
    ) : (
      <button className="btn-secondary !px-3 !py-1" type="button" onClick={() => setConfirmRevokeId(row.id)} disabled={revokingId === row.id}>
        {revokingId === row.id ? 'Отзываем...' : 'Отозвать'}
      </button>
    ),
  ]);

  const ownerAuditRows = auditRows
    .filter((row) => ['pet', 'visit', 'document', 'inpatient_stay', 'consent'].includes(row.target_type))
    .slice(0, 40)
    .map((row) => [
      new Date(row.created_at).toLocaleString('ru-RU'),
      clinicNameById[row.clinic_id] || row.clinic_id || '—',
      row.actor_user_id || 'system',
      row.action,
      row.target_type,
    ]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Доступ клиникам</h1>
          <p className="page-subtitle">Выдача и отзыв доступа к карте питомца с прозрачным журналом просмотров.</p>
        </div>
      </header>

      <ShowcasePanel
        eyebrow="Прозрачный доступ"
        title="Вы управляете доступом к карте питомца"
        description="Активируйте, меняйте и отзывайте уровни доступа для клиник. Каждый просмотр карты и документов фиксируется в журнале приватности."
        imageSrc="/assets/img/security-side.svg"
        imageAlt="Контроль доступа к карте питомца"
      />

      <Alert tone="info">
        После отзыва доступа клиника сразу теряет доступ к карте питомца. Все действия записываются в журнал аудита.
      </Alert>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
      ) : null}

      <section className="grid-soft-2">
        <Card title="Выдать доступ клинике" subtitle="Управление доступом клиник к карте питомца">
          <form className="space-y-3" onSubmit={onGrant}>
            <label className="block">
              <span className="label">Клиника</span>
              <select className="input" value={clinicId} onChange={(event) => setClinicId(event.target.value)}>
                {clinics.length ? (
                  clinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </option>
                  ))
                ) : (
                  <option value="">Клиники загружаются...</option>
                )}
              </select>
            </label>

            <label className="block">
              <span className="label">Уровень доступа</span>
              <select className="input" value={scopeLevel} onChange={(event) => setScopeLevel(event.target.value)}>
                {SCOPES.map((scope) => (
                  <option key={scope} value={scope}>
                    {localizeAccessScope(scope)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label">Срок действия (опционально)</span>
              <input
                className="input"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </label>

            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Сохраняем...' : 'Выдать доступ'}
            </button>
          </form>
        </Card>

        <Card title="Кто имеет доступ сейчас" subtitle="Только выбранный питомец">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : consentRows.length ? (
            <Table columns={['Клиника', 'Уровень доступа', 'Срок', 'Статус', 'Действия']} rows={consentRows} />
          ) : (
            <EmptyState title="Доступов пока нет" text="Выдайте первый доступ для обмена медкартой с клиникой." />
          )}
        </Card>
      </section>

      <Card title="Кто смотрел карту" subtitle="Журнал приватности владельца из аудита">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : ownerAuditRows.length ? (
          <Table columns={['Дата', 'Клиника', 'Кто', 'Действие', 'Объект']} rows={ownerAuditRows} />
        ) : (
          <EmptyState title="Логи пока пусты" text="После просмотров карты события появятся здесь." />
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(confirmRevokeId)}
        title="Отозвать доступ клинике?"
        message="После отзыва клиника сразу потеряет доступ к медкарте и документам питомца."
        confirmLabel="Отозвать доступ"
        cancelLabel="Оставить доступ"
        danger
        loading={Boolean(revokingId)}
        onCancel={() => setConfirmRevokeId('')}
        onConfirm={() => onRevoke(confirmRevokeId)}
      />
    </>
  );
}
