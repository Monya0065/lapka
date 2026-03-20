'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SymptomAutocomplete from '@/components/ui/SymptomAutocomplete';
import StatsCard from '@/components/ui/StatsCard';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import { apiRequest } from '@/lib/api';
import { useClinicScope } from '@/lib/clinic-scope';
import { localizePetBreed, localizePetSpecies } from '@/lib/pets';

function shortId(value) {
  if (!value) return '—';
  return `${String(value).slice(0, 8)}…`;
}

export default function VetPatientPage() {
  const params = useParams();
  const patientId = useMemo(() => params?.id || '', [params]);
  const { clinicId, selectedClinic, selectedBranch } = useClinicScope();

  const [pet, setPet] = useState(null);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [success, setSuccess] = useState('');
  const [requestingAccess, setRequestingAccess] = useState(false);

  const [creatingVisit, setCreatingVisit] = useState(false);
  const [finalizingVisitId, setFinalizingVisitId] = useState('');
  const [visitForm, setVisitForm] = useState({
    chief_complaint: 'Снижение аппетита',
    exam_findings: 'Умеренная вялость',
    plan_note: 'Контроль состояния и повторный осмотр',
  });
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);

  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [ttlHours, setTtlHours] = useState(24);
  const [publicToken, setPublicToken] = useState('');
  const [publicPayload, setPublicPayload] = useState(null);
  const [publicError, setPublicError] = useState('');
  const [confirmRevokePublicOpen, setConfirmRevokePublicOpen] = useState(false);

  const loadPatientCard = useCallback(async () => {
    if (!patientId || !clinicId) return;
    setLoading(true);
    setError('');
    setAccessDenied(false);
    try {
      const [petPayload, visitsPayload, docsPayload] = await Promise.all([
        apiRequest(`/api/v1/pets/${patientId}`),
        apiRequest(`/api/v1/visits?clinic_id=${encodeURIComponent(clinicId)}&pet_id=${encodeURIComponent(patientId)}&limit=50`),
        apiRequest(`/api/v1/documents?clinic_id=${encodeURIComponent(clinicId)}&pet_id=${encodeURIComponent(patientId)}`),
      ]);
      const visitsList = Array.isArray(visitsPayload) ? visitsPayload : [];
      setPet(petPayload || null);
      setVisits(visitsList);
      setDocuments(Array.isArray(docsPayload) ? docsPayload : []);
      if (visitsList.length) {
        setSelectedVisitId((current) => current || visitsList[0].id);
      }
    } catch (requestError) {
      setAccessDenied(requestError.status === 403);
      setError(requestError.message || 'Не удалось загрузить карточку пациента');
      setPet(null);
      setVisits([]);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId, patientId]);

  useEffect(() => {
    loadPatientCard();
  }, [loadPatientCard]);

  async function requestConsentAccess() {
    setRequestingAccess(true);
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest('/api/v1/consent-requests', {
        method: 'POST',
        body: {
          master_pet_id: patientId,
          clinic_id: clinicId,
          message: 'Нужен доступ к карте для продолжения осмотра.',
          requested_scope: 'BASIC_MEDICAL',
        },
      });
      setSuccess(`Запрос доступа отправлен владельцу (ID: ${payload.id}).`);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отправить запрос доступа');
    } finally {
      setRequestingAccess(false);
    }
  }

  async function createVisit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setCreatingVisit(true);
    try {
      const symptomSummary = selectedSymptoms.map((item) => item.name).join(', ');
      const complaintsWithSymptoms = symptomSummary
        ? `${visitForm.chief_complaint}\nСимптомы (поиск): ${symptomSummary}`
        : visitForm.chief_complaint;

      const payload = await apiRequest('/api/v1/visits', {
        method: 'POST',
        body: {
          pet_id: patientId,
          clinic_id: clinicId,
          chief_complaint: complaintsWithSymptoms,
          exam_findings: visitForm.exam_findings,
          plan_note: visitForm.plan_note,
        },
      });
      setSuccess('Визит создан.');
      setSelectedVisitId(payload.id);
      setSelectedSymptoms([]);
      await loadPatientCard();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось создать визит');
    } finally {
      setCreatingVisit(false);
    }
  }

  async function finalizeVisit(visitId) {
    setError('');
    setSuccess('');
    setFinalizingVisitId(visitId);
    try {
      await apiRequest(`/api/v1/visits/${visitId}/finalize`, { method: 'POST' });
      setSuccess('Визит завершён и зафиксирован в карте.');
      await loadPatientCard();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось завершить визит');
    } finally {
      setFinalizingVisitId('');
    }
  }

  async function createPublicLink() {
    setPublicError('');
    setError('');
    setSuccess('');
    if (!selectedVisitId) {
      setPublicError('Сначала выберите визит.');
      return;
    }
    try {
      const payload = await apiRequest('/api/v1/public-links/prescription', {
        method: 'POST',
        body: {
          visit_id: selectedVisitId,
          pet_id: patientId,
          ttl_hours: Number(ttlHours) || 24,
        },
      });
      setPublicToken(payload.token || '');
      setSuccess('Публичная QR-ссылка создана.');
    } catch (requestError) {
      setPublicError(requestError.message || 'Не удалось создать публичную ссылку');
    }
  }

  async function openPublicLink() {
    setPublicError('');
    setSuccess('');
    if (!publicToken.trim()) {
      setPublicError('Сначала создайте ссылку или вставьте токен.');
      return;
    }
    try {
      const payload = await apiRequest(`/api/v1/public/prescriptions/${encodeURIComponent(publicToken.trim())}`, {
        auth: false,
      });
      setPublicPayload(payload);
      setSuccess('Публичная безопасная страница успешно открыта.');
    } catch (requestError) {
      setPublicPayload(null);
      setPublicError(requestError.message || 'Ссылка недоступна');
    }
  }

  async function revokePublicLink() {
    setPublicError('');
    setSuccess('');
    setConfirmRevokePublicOpen(false);
    if (!publicToken.trim()) {
      setPublicError('Нет токена для отзыва.');
      return;
    }
    try {
      await apiRequest(`/api/v1/public-links/${encodeURIComponent(publicToken.trim())}/revoke`, { method: 'POST' });
      setSuccess('Ссылка отозвана. Проверяем, что доступ действительно закрыт...');
      try {
        await apiRequest(`/api/v1/public/prescriptions/${encodeURIComponent(publicToken.trim())}`, { auth: false });
        setPublicError('Проверка не пройдена: ссылка всё ещё отвечает.');
      } catch {
        setSuccess('Ссылка успешно отозвана и больше не доступна.');
      }
    } catch (requestError) {
      setPublicError(requestError.message || 'Не удалось отозвать публичную ссылку');
    }
  }

  const visitRows = visits.map((visit) => [
    new Date(visit.created_at).toLocaleString('ru-RU'),
    visit.chief_complaint || '—',
    visit.exam_findings || '—',
    visit.finalized_flag ? 'Завершён' : 'В работе',
    <div key={visit.id} className="flex flex-wrap gap-2">
      {!visit.finalized_flag ? (
        <button
          className="btn-primary !px-3 !py-1"
          type="button"
          onClick={() => finalizeVisit(visit.id)}
          disabled={finalizingVisitId === visit.id}
        >
          {finalizingVisitId === visit.id ? 'Завершаем...' : 'Завершить'}
        </button>
      ) : (
        <span className="badge-green">Завершён</span>
      )}
      <button
        className="btn-secondary !px-3 !py-1"
        type="button"
        onClick={() => setSelectedVisitId(visit.id)}
      >
        Выбрать
      </button>
    </div>,
  ]);

  const documentRows = documents.map((doc) => [
    doc.doc_type || '—',
    doc.file_ref || '—',
    new Date(doc.created_at).toLocaleString('ru-RU'),
  ]);

  const localizedSpecies = pet ? localizePetSpecies(pet.species, 'ru') : '—';
  const localizedBreed = pet ? localizePetBreed(pet.breed, 'ru') : '—';
  const selectedVisit = visits.find((visit) => visit.id === selectedVisitId);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Пациент и ход приёма</h1>
          <p className="page-subtitle">
            Врач видит клиническую историю только при активном согласии владельца. Здесь собраны история приёмов, документы и защищённые ссылки на назначения.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 lg:w-auto">
          <Link href="/vet/patients" className="btn-secondary">
            К списку пациентов
          </Link>
          <a href="#create-visit" className="btn-secondary">
            Начать новый приём
          </a>
          <Link href={`/vet/documents?pet_id=${patientId}`} className="btn-secondary">
            Открыть документы
          </Link>
          {selectedVisitId ? (
            <Link href={`/vet/visit/${selectedVisitId}`} className="btn-primary">
              Открыть поток приёма
            </Link>
          ) : null}
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadPatientCard} /> : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-700">{success}</div>
      ) : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-56 w-full" />
        </section>
      ) : !pet ? (
        <Card>
          <EmptyState
            title="Нет доступа к пациенту"
            text="Активный доступ владельца отсутствует или уровень согласия недостаточен. Карта пациента заблокирована."
          />
          {accessDenied ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-primary" type="button" onClick={requestConsentAccess} disabled={requestingAccess}>
                {requestingAccess ? 'Отправляем...' : 'Запросить доступ у владельца'}
              </button>
              <button className="btn-secondary" type="button" onClick={loadPatientCard}>
                Проверить снова
              </button>
            </div>
          ) : null}
        </Card>
      ) : (
        <>
          <section className="kpi-grid">
            <StatsCard label="Визиты" value={String(visits.length)} />
            <StatsCard label="Документы" value={String(documents.length)} />
            <StatsCard label="Активный визит" value={selectedVisit ? '1' : '0'} />
            <StatsCard label="QR-ссылка" value={publicToken ? 'Готова' : 'Нет'} />
            <StatsCard label="Клиника" value={selectedClinic?.name || 'Не выбрана'} />
        <StatsCard label="Филиал" value={selectedBranch?.address || 'Главный филиал'} />
          </section>

          <section className="grid items-start gap-4 min-[1460px]:grid-cols-[minmax(0,1.34fr)_350px]">
            <div className="showcase-shell min-w-0 p-6 md:p-7">
              <div className="showcase-grid" />
              <div className="showcase-orb left-[6%] top-[14%] h-5 w-5 bg-cyan-400/85 shadow-[0_0_0_14px_rgba(61,147,220,0.12)]" />
              <div className="showcase-orb right-[10%] top-[10%] h-6 w-6 bg-emerald-400/80 shadow-[0_0_0_16px_rgba(66,186,160,0.14)]" />

              <div className="relative z-[1] grid gap-5 2xl:grid-cols-[248px_minmax(0,1fr)] 2xl:items-center">
                <div className="showcase-panel showcase-floating overflow-hidden p-3">
                  <PetVisualGallery
                    pet={pet}
                    language="ru"
                    title="Фото, порода и 3D"
                    subtitle="Основное фото пациента, породный референс и декоративный 3D-визуал в одной клинической карточке."
                    compact
                    className="border-0 bg-transparent p-0 shadow-none"
                    imageClassName="bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.92),rgba(233,244,255,0.96)_72%)] object-contain p-3"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="rounded-full border border-lapka-200 bg-white px-3 py-1.5 text-sm font-semibold text-lapka-700">
                      Пациент визита
                    </span>
                    <span className="badge-green">Доступ подтверждён</span>
                  </div>
                </div>

                <div className="min-w-0">
                  <span className="pill">Клиническая карточка</span>
                  <h2 className="mt-4 text-[2.2rem] font-black tracking-tight text-lapka-900 md:text-[2.85rem]">
                    {pet.name || 'Без имени'}
                  </h2>
                  <p className="mt-2 text-lg text-lapka-700">
                    {localizedSpecies} · {localizedBreed}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2 text-base text-lapka-700">
                    <span className="dense-chip"><span className="font-semibold text-lapka-900">ID:</span> {shortId(pet.id)}</span>
                    <span className="dense-chip"><span className="font-semibold text-lapka-900">Чип:</span> {pet.chip_id || 'Не указан'}</span>
                    <span className="dense-chip"><span className="font-semibold text-lapka-900">Lapka ID:</span> {pet.lapka_id || '—'}</span>
                    <span className="dense-chip"><span className="font-semibold text-lapka-900">Паспорт:</span> {pet.passport_id || 'Не указан'}</span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="showcase-panel p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lapka-500">Визиты</p>
                      <p className="mt-2 text-2xl font-black text-lapka-900">{visits.length}</p>
                      <p className="mt-1 text-sm text-lapka-600">История приёмов по активному согласованию владельца.</p>
                    </div>
                    <div className="showcase-panel p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lapka-500">Документы</p>
                      <p className="mt-2 text-2xl font-black text-lapka-900">{documents.length}</p>
                      <p className="mt-1 text-sm text-lapka-600">Лаборатория, изображения и выписки пациента.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Card id="create-visit" title="Создать визит" subtitle="Новый приём в рамках активного согласия владельца" tone="mint">
              <form className="space-y-3" onSubmit={createVisit}>
                <SymptomAutocomplete
                  label="Симптомы для визита"
                  placeholder="Начните вводить симптом"
                  selectedSymptoms={selectedSymptoms}
                  onChange={setSelectedSymptoms}
                  limit={12}
                />
                <label className="block">
                  <span className="label">Жалобы</span>
                  <textarea
                    className="input min-h-[90px]"
                    value={visitForm.chief_complaint}
                    onChange={(event) => setVisitForm((prev) => ({ ...prev, chief_complaint: event.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="label">Осмотр</span>
                  <textarea
                    className="input min-h-[90px]"
                    value={visitForm.exam_findings}
                    onChange={(event) => setVisitForm((prev) => ({ ...prev, exam_findings: event.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="label">План наблюдения и действий</span>
                  <textarea
                    className="input min-h-[90px]"
                    value={visitForm.plan_note}
                    onChange={(event) => setVisitForm((prev) => ({ ...prev, plan_note: event.target.value }))}
                  />
                </label>
                <button className="btn-primary" type="submit" disabled={creatingVisit}>
                  {creatingVisit ? 'Создаём...' : 'Создать визит'}
                </button>
                <p className="text-xs text-lapka-500">
                  Жалобы, осмотр и план записываются в клинический протокол. Во внешнем контуре владельца отображается только безопасная краткая сводка без служебных деталей.
                </p>
              </form>
            </Card>
          </section>

          <section className="grid items-start gap-4 min-[1540px]:grid-cols-[minmax(0,1.2fr)_360px]">
            <Card title="Визиты пациента" subtitle="Создание, выбор и завершение клинической истории">
              {visitRows.length ? (
                <>
                  <div className="space-y-3 xl:hidden">
                    {visits.map((visit) => (
                      <article key={visit.id} className="rounded-2xl border border-lapka-200 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-bold text-lapka-900">{visit.chief_complaint || 'Без жалоб'}</h3>
                            <p className="mt-1 text-sm text-lapka-600">{new Date(visit.created_at).toLocaleString('ru-RU')}</p>
                          </div>
                          {visit.finalized_flag ? <span className="badge-green">Завершён</span> : <span className="badge-yellow">В работе</span>}
                        </div>
                        <p className="mt-3 text-sm leading-7 text-lapka-700">{visit.exam_findings || 'Осмотр не указан'}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {!visit.finalized_flag ? (
                            <button
                              className="btn-primary !px-3 !py-1"
                              type="button"
                              onClick={() => finalizeVisit(visit.id)}
                              disabled={finalizingVisitId === visit.id}
                            >
                              {finalizingVisitId === visit.id ? 'Завершаем...' : 'Завершить'}
                            </button>
                          ) : null}
                          <button className="btn-secondary !px-3 !py-1" type="button" onClick={() => setSelectedVisitId(visit.id)}>
                            Выбрать
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="hidden xl:block">
                    <Table columns={['Дата', 'Жалобы', 'Осмотр', 'Статус', 'Действия']} rows={visitRows} />
                  </div>
                </>
              ) : (
                <EmptyState title="Визитов пока нет" text="Создайте первый визит для пациента." />
              )}
            </Card>

            <Card title="QR-ссылки для владельца" subtitle="Создание, проверка и отзыв защищённых ссылок на назначения" tone="tinted">
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Выбранный визит</span>
                  <select
                    className="input"
                    value={selectedVisitId}
                    onChange={(event) => setSelectedVisitId(event.target.value)}
                  >
                    <option value="">Выберите визит</option>
                    {visits.map((visit) => (
                      <option key={visit.id} value={visit.id}>
                        {`${new Date(visit.created_at).toLocaleDateString('ru-RU')} · ${shortId(visit.id)}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="label">Срок действия ссылки (часы)</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={168}
                    value={ttlHours}
                    onChange={(event) => setTtlHours(event.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="label">Токен ссылки</span>
                  <input className="input" value={publicToken} onChange={(event) => setPublicToken(event.target.value)} />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" type="button" onClick={createPublicLink}>
                    Создать ссылку
                  </button>
                  <button className="btn-secondary" type="button" onClick={openPublicLink}>
                    Проверить ссылку
                  </button>
                  <button className="btn-secondary" type="button" onClick={() => setConfirmRevokePublicOpen(true)}>
                    Отозвать ссылку
                  </button>
                </div>

                <div className="showcase-panel p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lapka-500">Проверка перед отправкой</p>
                  <p className="mt-2 text-sm leading-7 text-lapka-700">
                    По QR владелец видит только безопасную страницу с назначениями. Полная история визита и служебные заметки врача не раскрываются.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="pill">Действует {ttlHours} ч</span>
                    <span className="pill">{selectedVisit ? 'Визит выбран' : 'Нужно выбрать визит'}</span>
                  </div>
                </div>

                {publicError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{publicError}</div>
                ) : null}
              </div>
            </Card>
          </section>

          <section className="grid items-start gap-4 min-[1540px]:grid-cols-[minmax(0,1.18fr)_360px]">
            <Card title="Предпросмотр страницы по QR" subtitle="Так владелец увидит назначения после открытия ссылки">
              {publicPayload ? (
                <div className="space-y-4">
                  <div className="grid gap-3 2xl:grid-cols-3">
                    <div className="showcase-panel p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lapka-500">Питомец</p>
                      <p className="mt-2 text-xl font-black text-lapka-900">{publicPayload.pet_name || '—'}</p>
                    </div>
                    <div className="showcase-panel p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lapka-500">Визит</p>
                      <p className="mt-2 text-base font-semibold text-lapka-900">{shortId(publicPayload.visit_id)}</p>
                    </div>
                    <div className="showcase-panel p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lapka-500">Действует до</p>
                      <p className="mt-2 text-base font-semibold text-lapka-900">
                        {publicPayload.expires_at ? new Date(publicPayload.expires_at).toLocaleString('ru-RU') : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-lapka-200 bg-lapka-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lapka-500">Назначения по ссылке</p>
                    <div className="mt-3 grid gap-3">
                      {(publicPayload.medications || []).length ? (
                        publicPayload.medications.map((item, idx) => (
                          <div key={`${item.medication_name || 'med'}-${idx}`} className="showcase-panel p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-lg font-black text-lapka-900">{item.medication_name || 'Препарат'}</p>
                                <p className="mt-1 text-sm text-lapka-600">{item.form ? `Форма: ${item.form}` : 'Форма не указана'}</p>
                              </div>
                              <span className={item.prescription_required ? 'badge-yellow' : 'badge-green'}>
                                {item.prescription_required ? 'Рецептурный' : 'Без рецепта'}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-lapka-600">По выбранному визиту пока нет опубликованных назначений.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[28px] border border-lapka-200 bg-lapka-50 p-5 text-base text-lapka-600">
                  Создайте или вставьте токен, чтобы проверить безопасную выдачу по назначению.
                </div>
              )}
            </Card>

            <div className="space-y-4">
              <Card title="Памятка перед отправкой" subtitle="Короткий чек-лист для безопасной публикации" tone="mint">
                <ul className="space-y-3 text-sm leading-7 text-lapka-700">
                  <li>• Убедитесь, что визит завершён и формулировки для владельца безопасны.</li>
                  <li>• Проверьте срок действия перед отправкой QR владельцу.</li>
                  <li>• После отзыва ссылка не должна открываться и не должна раскрывать историю визита.</li>
                </ul>
              </Card>

              <Card title="Документы пациента" subtitle="Список документов по активному уровню доступа">
                {documentRows.length ? (
                  <>
                    <div className="space-y-3 xl:hidden">
                      {documents.map((doc) => (
                        <article key={doc.id} className="rounded-2xl border border-lapka-200 bg-white p-4">
                          <h3 className="text-base font-bold text-lapka-900">{doc.doc_type || 'Документ'}</h3>
                          <p className="mt-1 break-all text-sm text-lapka-600">{doc.file_ref || 'Файл не указан'}</p>
                          <p className="mt-2 text-sm text-lapka-700">{new Date(doc.created_at).toLocaleString('ru-RU')}</p>
                        </article>
                      ))}
                    </div>
                    <div className="hidden xl:block">
                      <Table columns={['Тип', 'Файл', 'Дата']} rows={documentRows} initialPageSize={5} />
                    </div>
                  </>
                ) : (
                  <EmptyState title="Документы отсутствуют" text="Документы появятся после загрузки владельцем или врачом." />
                )}
              </Card>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirmRevokePublicOpen}
        title="Отозвать публичную ссылку?"
        message="После отзыва токен больше не должен открывать страницу назначений."
        confirmLabel="Отозвать ссылку"
        cancelLabel="Оставить активной"
        danger
        onCancel={() => setConfirmRevokePublicOpen(false)}
        onConfirm={revokePublicLink}
      />
    </>
  );
}
