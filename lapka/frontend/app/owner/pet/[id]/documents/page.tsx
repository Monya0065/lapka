'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import AppImage from '@/components/ui/AppImage';
import DocumentRecentThumb, { formatDocumentFileCaption } from '@/components/documents/DocumentRecentThumb';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';
import { getApiBase } from '@/lib/auth';
import { useClinicScope } from '@/lib/clinic-scope';

const DOC_TYPES = [
  'blood_test',
  'biochemistry',
  'xray',
  'ultrasound',
  'mri',
  'discharge',
  'photo_injury',
  'other',
];

export default function OwnerPetDocumentsPage() {
  const { t, i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');
  const params = useParams();
  const petId = useMemo(() => params?.id || '', [params]);
  const { clinicId, selectedClinic } = useClinicScope();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [file, setFile] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [downloadStub, setDownloadStub] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);

  const loadDocuments = useCallback(async () => {
    if (!petId) return;
    setLoading(true);
    setError('');
    try {
      const rows = await apiRequest(`/api/v1/documents?pet_id=${encodeURIComponent(petId)}`);
      setDocuments(Array.isArray(rows) ? rows : []);
    } catch (requestError) {
      setError(requestError.message || t('documents.errorLoad'));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [petId, t]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function onUpload(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setDownloadStub(null);
    setAiSummary(null);

    if (!file) {
      setError(t('documents.selectFile'));
      return;
    }
    if (!docType) {
      setError(t('documents.selectType'));
      return;
    }
    if (!clinicId) {
      setError(t('documents.clinicRequired'));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('pet_id', petId);
      formData.append('clinic_id', clinicId);
      formData.append('doc_type', docType);

      await apiRequest('/api/v1/documents/upload-file', {
        method: 'POST',
        body: { __formData: formData },
      });
      setSuccess(t('documents.successUpload'));
      setFile(null);
      const fileInput = document.getElementById('owner-doc-file');
      if (fileInput) fileInput.value = '';
      await loadDocuments();
    } catch (requestError) {
      setError(requestError.message || t('documents.errorUpload'));
    } finally {
      setUploading(false);
    }
  }

  async function viewDocument(docId) {
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest(`/api/v1/documents/${docId}`);
      setSelectedDoc(payload);
    } catch (requestError) {
      setError(requestError.message || t('documents.errorLoad'));
    }
  }

  async function downloadDocument(docId) {
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest(`/api/v1/documents/${docId}/download`);
      setDownloadStub(payload);
      if (payload?.download_url) {
        window.open(`${getApiBase()}${payload.download_url}`, '_blank');
      }
    } catch (requestError) {
      setError(requestError.message || t('documents.errorLoad'));
    }
  }

  async function explainDocument(docId) {
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest(`/api/v1/documents/${docId}/ai-explain`, { method: 'POST' });
      setAiSummary(payload);
    } catch (requestError) {
      setError(requestError.message || t('documents.errorLoad'));
    }
  }

  const docTypeLabel = (key) => t(`documents.types.${key}`, key);

  const docTypeVariety = useMemo(
    () => new Set((documents || []).map((d) => d.doc_type).filter(Boolean)).size,
    [documents]
  );
  const explainReadyCount = useMemo(
    () => documents.filter((d) => ['blood_test', 'biochemistry', 'ultrasound', 'xray', 'mri'].includes(d.doc_type)).length,
    [documents]
  );
  const recent48hCount = useMemo(
    () =>
      documents.filter((d) => {
        const ts = d?.created_at ? new Date(d.created_at).getTime() : 0;
        return ts > 0 && Date.now() - ts <= 48 * 60 * 60 * 1000;
      }).length,
    [documents]
  );
  const archivePressure = useMemo(() => {
    if (!documents.length) return 'LOW';
    const noClinicContext = !clinicId;
    if (recent48hCount >= 5 || noClinicContext) return 'HIGH';
    if (recent48hCount > 0 || documents.length >= 3) return 'MED';
    return 'OK';
  }, [clinicId, documents.length, recent48hCount]);
  const aiReadiness = useMemo(() => {
    if (!documents.length) return 0;
    return Math.round((explainReadyCount / documents.length) * 100);
  }, [documents.length, explainReadyCount]);
  const archiveCoverage = useMemo(() => {
    const signals = [
      documents.length > 0,
      docTypeVariety >= 3,
      recent48hCount > 0,
      Boolean(aiSummary),
    ];
    return Math.round((signals.filter(Boolean).length / signals.length) * 100);
  }, [aiSummary, docTypeVariety, documents.length, recent48hCount]);

  const tableRows = documents.map((doc) => [
    docTypeLabel(doc.doc_type) || doc.doc_type || '—',
    formatDocumentFileCaption(doc.file_ref) || '—',
    new Date(doc.created_at).toLocaleString(),
    <div key={doc.id} className="flex flex-wrap gap-2">
      <button className="btn-secondary !px-3 !py-1" type="button" onClick={() => viewDocument(doc.id)}>
        {t('documents.openDoc')}
      </button>
      <button className="btn-secondary !px-3 !py-1" type="button" onClick={() => downloadDocument(doc.id)}>
        {t('documents.download')}
      </button>
      <button className="btn-primary !px-3 !py-1" type="button" onClick={() => explainDocument(doc.id)}>
        {t('documents.aiExplain')}
      </button>
    </div>,
  ]);

  return (
    <>
      {error ? <ErrorBanner message={error} onRetry={loadDocuments} /> : null}
      {success ? (
        <div className="callout-success">{success}</div>
      ) : null}

      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-amber-400/12 via-surface-muted to-cyan-400/14 p-5 shadow-card md:p-8 dark:from-amber-500/10 dark:to-cyan-500/10">
        <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">
              {loading ? t('documents.title') : (isEn ? 'Archive' : 'Архив')}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">{t('documents.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
              {t('documents.subtitle')}
              {selectedClinic?.name ? (isEn ? ` Clinic: ${selectedClinic.name}.` : ` Клиника: ${selectedClinic.name}.`) : ''}
            </p>
            {!loading ? (
              <p className="mt-2 text-xs text-theme-muted">
                {isEn
                  ? 'Uploads are linked to the selected clinic; AI provides safe explanations only, without dosages.'
                  : 'Загрузки привязаны к выбранной клинике; AI — только безопасное объяснение без дозировок.'}
              </p>
            ) : null}
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: t('documents.title'), value: documents.length, tone: '' },
                { label: isEn ? 'Types' : 'Типов', value: docTypeVariety, tone: 'text-violet-700 dark:text-violet-300' },
                { label: 'AI-ready', value: explainReadyCount, tone: 'text-sky-700 dark:text-sky-300' },
                { label: isEn ? 'In 48h' : 'За 48ч', value: recent48hCount, tone: 'text-emerald-700 dark:text-emerald-300' },
                { label: 'AI', value: aiSummary ? '✓' : '—', tone: aiSummary ? 'text-emerald-700 dark:text-emerald-300' : 'text-theme-muted' },
                { label: isEn ? 'Clinic' : 'Клиника', value: clinicId ? '✓' : '—', tone: clinicId ? 'text-cyan-700 dark:text-cyan-300' : 'text-theme-muted' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className={`mt-1 text-2xl font-black tabular-nums sm:text-3xl ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <ShowcasePanel
        eyebrow={t('documents.title')}
        title={isEn ? 'Pet documents and lab results' : 'Документы и анализы питомца'}
        description={isEn
          ? 'Upload results, review them in the archive and get a safe AI explanation without treatment instructions for owners.'
          : 'Загружайте результаты, открывайте их в архиве и получайте безопасное AI-объяснение без назначения лечения владельцу.'}
        imageSrc="/assets/img/card-labs.svg"
        imageAlt={isEn ? 'Pet documents and lab results' : 'Документы и анализы питомца'}
        compact
      />

      {!loading ? (
        <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Операционный срез</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">Сигналы документного архива</h2>
            </div>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
              owner doc ops
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Давление архива',
                value: archivePressure,
                text: 'Сигнал по интенсивности новых загрузок и готовности клинического контекста для документов.',
                href: `/owner/pet/${petId}/records`,
                tone: archivePressure === 'HIGH'
                  ? 'text-rose-700 dark:text-rose-300'
                  : archivePressure === 'MED'
                    ? 'text-amber-700 dark:text-amber-300'
                    : archivePressure === 'OK'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-sky-700 dark:text-sky-300',
              },
              {
                title: 'AI-готовность',
                value: `${aiReadiness}%`,
                text: 'Доля документов, пригодных для безопасного AI-объяснения без лечебных инструкций.',
                href: '/owner/messages',
                tone: 'text-violet-700 dark:text-violet-300',
              },
              {
                title: 'Покрытие архива',
                value: `${archiveCoverage}%`,
                text: 'Насыщенность архива по типам, свежим событиям и наличию AI-контекста владельца.',
                href: `/owner/pet/${petId}/calendar`,
                tone: 'text-sky-700 dark:text-sky-300',
              },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-2xl border border-border bg-surface/85 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <p className={`text-base font-black ${item.tone}`}>{item.title}</p>
                <p className="mt-2 text-3xl font-black tabular-nums text-theme">{item.value}</p>
                <p className="mt-2 text-sm leading-relaxed text-theme">{item.text}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">Открыть контур</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid-soft-2">
        <Card title={t('documents.uploadCard')} subtitle={t('documents.uploadCardSub')}>
          <form className="space-y-3" onSubmit={onUpload}>
            <label className="block">
              <span className="label">{t('documents.docType')}</span>
              <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((key) => (
                  <option key={key} value={key}>
                    {docTypeLabel(key)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label">{t('documents.file')}</span>
              <input
                id="owner-doc-file"
                className="input"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>

            <button className="btn-primary" type="submit" disabled={uploading}>
              {uploading ? t('documents.uploading') : t('documents.upload')}
            </button>

            <p className="text-xs text-theme-muted">{t('documents.aiDisclaimer')}</p>
          </form>
        </Card>

        <Card title={t('documents.currentSelection')} subtitle="Просмотр, скачивание и AI-объяснение">
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-surface-muted/65 px-3 py-2 text-sm text-theme">
              <span className="font-semibold">ID питомца:</span> {petId}
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/70 p-3 text-sm text-theme">
              {selectedDoc ? (
                <>
                  <p className="font-semibold">{t('documents.openDoc')}</p>
                  <p className="mt-1 text-xs text-theme-muted">Тип: {selectedDoc.doc_type || '—'}</p>
                  <p className="mt-1 text-xs text-theme-muted">Файл: {selectedDoc.file_ref || '—'}</p>
                  <p className="mt-1 text-xs text-theme-muted">{new Date(selectedDoc.created_at).toLocaleString()}</p>
                </>
              ) : (
                <p className="text-xs text-theme-muted">{t('documents.emptyDesc')}</p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/70 p-3 text-sm text-theme">
              {downloadStub ? (
                <>
                  <p className="font-semibold">{t('documents.download')}</p>
                  <p className="mt-1 text-xs text-theme-muted">Ссылка: {downloadStub.download_url || ''}</p>
                </>
              ) : (
                <p className="text-xs text-theme-muted">{t('documents.emptyDesc')}</p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/70 p-3 text-sm text-theme">
              {aiSummary ? (
                <>
                  <p className="font-semibold">{t('documents.aiExplain')}</p>
                  <p className="mt-1 text-xs text-theme-muted">{aiSummary.summary || aiSummary.high_level_summary || '—'}</p>
                  <p className="mt-2 text-xs text-theme-muted">{t('documents.aiDisclaimer')}</p>
                </>
              ) : (
                <p className="text-xs text-theme-muted">{t('documents.emptyDesc')}</p>
              )}
            </div>
          </div>
        </Card>
      </section>

      <Card title={t('documents.recentTitle')} subtitle={t('documents.recentSub')}>
        {documents.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {documents.slice(0, 6).map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => viewDocument(doc.id)}
                aria-label={`${t('documents.openDoc')}: ${docTypeLabel(doc.doc_type) || doc.doc_type || ''}`}
                className="rounded-2xl border border-border bg-surface-muted/70 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className="bg-mesh-document-thumb rounded-2xl border border-border p-2">
                  <DocumentRecentThumb
                    documentId={doc.id}
                    fileRef={doc.file_ref}
                    alt={docTypeLabel(doc.doc_type) || doc.doc_type || t('documents.file')}
                    className="mx-auto h-32 w-full"
                  />
                </div>
                <p className="mt-3 text-base font-extrabold text-theme">{docTypeLabel(doc.doc_type) || doc.doc_type || '—'}</p>
                <p className="mt-1 text-xs text-theme-muted">{new Date(doc.created_at).toLocaleString()}</p>
                <p className="mt-2 text-xs text-theme-muted line-clamp-2">
                  {formatDocumentFileCaption(doc.file_ref) || '—'}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title={t('documents.empty')} text={t('documents.emptyDesc')} />
        )}
      </Card>

      <Card title={t('documents.listTitle')} subtitle={t('documents.listSub')}>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : documents.length ? (
          <Table columns={[t('documents.docType'), t('documents.file'), t('calendar.date'), t('common.actions')]} rows={tableRows} />
        ) : (
          <EmptyState title={t('documents.empty')} text={t('documents.emptyDesc')} />
        )}
      </Card>
    </>
  );
}
