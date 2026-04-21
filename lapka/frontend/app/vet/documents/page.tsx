'use client';

import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import DocumentViewer from '@/components/ui/DocumentViewer';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';
import { useClinicScope } from '@/lib/clinic-scope';
import { BARSIK_PET_ID } from '@/lib/constants';

export default function VetDocumentsPage() {
  const { clinicId, selectedClinic, selectedBranch } = useClinicScope();
  const [petId, setPetId] = useState(BARSIK_PET_ID);
  const [docType, setDocType] = useState('blood_test');
  const [file, setFile] = useState(null);
  const [documents, setDocuments] = useState<Record<string, unknown>[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadDocuments() {
    if (!clinicId) return;
    setLoadingDocs(true);
    try {
      const rows = await apiRequest<Record<string, unknown>[]>(
        `/api/v1/documents?clinic_id=${encodeURIComponent(clinicId)}`
      );
      setDocuments(rows || []);
    } catch {
    } finally {
      setLoadingDocs(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, [clinicId]);

  const typeOptions = useMemo(
    () => [
      { value: 'blood_test', label: 'Анализ крови' },
      { value: 'biochemistry', label: 'Биохимия' },
      { value: 'xray', label: 'Рентген' },
      { value: 'ultrasound', label: 'УЗИ' },
    ],
    []
  );

  async function onSave() {
    setError('');
    setSuccess('');
    if (!petId.trim()) {
      setError('Укажите ID пациента.');
      return;
    }
    if (!file) {
      setError('Выберите файл документа.');
      return;
    }
    if (!clinicId) {
      setError('Сначала выберите клинику в рабочем контуре.');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('pet_id', petId.trim());
      formData.append('clinic_id', clinicId);
      formData.append('doc_type', docType);
      await apiRequest('/api/v1/documents/upload-file', {
        method: 'POST',
        body: { __formData: formData },
        noCache: true,
      });
      setSuccess('Документ сохранён и будет доступен владельцу по выданному уровню доступа.');
      setFile(null);
      const fileInput = document.getElementById('vet-doc-file');
      if (fileInput) fileInput.value = '';
    } catch (requestError) {
      setError(requestError.message || 'Не удалось сохранить документ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Документы пациентов</h1>
          <p className="page-subtitle">Безопасный просмотр анализов и изображений с понятной AI-сводкой без лечения. Контекст: {selectedClinic?.name || 'клиника не выбрана'}{selectedBranch ? ` · ${selectedBranch.address}` : ''}.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      <section className="grid-soft-2">
        {loadingDocs ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <DocumentViewer
            title="Лента документов"
            subtitle="ОАК, биохимия, рентген, УЗИ, выписки"
            documents={documents}
            onExplainDocument={async (docId) => {
              try {
                await apiRequest(`/api/v1/documents/${docId}/ai-explain`, { method: 'POST' });
              } catch (err) {
                setError(String(err instanceof Error ? err.message : 'Ошибка'));
              }
            }}
          />
        )}

        <Card title="Добавить документ" subtitle="Метаданные и ссылка на файл">
          <div className="space-y-3">
            <label className="block">
              <span className="label">ID пациента</span>
              <input className="input" value={petId} onChange={(event) => setPetId(event.target.value)} />
            </label>
            <label className="block">
              <span className="label">Тип документа</span>
              <select className="input" value={docType} onChange={(event) => setDocType(event.target.value)}>
                {typeOptions.map((row) => (
                  <option key={row.value} value={row.value}>{row.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Файл</span>
              <input id="vet-doc-file" className="input" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
            <button className="btn-primary" type="button" onClick={onSave} disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </Card>
      </section>
    </>
  );
}
