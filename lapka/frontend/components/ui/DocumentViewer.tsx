'use client';

import { useMemo, useRef, useState } from 'react';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';

const INITIAL_ROWS = [
  { type: 'Анализ крови', date: '05.03.2026', status: 'Готов', ai: 'Расшифровать' },
  { type: 'УЗИ', date: '02.03.2026', status: 'Готов', ai: 'Расшифровать' },
  { type: 'Рентген', date: '01.03.2026', status: 'В обработке', ai: 'Ожидание' },
];

function statusBadge(status) {
  return status === 'Готов' ? <Badge tone="success">{status}</Badge> : <Badge tone="warning">{status}</Badge>;
}

export default function DocumentViewer({ title = 'Документы', subtitle = 'Анализы, выписки, изображения' }) {
  const [rows, setRows] = useState(INITIAL_ROWS);
  const fileInputRef = useRef(null);

  function onOpenPicker() {
    fileInputRef.current?.click();
  }

  function onPickFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setRows((prev) => [
      {
        type: 'Файл врача',
        date: new Date().toLocaleDateString('ru-RU'),
        status: 'Готов',
        ai: 'Расшифровать',
      },
      ...prev,
    ]);
    event.target.value = '';
  }

  const tableRows = useMemo(
    () =>
      rows.map((row, index) => [
        row.type,
        row.date,
        <span key={`st-${index}`}>{statusBadge(row.status)}</span>,
        row.ai,
      ]),
    [rows]
  );

  return (
    <article className="surface-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-lapka-900">{title}</h3>
          <p className="mt-1 text-sm text-lapka-600">{subtitle}</p>
        </div>
        <button className="btn-secondary" type="button" onClick={onOpenPicker}>
          Загрузить
        </button>
      </div>

      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={onPickFile}
      />

      <Table columns={['Тип', 'Дата', 'Статус', 'AI']} rows={tableRows} />

      <p className="mt-3 text-xs text-lapka-600">
        AI объясняет документ простым языком и подсказывает, что обсудить с врачом. Без диагноза и лечения.
      </p>
    </article>
  );
}
