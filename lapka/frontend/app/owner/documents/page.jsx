'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import { apiRequest } from '@/lib/api';
import { getApiBase } from '@/lib/auth';
import { localizeDocumentType, resolvePetPhoto } from '@/lib/pets';

function formatDateTime(value, locale = 'ru-RU') {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getTabs(isEn) {
  return [
    { id: 'overview', label: isEn ? 'Overview' : 'Обзор' },
    { id: 'archive', label: isEn ? 'Archive' : 'Архив' },
    { id: 'parsing', label: isEn ? 'Review' : 'Разбор' },
    { id: 'export', label: isEn ? 'Share with vet' : 'Поделиться с врачом' },
  ];
}

function getDocTypeOptions(isEn) {
  const rows = [
    ['blood_test', 'Общий анализ крови', 'Complete blood count'],
    ['biochemistry', 'Биохимия', 'Blood chemistry'],
    ['xray', 'Рентген', 'X-ray'],
    ['ultrasound', 'УЗИ', 'Ultrasound'],
    ['discharge', 'Выписка', 'Discharge summary'],
    ['prescription', 'Назначение', 'Prescription'],
    ['insurance', 'Страховой документ', 'Insurance document'],
    ['receipt', 'Чек / сервисный документ', 'Receipt / service document'],
    ['photo', 'Фото документа', 'Document photo'],
  ];
  return rows.map(([value, ru, en]) => ({ value, label: isEn ? en : ru }));
}

function normalizeDocType(value) {
  return String(value || '').trim().toLowerCase();
}

function isLabLike(docType) {
  return ['blood_test', 'biochemistry', 'lab', 'analysis'].some((token) => normalizeDocType(docType).includes(token));
}

function isImagingLike(docType) {
  return ['xray', 'ultrasound', 'mri', 'ct'].some((token) => normalizeDocType(docType).includes(token));
}

function isPrescriptionLike(docType) {
  return ['prescription', 'назнач', 'rx'].some((token) => normalizeDocType(docType).includes(token));
}

function isDischargeLike(docType) {
  return ['discharge', 'выпис'].some((token) => normalizeDocType(docType).includes(token));
}

function buildParsingPreview(doc, pet, relatedVisit, isEn) {
  const kind = normalizeDocType(doc?.doc_type);
  const docLocale = isEn ? 'en' : 'ru';
  const dateLocale = isEn ? 'en-US' : 'ru-RU';
  const extracted = [
    `${isEn ? 'Document type' : 'Тип документа'}: ${localizeDocumentType(doc?.doc_type, docLocale)}`,
    `${isEn ? 'Added' : 'Дата добавления'}: ${formatDateTime(doc?.created_at, dateLocale)}`,
    pet?.name ? `${isEn ? 'Pet' : 'Питомец'}: ${pet.name}` : null,
    relatedVisit
      ? (isEn ? 'Linked visit found in digital record' : 'Есть связанный визит в цифровой карте')
      : (isEn ? 'No linked visit found automatically' : 'Связанный визит не найден автоматически'),
  ].filter(Boolean);

  let summary = isEn
    ? 'Document is in the archive and ready to view, download and get a safe owner explanation.'
    : 'Документ добавлен в архив и готов к просмотру, скачиванию и безопасному объяснению для владельца.';
  let nextStep = isEn
    ? 'Open safe explanation and prepare questions for your vet before the next visit.'
    : 'Откройте безопасное объяснение и подготовьте вопросы врачу к следующему визиту.';
  let tag = isEn ? 'Archive' : 'Архив';

  if (isLabLike(kind)) {
    summary = isEn
      ? 'Lapka treats this as a lab document and can provide a safe explanation without treatment or dosages.'
      : 'Lapka распознала лабораторный документ и подготовит безопасное объяснение без лечения и дозировок.';
    nextStep = isEn
      ? 'Check the lab date and discuss with your vet which deviations actually matter.'
      : 'Сверьте дату анализа и обсудите с врачом, какие отклонения действительно значимы.';
    tag = isEn ? 'Laboratory' : 'Лаборатория';
  } else if (isImagingLike(kind)) {
    summary = isEn
      ? 'This looks like imaging and fits well in one archive alongside the visit.'
      : 'Документ относится к визуальной диагностике и хорошо подходит для хранения в едином архиве с визитом.';
    nextStep = isEn
      ? 'Bring the images and symptom history to a follow-up visit or online consult.'
      : 'Покажите изображение и историю симптомов на повторном визите или при онлайн-консультации.';
    tag = isEn ? 'Imaging' : 'Диагностика';
  } else if (isPrescriptionLike(kind)) {
    summary = isEn
      ? 'This relates to prescriptions and links to the medication center and next owner actions.'
      : 'Документ относится к назначениям и связывается с центром лекарств и следующими действиями владельца.';
    nextStep = isEn
      ? 'Review active prescriptions and move important meds into the medication center.'
      : 'Проверьте активные назначения и перенесите важные препараты в центр лекарств.';
    tag = isEn ? 'Prescription' : 'Назначение';
  } else if (isDischargeLike(kind)) {
    summary = isEn
      ? 'This looks like a discharge note and supports a short safe history between visits.'
      : 'Документ похож на выписку и подходит для краткой безопасной истории между визитами.';
    nextStep = isEn
      ? 'Keep the discharge in the archive and open the health timeline so context is not lost.'
      : 'Сохраните выписку в архиве и откройте ленту здоровья, чтобы не потерять контекст.';
    tag = isEn ? 'Discharge' : 'Выписка';
  }

  return { extracted, summary, nextStep, tag };
}

function getPreferredClinicId({ petId, visits, appointments, documents }) {
  const latestVisit = visits
    .filter((row) => row.pet_id === petId)
    .sort((a, b) => new Date(b.created_at || b.started_at || 0) - new Date(a.created_at || a.started_at || 0))[0];
  if (latestVisit?.clinic_id) return latestVisit.clinic_id;

  const latestAppointment = appointments
    .filter((row) => row.pet_id === petId)
    .sort((a, b) => new Date(b.scheduled_at || 0) - new Date(a.scheduled_at || 0))[0];
  if (latestAppointment?.clinic_id) return latestAppointment.clinic_id;

  const latestDocument = documents
    .filter((row) => row.pet_id === petId)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  if (latestDocument?.clinic_id) return latestDocument.clinic_id;

  return null;
}

function findRelatedVisit(doc, visits) {
  const docTime = new Date(doc.created_at || 0).getTime();
  return visits
    .filter((visit) => visit.pet_id === doc.pet_id && visit.clinic_id === doc.clinic_id)
    .sort((a, b) => {
      const aDiff = Math.abs(new Date(a.created_at || a.started_at || 0).getTime() - docTime);
      const bDiff = Math.abs(new Date(b.created_at || b.started_at || 0).getTime() - docTime);
      return aDiff - bDiff;
    })[0] || null;
}

export default function OwnerDocumentsEntryPage() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');
  const dateLocale = isEn ? 'en-US' : 'ru-RU';
  const docLocale = isEn ? 'en' : 'ru';
  const tabs = getTabs(isEn);
  const docTypeOptions = getDocTypeOptions(isEn);

  const [pets, setPets] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [visits, setVisits] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [tab, setTab] = useState('overview');
  const [selectedPetId, setSelectedPetId] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [parsingById, setParsingById] = useState({});
  const [explainingId, setExplainingId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    petId: '',
    docType: 'blood_test',
    file: null,
  });

  const loadDocumentsHub = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [petsPayload, docsPayload, visitsPayload, appointmentsPayload] = await Promise.all([
        apiRequest('/api/v1/pets'),
        apiRequest('/api/v1/documents?limit=200'),
        apiRequest('/api/v1/visits?limit=200'),
        apiRequest('/api/v1/appointments?mine=true'),
      ]);

      const petRows = Array.isArray(petsPayload) ? petsPayload : [];
      const docRows = Array.isArray(docsPayload) ? docsPayload : [];
      const visitRows = Array.isArray(visitsPayload) ? visitsPayload : [];
      const appointmentRows = Array.isArray(appointmentsPayload) ? appointmentsPayload : [];

      setPets(petRows);
      setDocuments(docRows);
      setVisits(visitRows);
      setAppointments(appointmentRows);
      setSelectedPetId((current) => current && petRows.some((item) => item.id === current) ? current : (petRows[0]?.id || ''));
      setUploadForm((current) => ({ ...current, petId: current.petId && petRows.some((item) => item.id === current.petId) ? current.petId : (petRows[0]?.id || '') }));
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to load document hub' : 'Не удалось загрузить центр документов'));
      setPets([]);
      setDocuments([]);
      setVisits([]);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  useEffect(() => {
    loadDocumentsHub();
  }, [loadDocumentsHub]);

  const filteredDocuments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...documents]
      .filter((item) => !selectedPetId || item.pet_id === selectedPetId)
      .filter((item) => {
        if (!q) return true;
        return [item.doc_type, item.file_ref].join(' ').toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [documents, query, selectedPetId]);

  useEffect(() => {
    if (!filteredDocuments.length) {
      setSelectedDocId('');
      return;
    }
    setSelectedDocId((current) => current && filteredDocuments.some((item) => item.id === current) ? current : filteredDocuments[0].id);
  }, [filteredDocuments]);

  const selectedPet = useMemo(
    () => pets.find((item) => item.id === selectedPetId) || null,
    [pets, selectedPetId]
  );

  const selectedDocument = useMemo(
    () => filteredDocuments.find((item) => item.id === selectedDocId) || filteredDocuments[0] || null,
    [filteredDocuments, selectedDocId]
  );

  const selectedDocumentPet = useMemo(
    () => pets.find((item) => item.id === selectedDocument?.pet_id) || null,
    [pets, selectedDocument]
  );

  const selectedRelatedVisit = useMemo(
    () => selectedDocument ? findRelatedVisit(selectedDocument, visits) : null,
    [selectedDocument, visits]
  );

  const selectedParsing = useMemo(
    () => (selectedDocument ? buildParsingPreview(selectedDocument, selectedDocumentPet, selectedRelatedVisit, isEn) : null),
    [isEn, selectedDocument, selectedDocumentPet, selectedRelatedVisit]
  );

  const stats = useMemo(() => ({
    documents: filteredDocuments.length,
    pets: selectedPetId ? 1 : pets.length,
    parsed: Object.keys(parsingById).length,
    visitLinked: filteredDocuments.filter((doc) => findRelatedVisit(doc, visits)).length,
  }), [filteredDocuments, parsingById, pets.length, selectedPetId, visits]);

  const groupedByPet = useMemo(() => {
    const map = new Map();
    filteredDocuments.forEach((doc) => {
      const pet = pets.find((item) => item.id === doc.pet_id);
      const key = pet?.id || 'unknown';
      if (!map.has(key)) {
        map.set(key, { pet, rows: [] });
      }
      map.get(key).rows.push(doc);
    });
    return Array.from(map.values());
  }, [filteredDocuments, pets]);

  const exportDocuments = useMemo(() => filteredDocuments.slice(0, 8), [filteredDocuments]);

  async function handleExplain(doc) {
    if (!doc || parsingById[doc.id]) return;
    setExplainingId(doc.id);
    try {
      const payload = await apiRequest(`/api/v1/documents/${doc.id}/ai-explain`, {
        method: 'POST',
        body: {},
      });
      setParsingById((current) => ({ ...current, [doc.id]: payload }));
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to run safe document review' : 'Не удалось выполнить безопасный разбор документа'));
    } finally {
      setExplainingId('');
    }
  }

  async function handleDownload(doc) {
    try {
      const payload = await apiRequest(`/api/v1/documents/${doc.id}/download`);
      const downloadUrl = payload?.download_url ? `${getApiBase()}${payload.download_url}` : null;
      if (downloadUrl && typeof window !== 'undefined') {
        window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to prepare document download' : 'Не удалось подготовить скачивание документа'));
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    const petId = uploadForm.petId;
    const file = uploadForm.file;
    if (!petId || !file) {
      setError(isEn ? 'Select a pet and a file to upload.' : 'Выберите питомца и файл для загрузки.');
      return;
    }

    const clinicId = getPreferredClinicId({ petId, visits, appointments, documents });
    if (!clinicId) {
      setError(isEn ? 'No clinic in history for this pet yet. Add at least one visit or document first.' : 'Для этого питомца пока нет клиники в истории. Сначала нужен хотя бы один визит или документ.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('pet_id', petId);
    formData.append('clinic_id', clinicId);
    formData.append('doc_type', uploadForm.docType);

    setUploading(true);
    setError('');
    try {
      await apiRequest('/api/v1/documents/upload-file', {
        method: 'POST',
        body: { __formData: formData },
        noCache: true,
      });
      setUploadForm((current) => ({ ...current, file: null }));
      await loadDocumentsHub();
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to upload document' : 'Не удалось загрузить документ'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">{isEn ? 'Documents' : 'Документы'}</p>
          <h1 className="page-title">{isEn ? 'Pet document hub' : 'Центр документов питомца'}</h1>
          <p className="page-subtitle">{isEn ? 'Archive, upload, safe review, visit prep and health timeline in one place.' : 'Архив, загрузка, безопасный разбор, подготовка к визиту и связка с лентой здоровья в одном центре.'}</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadDocumentsHub} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-[320px] w-full" />
          <Skeleton className="h-[420px] w-full" />
        </section>
      ) : pets.length === 0 ? (
        <EmptyState
          title={isEn ? 'No pets yet' : 'Питомцев пока нет'}
          text={isEn ? 'Add a pet to collect labs, discharge notes and files in one digital archive.' : 'Добавьте питомца, чтобы собирать результаты анализов, выписки и документы в один цифровой архив.'}
          action={<Link href="/owner/pets" className="btn-primary">{isEn ? 'Go to pets' : 'Перейти к питомцам'}</Link>}
        />
      ) : (
        <>
          <Card>
            <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">{isEn ? 'Active pet' : 'Активный питомец'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={!selectedPetId ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'}
                    onClick={() => setSelectedPetId('')}
                  >
                    {isEn ? 'All pets' : 'Все питомцы'}
                  </button>
                  {pets.map((pet) => (
                    <button
                      key={pet.id}
                      type="button"
                      className={selectedPetId === pet.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'}
                      onClick={() => setSelectedPetId(pet.id)}
                    >
                      {pet.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={tab === item.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'}
                    onClick={() => setTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {tab === 'overview' ? (
            <>
              <ShowcasePanel
                eyebrow={isEn ? 'Unified archive' : 'Единый архив'}
                title={selectedPet ? (isEn ? `${selectedPet.name}'s documents in one place` : `Документы ${selectedPet.name} собраны в одном месте`) : (isEn ? 'All document history in one place' : 'Вся история документов собрана в одном месте')}
                description={isEn ? 'Lapka links the archive to pet, visit, health timeline and safe explanations — without messenger chaos.' : 'Lapka связывает архив с питомцем, визитом, лентой здоровья и безопасным объяснением — без мессенджеров и хаоса в галерее.'}
                imageSrc={resolvePetPhoto(selectedPet || pets[0])}
                imageAlt={selectedPet?.name || pets[0]?.name || (isEn ? 'Pet' : 'Питомец')}
                badges={[
                  isEn ? `${stats.documents} documents` : `${stats.documents} документов`,
                  isEn ? `${stats.visitLinked} linked to visits` : `${stats.visitLinked} связаны с визитами`,
                  isEn ? `${stats.parsed} safe reviews` : `${stats.parsed} безопасных разборов`,
                ]}
                compact
              />

              <section className="kpi-grid">
                <StatsCard label={isEn ? 'Documents' : 'Документы'} value={String(stats.documents)} />
                <StatsCard label={isEn ? 'Pets' : 'Питомцы'} value={String(stats.pets)} />
                <StatsCard label={isEn ? 'Linked to visits' : 'Связано с визитами'} value={String(stats.visitLinked)} />
                <StatsCard label={isEn ? 'Reviewed' : 'Разобрано'} value={String(stats.parsed)} />
              </section>

              <section className="grid items-start gap-5 2xl:grid-cols-[1.06fr_0.94fr]">
                <Card title={isEn ? 'Recent documents' : 'Последние документы'} subtitle={isEn ? 'What the vet and owner need fastest.' : 'Сначала то, что пригодится врачу и владельцу быстрее всего.'}>
                  {filteredDocuments.length ? (
                    <div className="space-y-3">
                      {filteredDocuments.slice(0, 6).map((doc) => {
                        const pet = pets.find((item) => item.id === doc.pet_id);
                        const relatedVisit = findRelatedVisit(doc, visits);
                        return (
                          <div key={doc.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-lg font-bold text-lapka-900">{localizeDocumentType(doc.doc_type, docLocale)}</p>
                                <p className="mt-1 text-sm text-lapka-600">{pet?.name || (isEn ? 'Pet' : 'Питомец')} · {formatDateTime(doc.created_at, dateLocale)}</p>
                                <p className="mt-1 text-sm text-lapka-500">{relatedVisit ? (isEn ? 'Linked to a visit in digital record' : 'Связан с визитом в цифровой карте') : (isEn ? 'Not linked to a specific visit yet' : 'Пока не связан с конкретным визитом')}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" className="btn-secondary !min-h-[42px] !px-4 !py-2" onClick={() => { setSelectedDocId(doc.id); setTab('parsing'); }}>
                                  {isEn ? 'Review' : 'Разобрать'}
                                </button>
                                <button type="button" className="btn-secondary !min-h-[42px] !px-4 !py-2" onClick={() => handleDownload(doc)}>
                                  {isEn ? 'Download' : 'Скачать'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState title={isEn ? 'No documents yet' : 'Документов пока нет'} text={isEn ? 'Upload your first lab, discharge note or document photo.' : 'Загрузите первый анализ, выписку или фото документа.'} />
                  )}
                </Card>

                <Card title={isEn ? 'What Lapka already understands' : 'Что Lapka уже понимает'} subtitle={isEn ? 'Basic safe explanation even without deep OCR.' : 'Базовое безопасное объяснение даже без глубокого OCR.'}>
                  {selectedDocument && selectedParsing ? (
                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="pill !px-3 !py-1.5">{selectedParsing.tag}</span>
                          <span className="pill !px-3 !py-1.5">{localizeDocumentType(selectedDocument.doc_type, docLocale)}</span>
                        </div>
                        <p className="mt-3 text-lg font-bold text-lapka-900">{selectedDocumentPet?.name || (isEn ? 'Pet' : 'Питомец')}</p>
                        <p className="mt-1 text-sm leading-relaxed text-lapka-600">{selectedParsing.summary}</p>
                      </div>
                      <div className="rounded-[24px] border border-lapka-200 bg-lapka-50/80 px-4 py-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">{isEn ? 'Extracted automatically' : 'Извлечено автоматически'}</p>
                        <ul className="mt-3 space-y-2 text-base text-lapka-700">
                          {selectedParsing.extracted.map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                      </div>
                      <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">{isEn ? 'Next step' : 'Следующий шаг'}</p>
                        <p className="mt-3 text-base leading-relaxed text-lapka-700">{selectedParsing.nextStep}</p>
                      </div>
                    </div>
                  ) : (
                    <EmptyState title={isEn ? 'Select a document' : 'Выберите документ'} text={isEn ? 'Pick a document from the archive to see review and safe explanation.' : 'Откройте документ из архива, чтобы увидеть разбор и безопасное объяснение.'} />
                  )}
                </Card>
              </section>

              <section className="grid items-start gap-5 2xl:grid-cols-[0.98fr_1.02fr]">
                <Card title={isEn ? 'Upload to archive' : 'Загрузка в архив'} subtitle={isEn ? 'Labs, prescriptions, discharge notes, receipts and photos.' : 'Поддержка анализов, назначений, выписок, чеков и фотографий документов.'}>
                  <form className="grid gap-3 md:grid-cols-2" onSubmit={handleUpload}>
                    <label className="block">
                      <span className="label">{isEn ? 'Pet' : 'Питомец'}</span>
                      <select className="input" value={uploadForm.petId} onChange={(event) => setUploadForm((current) => ({ ...current, petId: event.target.value }))}>
                        {pets.map((pet) => (
                          <option key={pet.id} value={pet.id}>{pet.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="label">{isEn ? 'Document type' : 'Тип документа'}</span>
                      <select className="input" value={uploadForm.docType} onChange={(event) => setUploadForm((current) => ({ ...current, docType: event.target.value }))}>
                        {docTypeOptions.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block md:col-span-2">
                      <span className="label">{isEn ? 'File' : 'Файл'}</span>
                      <input
                        className="input"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={(event) => setUploadForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                      />
                    </label>
                    <div className="md:col-span-2 flex flex-wrap gap-3">
                      <button className="btn-primary" type="submit" disabled={uploading}>
                        {uploading ? (isEn ? 'Uploading…' : 'Загружаем…') : (isEn ? 'Upload document' : 'Загрузить документ')}
                      </button>
                      <Link href="/owner/timeline" className="btn-secondary">{isEn ? 'Open health timeline' : 'Открыть ленту здоровья'}</Link>
                    </div>
                  </form>
                </Card>

                <Card title={isEn ? 'Visit prep' : 'Подготовка к визиту'} subtitle={isEn ? 'Show the vet the right slice of history without document chaos.' : 'Как быстро показать врачу нужную часть истории без хаоса в документах.'}>
                  <div className="space-y-3">
                    <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <p className="text-base font-bold text-lapka-900">{isEn ? '1. Gather key documents' : '1. Соберите ключевые документы'}</p>
                      <p className="mt-1 text-sm text-lapka-600">{isEn ? 'Keep recent labs, discharge and prescriptions for the active pet handy.' : 'Оставьте под рукой последние анализы, выписку и назначения по активному питомцу.'}</p>
                    </div>
                    <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <p className="text-base font-bold text-lapka-900">{isEn ? '2. Open the health timeline' : '2. Откройте связанную ленту здоровья'}</p>
                      <p className="mt-1 text-sm text-lapka-600">{isEn ? 'Makes symptom, visit and medication sequence easier for the vet.' : 'Так врачу проще увидеть последовательность симптомов, визитов и лекарств.'}</p>
                    </div>
                    <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <p className="text-base font-bold text-lapka-900">{isEn ? '3. Prepare your questions' : '3. Подготовьте вопросы владельца'}</p>
                      <p className="mt-1 text-sm text-lapka-600">{isEn ? 'Lapka helps phrase questions without self-treatment and without losing context.' : 'Lapka помогает сформулировать вопросы без самолечения и потери контекста.'}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href={selectedPet ? `/owner/pet/${selectedPet.id}/records` : '/owner/records'} className="btn-primary">{isEn ? 'Open medical record' : 'Открыть медкарту'}</Link>
                    <Link href="/owner/timeline" className="btn-secondary">{isEn ? 'Open health timeline' : 'Открыть ленту здоровья'}</Link>
                  </div>
                </Card>
              </section>
            </>
          ) : null}

          {tab === 'archive' ? (
            <section className="space-y-5">
              <Card>
                <SearchInput
                  label={isEn ? 'Search archive' : 'Поиск по архиву'}
                  placeholder={isEn ? 'Lab, discharge, prescription, x-ray…' : 'Анализ, выписка, назначение, рентген…'}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </Card>

              {groupedByPet.length ? (
                <div className="space-y-4">
                  {groupedByPet.map(({ pet, rows }) => (
                    <Card
                      key={pet?.id || 'unknown'}
                      title={pet ? pet.name : (isEn ? 'Pet' : 'Питомец')}
                      subtitle={pet ? (isEn ? `${rows.length} documents in personal archive` : `${rows.length} документов в персональном архиве`) : (isEn ? `${rows.length} documents` : `${rows.length} документов`)}
                    >
                      <div className="space-y-3">
                        {rows.map((doc) => (
                          <div key={doc.id} className="grid gap-3 rounded-[24px] border border-lapka-200 bg-white p-4 md:grid-cols-[88px_minmax(0,1fr)_auto] md:items-center">
                            <AppImage
                              src={resolvePetPhoto(pet || selectedPet || pets[0])}
                              alt={pet?.name || (isEn ? 'Pet' : 'Питомец')}
                              width={320}
                              height={320}
                              sizes="88px"
                              className="h-20 w-full rounded-[22px] border border-lapka-200 bg-[radial-gradient(circle_at_20%_18%,rgba(95,173,255,0.16),transparent_38%),linear-gradient(180deg,#f8fbff_0%,#eef7ff_100%)] object-contain p-2 sm:w-20"
                            />
                            <div>
                              <p className="text-lg font-bold text-lapka-900">{localizeDocumentType(doc.doc_type, docLocale)}</p>
                              <p className="mt-1 text-sm text-lapka-600">{formatDateTime(doc.created_at, dateLocale)}</p>
                              <p className="mt-1 text-sm text-lapka-500">{doc.file_ref}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 md:justify-end">
                              <button type="button" className="btn-secondary !min-h-[42px] !px-4 !py-2" onClick={() => { setSelectedDocId(doc.id); setTab('parsing'); }}>
                                {isEn ? 'Review' : 'Разобрать'}
                              </button>
                              <button type="button" className="btn-secondary !min-h-[42px] !px-4 !py-2" onClick={() => handleDownload(doc)}>
                                {isEn ? 'Download' : 'Скачать'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState title={isEn ? 'Nothing found' : 'Ничего не найдено'} text={isEn ? 'Change filter, search query or upload a new document.' : 'Смените фильтр, поисковый запрос или загрузите новый документ.'} />
              )}
            </section>
          ) : null}

          {tab === 'parsing' ? (
            <section className="grid items-start gap-5 2xl:grid-cols-[0.92fr_1.08fr]">
              <Card title={isEn ? 'Documents' : 'Документы'} subtitle={isEn ? 'Select a document to see review and safe explanation.' : 'Выберите документ, чтобы увидеть разбор и безопасное объяснение.'}>
                {filteredDocuments.length ? (
                  <div className="space-y-3">
                    {filteredDocuments.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                          selectedDocId === doc.id
                            ? 'border-cyan-300 bg-cyan-50/60 shadow-soft'
                            : 'border-lapka-200 bg-white hover:-translate-y-0.5 hover:shadow-soft'
                        }`}
                        onClick={() => setSelectedDocId(doc.id)}
                      >
                        <p className="text-lg font-bold text-lapka-900">{localizeDocumentType(doc.doc_type, docLocale)}</p>
                        <p className="mt-1 text-sm text-lapka-600">{formatDateTime(doc.created_at, dateLocale)}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState title={isEn ? 'Archive is empty' : 'Архив пуст'} text={isEn ? 'Upload a document first or clear filters.' : 'Сначала загрузите документ или снимите фильтры.'} />
                )}
              </Card>

              <Card title={isEn ? 'Safe explanation for owner' : 'Безопасное объяснение для владельца'} subtitle={isEn ? 'Review layer that helps you prepare to talk with your vet.' : 'Демонстрация слоя разбора, который помогает подготовиться к разговору с врачом.'}>
                {selectedDocument && selectedParsing ? (
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">{isEn ? 'Document' : 'Документ'}</p>
                      <p className="mt-2 text-xl font-black text-lapka-950">{localizeDocumentType(selectedDocument.doc_type, docLocale)}</p>
                      <p className="mt-1 text-sm text-lapka-600">{selectedDocumentPet?.name || (isEn ? 'Pet' : 'Питомец')} · {formatDateTime(selectedDocument.created_at, dateLocale)}</p>
                    </div>

                    <div className="rounded-[24px] border border-lapka-200 bg-lapka-50/80 px-4 py-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">{isEn ? 'Extracted' : 'Извлечено'}</p>
                      <ul className="mt-3 space-y-2 text-base text-lapka-700">
                        {selectedParsing.extracted.map((item) => <li key={item}>• {item}</li>)}
                      </ul>
                    </div>

                    <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">{isEn ? 'What next' : 'Что дальше'}</p>
                      <p className="mt-3 text-base leading-relaxed text-lapka-700">{selectedParsing.nextStep}</p>
                    </div>

                    {parsingById[selectedDocument.id] ? (
                      <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">{isEn ? 'Safe AI explanation' : 'Безопасное AI-объяснение'}</p>
                        <p className="mt-3 text-base leading-relaxed text-lapka-700">{parsingById[selectedDocument.id].high_level_summary}</p>
                        <ul className="mt-3 space-y-2 text-sm text-lapka-600">
                          {(parsingById[selectedDocument.id].questions_for_vet || []).map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleExplain(selectedDocument)}
                        disabled={explainingId === selectedDocument.id}
                      >
                        {explainingId === selectedDocument.id ? (isEn ? 'Analyzing…' : 'Разбираем…') : (isEn ? 'Run safe explanation' : 'Сделать безопасное объяснение')}
                      </button>
                    )}
                  </div>
                ) : (
                  <EmptyState title={isEn ? 'Select a document' : 'Выберите документ'} text={isEn ? 'Pick a document on the left to see review and safe explanation.' : 'Откройте документ слева, чтобы посмотреть parsing и безопасное объяснение.'} />
                )}
              </Card>
            </section>
          ) : null}

          {tab === 'export' ? (
            <section className="grid items-start gap-5 2xl:grid-cols-[1fr_1fr]">
              <Card title={isEn ? 'Visit bundle' : 'Пакет к визиту'} subtitle={isEn ? 'Give the vet only what matters: recent docs, timeline and active prescriptions.' : 'Подготовьте врачу только нужное: последние документы, ленту здоровья и список активных назначений.'}>
                {exportDocuments.length ? (
                  <div className="space-y-3">
                    {exportDocuments.map((doc) => (
                      <div key={doc.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-bold text-lapka-900">{localizeDocumentType(doc.doc_type, docLocale)}</p>
                            <p className="mt-1 text-sm text-lapka-600">{formatDateTime(doc.created_at, dateLocale)}</p>
                          </div>
                          <button type="button" className="btn-secondary !min-h-[42px] !px-4 !py-2" onClick={() => handleDownload(doc)}>
                            {isEn ? 'Download' : 'Скачать'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title={isEn ? 'No documents for bundle' : 'Нет документов для пакета'} text={isEn ? 'Upload documents and return here before your next visit.' : 'Загрузите документы и вернитесь сюда перед следующим визитом.'} />
                )}
              </Card>

              <Card title={isEn ? 'Quick actions before the vet' : 'Быстрые действия перед врачом'} subtitle={isEn ? 'Sharing history should not mean digging through chats and galleries.' : 'Экспорт истории не должен превращаться в ручной поиск по чатам и галерее.'}>
                <div className="space-y-3">
                  <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <p className="text-base font-bold text-lapka-900">{isEn ? 'Open full medical record' : 'Открыть полную медкарту'}</p>
                    <p className="mt-1 text-sm text-lapka-600">{isEn ? 'Show timeline, recent visits and documents in one place.' : 'Покажите врачу ленту здоровья, последние визиты и документы в одном месте.'}</p>
                  </div>
                  <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <p className="text-base font-bold text-lapka-900">{isEn ? 'Open medication center' : 'Открыть центр лекарств'}</p>
                    <p className="mt-1 text-sm text-lapka-600">{isEn ? 'Check active prescriptions, stock and med questions before the visit.' : 'Проверьте активные назначения, остатки и вопросы по препаратам до визита.'}</p>
                  </div>
                  <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <p className="text-base font-bold text-lapka-900">{isEn ? 'Add owner notes' : 'Добавить заметку владельца'}</p>
                    <p className="mt-1 text-sm text-lapka-600">{isEn ? 'Note appetite, water intake, activity and symptoms before the appointment.' : 'Соберите наблюдения по аппетиту, воде, активности и симптомам до приёма.'}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={selectedPet ? `/owner/pet/${selectedPet.id}/records` : '/owner/records'} className="btn-primary">{isEn ? 'Open medical record' : 'Открыть медкарту'}</Link>
                  <Link href="/owner/medications" className="btn-secondary">{isEn ? 'Medications' : 'Лекарства и назначения'}</Link>
                  <Link href="/owner/timeline" className="btn-secondary">{isEn ? 'Health timeline' : 'Лента здоровья'}</Link>
                </div>
              </Card>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
