'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Table from '@/components/ui/Table';
import Timeline from '@/components/ui/Timeline';
import { apiRequest } from '@/lib/api';
import { resolvePetPhoto } from '@/lib/pets';
import { getApiBase, getStoredSession } from '@/lib/auth';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

async function downloadOwnerPdf(visitId) {
  const session = getStoredSession();
  if (!session.accessToken) throw new Error('Сессия не найдена');

  const response = await fetch(`${getApiBase()}/api/v1/visits/${visitId}/export/pdf`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!response.ok) {
    let message = 'Не удалось выгрузить PDF';
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
        time: new Date(visit.created_at).toLocaleDateString('ru-RU'),
        text: `${visit.complaints || 'Визит'} · ${visit.finalized_flag ? 'Выписка готова' : 'В работе'}`,
      })),
    [visits]
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
      setError(requestError.message || 'Не удалось загрузить медкарту питомца');
      setPet(null);
      setVisits([]);
      setDocuments([]);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [petId]);

  const loadVisitDetails = useCallback(async (visitId) => {
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
      setError(requestError.message || 'Не удалось загрузить детали визита');
      setSelectedVisit(null);
      setPrescriptions([]);
    } finally {
      setLoadingVisit(false);
    }
  }, []);

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
      await downloadOwnerPdf(selectedVisitId);
      setSuccess('PDF выписки загружен.');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось выгрузить PDF');
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
      setSuccess('Публичная ссылка назначений сформирована на 24 часа.');
      window.open(`/public-rx/${payload.token}`, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось открыть назначения');
    } finally {
      setActionState((prev) => ({ ...prev, openingPrescription: false }));
    }
  }

  const visitRows = visits.map((visit) => [
    formatDate(visit.created_at),
    visit.complaints || '—',
    visit.status || 'черновик',
    visit.finalized_flag ? 'Да' : 'Нет',
    <button
      key={visit.id}
      className={selectedVisitId === visit.id ? 'btn-primary !px-3 !py-1' : 'btn-secondary !px-3 !py-1'}
      type="button"
      onClick={() => setSelectedVisitId(visit.id)}
    >
      Показать визит
    </button>,
  ]);

  const prescriptionRows = prescriptions.map((item) => [
    item.drug_name,
    item.prescription_required ? <span key={`${item.id}-rx`} className="badge-red">РЕЦЕПТУРНОЕ</span> : <span key={`${item.id}-otc`} className="badge-green">БЕЗ РЕЦЕПТА</span>,
    item.notes || '—',
  ]);

  const relatedDocs = documents.slice(0, 6).map((doc) => [
    doc.doc_type || 'document',
    formatDate(doc.created_at),
    doc.file_ref || '—',
  ]);

  const visitNotifications = notifications
    .filter((row) => row.pet_id === petId)
    .slice(0, 5)
    .map((row) => [formatDate(row.created_at), row.title, row.notification_type]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Медкарта питомца</h1>
          <p className="page-subtitle">
            Безопасная сводка визитов: история приёмов, документы и доступ к назначениям по защищённой ссылке.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="button" onClick={loadPetRecords}>
            Обновить
          </button>
          <button className="btn-primary" type="button" onClick={onExportPdf} disabled={!selectedVisitId || actionState.exporting}>
            {actionState.exporting ? 'Генерируем...' : 'Скачать PDF'}
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
        <EmptyState title="Питомец не найден" text="Проверьте ID питомца или вернитесь в список." />
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Медкарта питомца"
            title={`${pet.name || 'Питомец'}: история визитов и документов в одном окне`}
            description="Владелец видит безопасную выписку, связанные документы и публичные назначения без дозировок и врачебных служебных заметок."
            imageSrc={resolvePetPhoto(pet)}
            imageAlt="Карточка питомца"
            badges={[
              `${visits.length} визитов`,
              `${documents.length} документов`,
              `${notifications.filter((row) => row.pet_id === petId).length} уведомлений`,
            ]}
          />

          <section className="kpi-grid">
          <Card title="Визиты" subtitle="Все приёмы в понятном формате для владельца">
              <p className="text-4xl font-black tracking-tight text-lapka-900">{visits.length}</p>
            </Card>
            <Card title="Документы" subtitle="Анализы, снимки и выписки">
              <p className="text-4xl font-black tracking-tight text-lapka-900">{documents.length}</p>
            </Card>
            <Card title="Назначения" subtitle="Только безопасное представление">
              <p className="text-4xl font-black tracking-tight text-lapka-900">{prescriptions.length}</p>
            </Card>
            <Card title="Уведомления" subtitle="Готовность выписки и напоминания">
              <p className="text-4xl font-black tracking-tight text-lapka-900">{notifications.filter((row) => row.pet_id === petId).length}</p>
            </Card>
          </section>

          <section className="grid-soft-2">
            <Card title={`${pet.name || 'Питомец'} · ${pet.species || '—'}`} subtitle={pet.breed || 'порода не указана'}>
              <div className="space-y-4 text-sm text-lapka-700">
                <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="relative overflow-hidden rounded-[26px] border border-lapka-200 bg-[radial-gradient(circle_at_20%_20%,rgba(89,182,255,0.16),transparent_44%),linear-gradient(180deg,#f7fbff_0%,#edf7ff_100%)] p-3 shadow-soft">
                    <AppImage
                      src={resolvePetPhoto(pet)}
                      alt={pet.name || 'Питомец'}
                      width={720}
                      height={720}
                      sizes="200px"
                      className="h-44 w-full object-contain drop-shadow-[0_26px_34px_rgba(22,63,110,0.18)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                      <p>ID: {pet.id}</p>
                      <p>Чип: {pet.chip_id || '—'}</p>
                      <p>Lapka ID: {pet.lapka_id || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-lapka-200 bg-white px-3 py-3">
                      <p className="font-semibold text-lapka-900">Фокус текущего режима владельца</p>
                      <p className="mt-1 text-lapka-600">
                        Здесь собраны визиты, документы и публичные назначения без служебных врачебных деталей.
                      </p>
                    </div>
                  </div>
                </div>
                {timelineItems.length ? (
                  <Timeline items={timelineItems} />
                ) : (
                  <EmptyState title="Нет истории визитов" text="После первого приёма здесь появится таймлайн." />
                )}
              </div>
            </Card>

            <Card title="Уведомления по визитам" subtitle="Подтверждение записи, готовность выписки и напоминания">
              {visitNotifications.length ? (
                <Table columns={['Дата', 'Событие', 'Тип']} rows={visitNotifications} />
              ) : (
                <EmptyState title="Уведомлений пока нет" text="Система покажет напоминания и готовность выписки." />
              )}
            </Card>
          </section>

            <Card title="Визиты питомца" subtitle="Выберите визит для просмотра безопасной сводки для владельца">
            {visitRows.length ? (
              <Table columns={['Дата', 'Жалобы', 'Статус', 'Выписка', 'Действие']} rows={visitRows} />
            ) : (
              <EmptyState title="Визитов пока нет" text="Запишитесь на приём, чтобы начать историю медкарты." />
            )}
          </Card>

          <section className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
            <Card title="Выписка для владельца" subtitle={selectedVisit ? `Визит ${selectedVisit.id}` : 'Выберите визит'}>
              {loadingVisit ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : !selectedVisit ? (
                <EmptyState title="Визит не выбран" text="Выберите визит в таблице выше." />
              ) : (
                <div className="space-y-3 text-sm text-lapka-700">
                  <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2">
                    <p className="font-semibold text-lapka-900">Краткое резюме для владельца</p>
                    <p className="mt-1">{selectedVisit.owner_summary || 'Выписка готовится врачом.'}</p>
                  </div>
                  <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                    <p className="font-semibold text-lapka-900">План контроля</p>
                    <p className="mt-1">{selectedVisit.follow_up_note || 'План контроля будет указан после финализации визита.'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" type="button" onClick={onOpenPublicPrescriptions} disabled={actionState.openingPrescription || !selectedVisit.finalized_flag}>
                      {actionState.openingPrescription ? 'Открываем...' : 'Открыть назначения'}
                    </button>
                    <Link className="btn-secondary" href={`/owner/pharmacy?q=${encodeURIComponent(prescriptions[0]?.drug_name || '')}`}>
                      Найти аптеки рядом
                    </Link>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Назначения и вложения" subtitle="Без дозировок, только безопасное представление">
              {prescriptionRows.length ? (
                <Table columns={['Препарат', 'Флаг', 'Статус']} rows={prescriptionRows} />
              ) : (
                <EmptyState title="Назначений пока нет" text="Назначения появятся после завершения визита." />
              )}
            </Card>
          </section>

          <Card title="Документы визита" subtitle="Анализы, рентген, УЗИ, выписки">
            {relatedDocs.length ? (
              <Table columns={['Тип', 'Дата', 'Файл']} rows={relatedDocs} />
            ) : (
              <EmptyState title="Документы пока не загружены" text="Добавьте документы в центр документов питомца." />
            )}
          </Card>
        </>
      )}
    </>
  );
}
