'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';

export default function SymptomAutocomplete({
  label = 'Симптомы',
  placeholder = 'Начните вводить симптом',
  selectedSymptoms = [],
  onChange,
  species,
  category,
  limit = 10,
  disabled = false,
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const selectedIds = useMemo(
    () => new Set((selectedSymptoms || []).map((item) => String(item.id))),
    [selectedSymptoms]
  );

  useEffect(() => {
    if (disabled) {
      setSuggestions([]);
      setLoading(false);
      setError('');
      return;
    }

    const normalized = query.trim();
    if (normalized.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        params.set('q', normalized);
        params.set('limit', String(limit));
        if (species) params.set('species', species);
        if (category) params.set('category', category);

        const payload = await apiRequest(`/api/v1/symptoms/search?${params.toString()}`);
        const rows = Array.isArray(payload?.items) ? payload.items : [];
        if (!cancelled) {
          setSuggestions(rows.filter((item) => !selectedIds.has(String(item.id))));
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message || 'Не удалось загрузить симптомы');
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [category, disabled, limit, query, selectedIds, species]);

  function addSymptom(item) {
    if (!item || selectedIds.has(String(item.id))) return;
    const next = [...(selectedSymptoms || []), item];
    onChange?.(next);
    setQuery('');
    setSuggestions([]);
    setError('');
  }

  function removeSymptom(symptomId) {
    const next = (selectedSymptoms || []).filter((item) => String(item.id) !== String(symptomId));
    onChange?.(next);
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="label">{label}</span>
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      </label>

      {loading ? <p className="text-xs text-lapka-600">Ищем симптомы...</p> : null}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}

      {suggestions.length ? (
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-lapka-200 bg-white p-2">
          {suggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm text-lapka-800 transition hover:bg-lapka-50"
              onClick={() => addSymptom(item)}
            >
              <span className="font-semibold">{item.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.emergency_flag ? 'bg-rose-100 text-rose-700' : 'bg-lapka-100 text-lapka-700'}`}>
                {item.emergency_flag ? 'RED' : item.category}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {selectedSymptoms?.length ? (
        <div className="flex flex-wrap gap-2">
          {selectedSymptoms.map((item) => (
            <span
              key={`symptom-${item.id}`}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${item.emergency_flag ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-lapka-200 bg-lapka-50 text-lapka-700'}`}
            >
              {item.name}
              <button
                type="button"
                className="rounded-full px-1.5 text-[10px] font-bold text-lapka-700 hover:bg-lapka-200"
                onClick={() => removeSymptom(item.id)}
                aria-label={`Удалить ${item.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-lapka-600">Выбранные симптомы появятся здесь.</p>
      )}
    </div>
  );
}
