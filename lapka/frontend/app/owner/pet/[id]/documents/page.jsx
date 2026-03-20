'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import AppImage from '@/components/ui/AppImage';
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
  const { t } = useTranslation();
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
      setError('Сначала выберите клинику, в которую загружается документ.');
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

  const tableRows = documents.map((doc) => [
    docTypeLabel(doc.doc_type) || doc.doc_type || '—',
    doc.file_ref || '—',
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
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('documents.title')}</h1>
          <p className="page-subtitle">{t('documents.subtitle')} {selectedClinic?.name ? `Клиника: ${selectedClinic.name}.` : ''}</p>
        </div>
      </header>

      <ShowcasePanel
        eyebrow={t('documents.title')}
        title="Документы и анализы питомца"
        description="Загружайте результаты, открывайте их в архиве и получайте безопасное AI-объяснение без назначения лечения владельцу."
        imageSrc="/assets/img/card-labs.svg"
        imageAlt="Документы и анализы питомца"
      />

      {error ? <ErrorBanner message={error} onRetry={loadDocuments} /> : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
      ) : null}

      <section className="kpi-grid">
        <Card title="Документы" subtitle="Всего в архиве питомца">
          <p className="text-4xl font-black tracking-tight text-lapka-900">{documents.length}</p>
        </Card>
        <Card title="Последняя загрузка" subtitle="Самый свежий файл в архиве питомца">
          <p className="text-sm font-semibold text-lapka-900">
            {documents[0]?.created_at ? new Date(documents[0].created_at).toLocaleString() : '—'}
          </p>
        </Card>
        <Card title="AI-объяснение" subtitle="Безопасное summary без лечения">
          <p className="text-sm font-semibold text-lapka-900">{aiSummary ? 'Готово' : 'Ожидает запуска'}</p>
        </Card>
        <Card title="Режим владельца" subtitle="Только понятные и безопасные данные">
          <p className="text-sm font-semibold text-lapka-900">Без лишних клинических деталей</p>
        </Card>
      </section>

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

            <p className="text-xs text-lapka-600">{t('documents.aiDisclaimer')}</p>
          </form>
        </Card>

        <Card title={t('documents.currentSelection')} subtitle="Просмотр, скачивание и AI-объяснение">
          <div className="space-y-3">
            <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm text-lapka-700">
              <span className="font-semibold">ID питомца:</span> {petId}
            </div>
            <div className="rounded-xl border border-lapka-200 bg-white p-3 text-sm text-lapka-700">
              {selectedDoc ? (
                <>
                  <p className="font-semibold">{t('documents.openDoc')}</p>
                  <p className="mt-1 text-xs text-lapka-600">Тип: {selectedDoc.doc_type || '—'}</p>
                  <p className="mt-1 text-xs text-lapka-600">Файл: {selectedDoc.file_ref || '—'}</p>
                  <p className="mt-1 text-xs text-lapka-600">{new Date(selectedDoc.created_at).toLocaleString()}</p>
                </>
              ) : (
                <p className="text-xs text-lapka-600">{t('documents.emptyDesc')}</p>
              )}
            </div>
            <div className="rounded-xl border border-lapka-200 bg-white p-3 text-sm text-lapka-700">
              {downloadStub ? (
                <>
                  <p className="font-semibold">{t('documents.download')}</p>
                  <p className="mt-1 text-xs text-lapka-600">Ссылка: {downloadStub.download_url || ''}</p>
                </>
              ) : (
                <p className="text-xs text-lapka-600">{t('documents.emptyDesc')}</p>
              )}
            </div>
            <div className="rounded-xl border border-lapka-200 bg-white p-3 text-sm text-lapka-700">
              {aiSummary ? (
                <>
                  <p className="font-semibold">{t('documents.aiExplain')}</p>
                  <p className="mt-1 text-xs text-lapka-600">{aiSummary.summary || aiSummary.high_level_summary || '—'}</p>
                  <p className="mt-2 text-xs text-lapka-500">{t('documents.aiDisclaimer')}</p>
                </>
              ) : (
                <p className="text-xs text-lapka-600">{t('documents.emptyDesc')}</p>
              )}
            </div>
          </div>
        </Card>
      </section>

      <Card title="Последние документы" subtitle="Быстрый визуальный обзор по самым свежим загрузкам">
        {documents.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {documents.slice(0, 6).map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => viewDocument(doc.id)}
                className="rounded-2xl border border-lapka-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className="rounded-2xl border border-lapka-200 bg-[radial-gradient(circle_at_20%_20%,rgba(93,188,255,0.14),transparent_45%),linear-gradient(180deg,#f9fcff_0%,#eef8ff_100%)] p-4">
                  <AppImage
                    src="/assets/img/card-labs.svg"
                    alt="Документ"
                    width={640}
                    height={400}
                    sizes="280px"
                    className="mx-auto h-28 w-full object-contain"
                  />
                </div>
                <p className="mt-3 text-base font-extrabold text-lapka-900">{docTypeLabel(doc.doc_type) || doc.doc_type || '—'}</p>
                <p className="mt-1 text-xs text-lapka-500">{new Date(doc.created_at).toLocaleString()}</p>
                <p className="mt-2 text-xs text-lapka-600 line-clamp-2">{doc.file_ref || '—'}</p>
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
