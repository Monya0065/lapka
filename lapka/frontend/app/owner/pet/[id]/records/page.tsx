'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Table from '@/components/ui/Table';
import Timeline from '@/components/ui/Timeline';
import { apiRequest } from '@/lib/api';
import { localizeDocumentType, resolvePetPhoto } from '@/lib/pets';
import { getApiBase, getStoredSession } from '@/lib/auth';

function formatDate(value, dateLocale) {
  if (!value) return '—';
  return new Date(value).toLocaleString(dateLocale);
}

async function downloadOwnerPdf(visitId, isEn) {
  const session = getStoredSession();
  if (!session.accessToken) throw new Error(isEn ? 'Session not found' : 'Сессия не найдена');

  const response = await fetch(`${getApiBase()}/api/v1/visits/${visitId}/export/pdf`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!response.ok) {
    let message = isEn ? 'Failed to download PDF' : 'Не удалось выгрузить PDF';
    try {
      const payload = await response.json();
      message = payload?.detail?.message || payload?.message || message;
    } catch {
      // ignore parse errors for binary body
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `lapka-pet-summary-${visitId}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export default function OwnerPetRecordsPage() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');
  const dateLocale = isEn ? 'en-US' : 'ru-RU';
  const docLocale = isEn ? 'en' : 'ru';

  const params = useParams();
  const petId = useMemo(() => String(params?.id || ''), [params]);

  const [pet, setPet] = useState(null);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingVisit, setLoadingVisit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionState, setActionState] = useState({
    exporting: false,
    openingPrescription: false,
  });

  const timelineItems = useMemo(
    () =>
      visits.slice(0, 8).map((visit) => ({
        time: new Date(visit.created_at).toLocaleDateString(dateLocale),
        text: `${visit.complaints || (isEn ? 'Visit' : 'Визит')} · ${
          visit.finalized_flag ? (isEn ? 'Discharge ready' : 'Выписка готова') : isEn ? 'In progress' : 'В работе'
        }`,
      })),
    [dateLocale, isEn, visits]
  );

  const loadPetRecords = useCallback(async () => {
    if (!petId) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const [petPayload, visitsPayload, docsPayload, notificationsPayload] = await Promise.all([
        apiRequest(`/api/v1/pets/${petId}`),
        apiRequest(`/api/v1/visits?pet_id=${encodeURIComponent(petId)}&limit=100`),
        apiRequest(`/api/v1/documents?pet_id=${encodeURIComponent(petId)}`),
        apiRequest('/api/v1/notifications?limit=100'),
      ]);

      const visitsRows = Array.isArray(visitsPayload) ? visitsPayload : [];
      setPet(petPayload || null);
      setVisits(visitsRows);
      setDocuments(Array.isArray(docsPayload) ? docsPayload : []);
      setNotifications(Array.isArray(notificationsPayload) ? notificationsPayload : []);

      const latestVisitId = visitsRows[0]?.id || '';
      setSelectedVisitId((prev) => (prev && visitsRows.some((row) => row.id === prev) ? prev : latestVisitId));
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to load pet medical record' : 'Не удалось загрузить медкарту питомца'));
      setPet(null);
      setVisits([]);
      setDocuments([]);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [isEn, petId]);

  const loadVisitDetails = useCallback(
    async (visitId) => {
      if (!visitId) {
        setSelectedVisit(null);
        setPrescriptions([]);
        return;
      }
      setLoadingVisit(true);
      setError('');
      try {
        const [visitPayload, prescriptionsPayload] = await Promise.all([
          apiRequest(`/api/v1/visits/${visitId}`),
          apiRequest(`/api/v1/visits/${visitId}/prescriptions`),
        ]);
        setSelectedVisit(visitPayload || null);
        setPrescriptions(Array.isArray(prescriptionsPayload) ? prescriptionsPayload : []);
      } catch (requestError) {
        setError(requestError.message || (isEn ? 'Failed to load visit details' : 'Не удалось загрузить детали визита'));
        setSelectedVisit(null);
        setPrescriptions([]);
      } finally {
        setLoadingVisit(false);
      }
    },
    [isEn]
  );

  useEffect(() => {
    loadPetRecords();
  }, [loadPetRecords]);

  useEffect(() => {
    if (selectedVisitId) {
      loadVisitDetails(selectedVisitId);
    }
  }, [loadVisitDetails, selectedVisitId]);

  async function onExportPdf() {
    if (!selectedVisitId) return;
    setActionState((prev) => ({ ...prev, exporting: true }));
    setError('');
    setSuccess('');
    try {
      await downloadOwnerPdf(selectedVisitId, isEn);
      setSuccess(isEn ? 'Discharge PDF downloaded.' : 'PDF выписки загружен.');
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to download PDF' : 'Не удалось выгрузить PDF'));
    } finally {
      setActionState((prev) => ({ ...prev, exporting: false }));
    }
  }

  async function onOpenPublicPrescriptions() {
    if (!selectedVisitId || !petId) return;
    setActionState((prev) => ({ ...prev, openingPrescription: true }));
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest('/api/v1/public-links/prescription', {
        method: 'POST',
        body: { visit_id: selectedVisitId, pet_id: petId, expires_in_hours: 24 },
      });
      setSuccess(isEn ? 'Public prescriptions link created for 24 hours.' : 'Публичная ссылка назначений сформирована на 24 часа.');
      window.open(`/public-rx/${payload.token}`, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to open prescriptions' : 'Не удалось открыть назначения'));
    } finally {
      setActionState((prev) => ({ ...prev, openingPrescription: false }));
    }
  }

  const draftLabel = isEn ? 'draft' : 'черновик';

  const visitRows = visits.map((visit) => [
    formatDate(visit.created_at, dateLocale),
    visit.complaints || '—',
    visit.status || draftLabel,
    visit.finalized_flag ? (isEn ? 'Yes' : 'Да') : isEn ? 'No' : 'Нет',
    <button
      key={visit.id}
      className={selectedVisitId === visit.id ? 'btn-primary !px-3 !py-1' : 'btn-secondary !px-3 !py-1'}
      type="button"
      onClick={() => setSelectedVisitId(visit.id)}
    >
      {isEn ? 'View visit' : 'Показать визит'}
    </button>,
  ]);

  const prescriptionRows = prescriptions.map((item) => [
    item.drug_name,
    item.prescription_required ? (
      <span key={`${item.id}-rx`} className="badge-red">
        {isEn ? 'RX' : 'РЕЦЕПТУРНОЕ'}
      </span>
    ) : (
      <span key={`${item.id}-otc`} className="badge-green">
        {isEn ? 'OTC' : 'БЕЗ РЕЦЕПТА'}
      </span>
    ),
    item.notes || '—',
  ]);

  const relatedDocs = documents.slice(0, 6).map((doc) => [
    localizeDocumentType(doc.doc_type, docLocale),
    formatDate(doc.created_at, dateLocale),
    doc.file_ref || '—',
  ]);

  const visitNotifications = notifications
    .filter((row) => row.pet_id === petId)
    .slice(0, 5)
    .map((row) => [formatDate(row.created_at, dateLocale), row.title, row.notification_type]);

  const petFallback = isEn ? 'Pet' : 'Питомец';
  const notifCount = notifications.filter((row) => row.pet_id === petId).length;

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">{isEn ? 'Pet medical record' : 'Медкарта питомца'}</h1>
          <p className="page-subtitle">
            {isEn
              ? 'Safe visit summary: visit history, documents and prescriptions via a protected link.'
              : 'Безопасная сводка визитов: история приёмов, документы и доступ к назначениям по защищённой ссылке.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="button" onClick={loadPetRecords}>
            {isEn ? 'Refresh' : 'Обновить'}
          </button>
          <button className="btn-primary" type="button" onClick={onExportPdf} disabled={!selectedVisitId || actionState.exporting}>
            {actionState.exporting ? (isEn ? 'Generating…' : 'Генерируем...') : isEn ? 'Download PDF' : 'Скачать PDF'}
          </button>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadPetRecords} /> : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
      ) : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </section>
      ) : !pet ? (
        <EmptyState
          title={isEn ? 'Pet not found' : 'Питомец не найден'}
          text={isEn ? 'Check the pet ID or return to the list.' : 'Проверьте ID питомца или вернитесь в список.'}
        />
      ) : (
        <>
          <ShowcasePanel
            eyebrow={isEn ? 'Pet medical record' : 'Медкарта питомца'}
            title={
              isEn
                ? `${pet.name || petFallback}: visits and documents in one view`
                : `${pet.name || petFallback}: история визитов и документов в одном окне`
            }
            description={
              isEn
                ? 'Owners see a safe discharge summary, related documents and public prescriptions — without dosages or internal vet notes.'
                : 'Владелец видит безопасную выписку, связанные документы и публичные назначения без дозировок и врачебных служебных заметок.'
            }
            imageSrc={resolvePetPhoto(pet)}
            imageAlt={isEn ? 'Pet card' : 'Карточка питомца'}
            badges={[
              isEn ? `${visits.length} visits` : `${visits.length} визитов`,
              isEn ? `${documents.length} documents` : `${documents.length} документов`,
              isEn ? `${notifCount} notifications` : `${notifCount} уведомлений`,
            ]}
          />

          <section className="kpi-grid">
            <Card
              title={isEn ? 'Visits' : 'Визиты'}
              subtitle={isEn ? 'All visits in an owner-friendly format' : 'Все приёмы в понятном формате для владельца'}
            >
              <p className="text-4xl font-black tracking-tight text-lapka-900">{visits.length}</p>
            </Card>
            <Card title={isEn ? 'Documents' : 'Документы'} subtitle={isEn ? 'Labs, imaging and discharge notes' : 'Анализы, снимки и выписки'}>
              <p className="text-4xl font-black tracking-tight text-lapka-900">{documents.length}</p>
            </Card>
            <Card
              title={isEn ? 'Prescriptions' : 'Назначения'}
              subtitle={isEn ? 'Safe presentation only' : 'Только безопасное представление'}
            >
              <p className="text-4xl font-black tracking-tight text-lapka-900">{prescriptions.length}</p>
            </Card>
            <Card
              title={isEn ? 'Notifications' : 'Уведомления'}
              subtitle={isEn ? 'Discharge readiness and reminders' : 'Готовность выписки и напоминания'}
            >
              <p className="text-4xl font-black tracking-tight text-lapka-900">{notifCount}</p>
            </Card>
          </section>

          <section className="grid-soft-2">
            <Card
              title={`${pet.name || petFallback} · ${pet.species || '—'}`}
              subtitle={pet.breed || (isEn ? 'Breed not set' : 'порода не указана')}
            >
              <div className="space-y-4 text-sm text-lapka-700">
                <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="relative overflow-hidden rounded-[26px] border border-lapka-200 bg-[radial-gradient(circle_at_20%_20%,rgba(89,182,255,0.16),transparent_44%),linear-gradient(180deg,#f7fbff_0%,#edf7ff_100%)] p-3 shadow-soft">
                    <AppImage
                      src={resolvePetPhoto(pet)}
                      alt={pet.name || petFallback}
                      width={720}
                      height={720}
                      sizes="200px"
                      className="h-44 w-full object-contain drop-shadow-[0_26px_34px_rgba(22,63,110,0.18)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                      <p>ID: {pet.id}</p>
                      <p>
                        {isEn ? 'Microchip' : 'Чип'}: {pet.chip_id || '—'}
                      </p>
                      <p>Lapka ID: {pet.lapka_id || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-lapka-200 bg-white px-3 py-3">
                      <p className="font-semibold text-lapka-900">{isEn ? 'Owner view focus' : 'Фокус текущего режима владельца'}</p>
                      <p className="mt-1 text-lapka-600">
                        {isEn
                          ? 'Visits, documents and public prescriptions without internal clinical detail.'
                          : 'Здесь собраны визиты, документы и публичные назначения без служебных врачебных деталей.'}
                      </p>
                    </div>
                  </div>
                </div>
                {timelineItems.length ? (
                  <Timeline items={timelineItems} />
                ) : (
                  <EmptyState
                    title={isEn ? 'No visit history yet' : 'Нет истории визитов'}
                    text={isEn ? 'After the first visit, a timeline will appear here.' : 'После первого приёма здесь появится таймлайн.'}
                  />
                )}
              </div>
            </Card>

            <Card
              title={isEn ? 'Visit notifications' : 'Уведомления по визитам'}
              subtitle={isEn ? 'Booking confirmation, discharge readiness and reminders' : 'Подтверждение записи, готовность выписки и напоминания'}
            >
              {visitNotifications.length ? (
                <Table
                  columns={isEn ? ['Date', 'Event', 'Type'] : ['Дата', 'Событие', 'Тип']}
                  rows={visitNotifications}
                />
              ) : (
                <EmptyState
                  title={isEn ? 'No notifications yet' : 'Уведомлений пока нет'}
                  text={isEn ? 'The system will show reminders and discharge readiness.' : 'Система покажет напоминания и готовность выписки.'}
                />
              )}
            </Card>
          </section>

          <Card
            title={isEn ? 'Pet visits' : 'Визиты питомца'}
            subtitle={isEn ? 'Pick a visit to see the owner-safe summary' : 'Выберите визит для просмотра безопасной сводки для владельца'}
          >
            {visitRows.length ? (
              <Table
                columns={
                  isEn ? ['Date', 'Complaints', 'Status', 'Discharge', 'Action'] : ['Дата', 'Жалобы', 'Статус', 'Выписка', 'Действие']
                }
                rows={visitRows}
              />
            ) : (
              <EmptyState
                title={isEn ? 'No visits yet' : 'Визитов пока нет'}
                text={isEn ? 'Book a visit to start the medical record.' : 'Запишитесь на приём, чтобы начать историю медкарты.'}
              />
            )}
          </Card>

          <section className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
            <Card
              title={isEn ? 'Owner discharge summary' : 'Выписка для владельца'}
              subtitle={
                selectedVisit
                  ? isEn
                    ? `Visit ${selectedVisit.id}`
                    : `Визит ${selectedVisit.id}`
                  : isEn
                    ? 'Select a visit'
                    : 'Выберите визит'
              }
            >
              {loadingVisit ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : !selectedVisit ? (
                <EmptyState
                  title={isEn ? 'No visit selected' : 'Визит не выбран'}
                  text={isEn ? 'Choose a visit in the table above.' : 'Выберите визит в таблице выше.'}
                />
              ) : (
                <div className="space-y-3 text-sm text-lapka-700">
                  <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2">
                    <p className="font-semibold text-lapka-900">{isEn ? 'Short owner summary' : 'Краткое резюме для владельца'}</p>
                    <p className="mt-1">
                      {selectedVisit.owner_summary || (isEn ? 'Discharge is being prepared by your vet.' : 'Выписка готовится врачом.')}
                    </p>
                  </div>
                  <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                    <p className="font-semibold text-lapka-900">{isEn ? 'Follow-up plan' : 'План контроля'}</p>
                    <p className="mt-1">
                      {selectedVisit.follow_up_note ||
                        (isEn
                          ? 'Follow-up will appear after the visit is finalized.'
                          : 'План контроля будет указан после финализации визита.')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-primary"
                      type="button"
                      onClick={onOpenPublicPrescriptions}
                      disabled={actionState.openingPrescription || !selectedVisit.finalized_flag}
                    >
                      {actionState.openingPrescription ? (isEn ? 'Opening…' : 'Открываем...') : isEn ? 'Open prescriptions' : 'Открыть назначения'}
                    </button>
                    <Link className="btn-secondary" href={`/owner/pharmacy?q=${encodeURIComponent(prescriptions[0]?.drug_name || '')}`}>
                      {isEn ? 'Find nearby pharmacies' : 'Найти аптеки рядом'}
                    </Link>
                  </div>
                </div>
              )}
            </Card>

            <Card
              title={isEn ? 'Prescriptions and attachments' : 'Назначения и вложения'}
              subtitle={isEn ? 'No dosages — safe view only' : 'Без дозировок, только безопасное представление'}
            >
              {prescriptionRows.length ? (
                <Table columns={isEn ? ['Drug', 'Flag', 'Notes'] : ['Препарат', 'Флаг', 'Статус']} rows={prescriptionRows} />
              ) : (
                <EmptyState
                  title={isEn ? 'No prescriptions yet' : 'Назначений пока нет'}
                  text={isEn ? 'Prescriptions appear after the visit is completed.' : 'Назначения появятся после завершения визита.'}
                />
              )}
            </Card>
          </section>

          <Card
            title={isEn ? 'Visit documents' : 'Документы визита'}
            subtitle={isEn ? 'Labs, X-ray, ultrasound, discharge notes' : 'Анализы, рентген, УЗИ, выписки'}
          >
            {relatedDocs.length ? (
              <Table columns={isEn ? ['Type', 'Date', 'File'] : ['Тип', 'Дата', 'Файл']} rows={relatedDocs} />
            ) : (
              <EmptyState
                title={isEn ? 'No documents uploaded yet' : 'Документы пока не загружены'}
                text={isEn ? 'Add documents in your pet document hub.' : 'Добавьте документы в центр документов питомца.'}
              />
            )}
          </Card>
        </>
      )}
    </>
  );
}
