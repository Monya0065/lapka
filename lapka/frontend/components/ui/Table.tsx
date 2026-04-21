'use client';

import { useMemo, useState } from 'react';
import DropdownMenu from '@/components/ui/DropdownMenu';
import EmptyState from '@/components/ui/EmptyState';

function normalizeColumns(columns) {
  return (columns || []).map((column, index) => {
    if (typeof column === 'string') {
      return {
        id: `col_${index}`,
        label: column,
        sortable: true,
      };
    }
    return {
      id: column.id || column.key || `col_${index}`,
      label: column.label || column.title || `Колонка ${index + 1}`,
      sortable: column.sortable !== false,
      align: column.align || 'left',
      accessor: column.accessor,
      width: column.width,
    };
  });
}

function normalizeRows(rows) {
  return (rows || []).map((row, index) => {
    if (Array.isArray(row)) {
      return { __type: 'array', __cells: row, __id: row.id || `row_${index}` };
    }
    return { __type: 'object', ...row, __id: row.id || `row_${index}` };
  });
}

function getCell(row, column, index) {
  if (row.__type === 'array') return row.__cells[index];
  if (typeof column.accessor === 'function') return column.accessor(row);
  if (column.id in row) return row[column.id];
  return row[index] ?? '—';
}

function toText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

export default function Table({
  columns = [],
  rows = [],
  emptyTitle = 'Нет данных',
  emptyText = 'Записи появятся после создания первых событий.',
  searchPlaceholder = 'Фильтр таблицы…',
  searchable = true,
  sortable = true,
  paginated = true,
  initialPageSize = 8,
  pageSizeOptions = [8, 12, 20, 40],
  rowActions,
  className = '',
}) {
  const [query, setQuery] = useState('');
  const [sortState, setSortState] = useState({ columnId: '', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const normalizedColumns = useMemo(() => normalizeColumns(columns), [columns]);
  const normalizedRows = useMemo(() => normalizeRows(rows), [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedRows;
    return normalizedRows.filter((row) => {
      const rowText = normalizedColumns.map((column, index) => toText(getCell(row, column, index))).join(' ').toLowerCase();
      return rowText.includes(q);
    });
  }, [normalizedColumns, normalizedRows, query]);

  const sortedRows = useMemo(() => {
    if (!sortable || !sortState.columnId) return filteredRows;
    const columnIndex = normalizedColumns.findIndex((column) => column.id === sortState.columnId);
    if (columnIndex < 0) return filteredRows;
    const sorted = [...filteredRows].sort((a, b) => {
      const aVal = getCell(a, normalizedColumns[columnIndex], columnIndex);
      const bVal = getCell(b, normalizedColumns[columnIndex], columnIndex);
      const aText = toText(aVal);
      const bText = toText(bVal);
      return aText.localeCompare(bText, 'ru', { numeric: true, sensitivity: 'base' });
    });
    return sortState.direction === 'desc' ? sorted.reverse() : sorted;
  }, [filteredRows, normalizedColumns, sortState, sortable]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / Math.max(1, pageSize)));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    if (!paginated) return sortedRows;
    const from = (safePage - 1) * pageSize;
    return sortedRows.slice(from, from + pageSize);
  }, [paginated, pageSize, safePage, sortedRows]);

  function toggleSort(column) {
    if (!sortable || !column.sortable) return;
    setPage(1);
    setSortState((prev) => {
      if (prev.columnId !== column.id) {
        return { columnId: column.id, direction: 'asc' };
      }
      return { columnId: column.id, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {(searchable || paginated) ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-lapka-200 bg-white/80 px-3 py-2">
          {searchable ? (
            <input
              className="input h-10 max-w-[320px]"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
            />
          ) : (
            <div />
          )}
          {paginated ? (
            <div className="flex items-center gap-2 text-xs text-lapka-600">
              <span>Показывать</span>
              <select
                className="input !h-10 !w-[88px] !py-0"
                value={pageSize}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setPageSize(next);
                  setPage(1);
                }}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              {normalizedColumns.map((column) => {
                const isSorted = sortState.columnId === column.id;
                const marker = isSorted ? (sortState.direction === 'asc' ? '↑' : '↓') : '';
                return (
                  <th key={column.id} style={column.width ? { width: column.width } : undefined}>
                    <button
                      type="button"
                      className={`group inline-flex items-center gap-1 ${column.sortable && sortable ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={() => toggleSort(column)}
                    >
                      <span>{column.label}</span>
                      <span className="text-xs text-lapka-400 transition group-hover:text-lapka-600">{marker || (column.sortable && sortable ? '↕' : '')}</span>
                    </button>
                  </th>
                );
              })}
              {rowActions ? <th className="w-[56px] text-right">Действия</th> : null}
            </tr>
          </thead>
          <tbody>
            {pageRows.length ? (
              pageRows.map((row) => (
                <tr key={row.__id} className="group transition hover:bg-lapka-50/70">
                  {normalizedColumns.map((column, index) => (
                    <td
                      key={`${row.__id}-${column.id}`}
                      className={column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''}
                    >
                      {getCell(row, column, index)}
                    </td>
                  ))}
                  {rowActions ? (
                    <td className="text-right">
                      <DropdownMenu items={rowActions(row) || []} align="right" />
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Math.max(normalizedColumns.length + (rowActions ? 1 : 0), 1)}>
                  <div className="p-4">
                    <EmptyState title={emptyTitle} text={emptyText} />
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {paginated ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-lapka-600">
          <p>
            Показано {sortedRows.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, sortedRows.length)} из{' '}
            {sortedRows.length}
          </p>
          <div className="flex items-center gap-2">
            <button className="btn-secondary !px-3 !py-1.5 text-xs" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
              Назад
            </button>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-lapka-700">
              {safePage} / {totalPages}
            </span>
            <button
              className="btn-secondary !px-3 !py-1.5 text-xs"
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Вперёд
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
