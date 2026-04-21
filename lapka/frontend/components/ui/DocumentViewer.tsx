'use client';

import { useMemo } from 'react';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';

function statusBadge(status) {
  const ok = String(status || '').toLowerCase();
  return ok.includes('готов') || ok.includes('ready') ? (
    <Badge tone="success">{status}</Badge>
  ) : (
    <Badge tone="warning">{status}</Badge>
  );
}

function formatDate(value, locale = 'ru-RU') {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

interface DocumentRow {
  id: string;
  doc_type: string;
  created_at: string;
  file_ref?: string;
}

interface DocumentViewerProps {
  title?: string;
  subtitle?: string;
  documents?: DocumentRow[];
  onViewDocument?: (docId: string) => void;
  onExplainDocument?: (docId: string) => void;
  onDownloadDocument?: (docId: string) => void;
}

export default function DocumentViewer({
  title = 'Документы',
  subtitle = 'Анализы, выписки, изображения',
  documents = [],
  onViewDocument,
  onExplainDocument,
  onDownloadDocument,
}: DocumentViewerProps) {
  const tableRows = useMemo(
    () =>
      documents.map((doc, index) => [
        doc.doc_type || 'Документ',
        formatDate(doc.created_at),
        <span key={`st-${index}`}>{statusBadge('Готов')}</span>,
        <span key={`ai-${index}`}>
          {onExplainDocument ? (
            <button
              type="button"
              className="text-sm text-lapka-600 underline hover:text-lapka-900"
              onClick={() => onExplainDocument(doc.id)}
            >
              Расшифровать
            </button>
          ) : (
            'Расшифровать'
          )}
        </span>,
      ]),
    [documents, onExplainDocument]
  );

  return (
    <article className="surface-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-lapka-900">{title}</h3>
          <p className="mt-1 text-sm text-lapka-600">{subtitle}</p>
        </div>
      </div>

      {documents.length > 0 ? (
        <Table columns={['Тип', 'Дата', 'Статус', 'AI']} rows={tableRows} />
      ) : (
        <p className="text-sm text-lapka-500">Документов пока нет.</p>
      )}

      <p className="mt-3 text-xs text-lapka-600">
        AI объясняет документ простым языком и подсказывает, что обсудить с врачом. Без диагноза и лечения.
      </p>
    </article>
  );
}