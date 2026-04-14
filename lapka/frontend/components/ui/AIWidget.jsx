'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Badge from '@/components/ui/Badge';
import SymptomAutocomplete from '@/components/ui/SymptomAutocomplete';
import { apiRequest } from '@/lib/api';

function runVetStructurer(text, t) {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return t('aiWidget.structurerEmpty');
  }
  return [
    'Жалобы: ' + normalized.slice(0, 140),
    'Анамнез: уточнить длительность симптомов, аппетит, воду, мочеиспускание.',
    'Осмотр: заполнить объективные параметры и красные флаги.',
    'План: лабораторная/инструментальная диагностика по протоколу клиники.',
  ].join('\n');
}

function formatTriageOutput(payload, t) {
  if (!payload || typeof payload !== 'object') {
    return t('aiWidget.triageFallback');
  }

  const lines = [];
  if (Array.isArray(payload.key_reasons) && payload.key_reasons.length) {
    lines.push(`${t('aiWidget.reasons')}: ${payload.key_reasons.join('; ')}`);
  }
  if (Array.isArray(payload.red_flags_detected) && payload.red_flags_detected.length) {
    lines.push(`${t('aiWidget.redFlags')}: ${payload.red_flags_detected.join(', ')}`);
  }
  if (Array.isArray(payload.next_steps) && payload.next_steps.length) {
    lines.push(`${t('aiWidget.nextSteps')}: ${payload.next_steps.join(' ')}`);
  }
  if (Array.isArray(payload.what_to_prepare_for_visit) && payload.what_to_prepare_for_visit.length) {
    lines.push(`Что подготовить к визиту: ${payload.what_to_prepare_for_visit.join(' ')}`);
  }
  if (payload.disclaimer) {
    lines.push(String(payload.disclaimer));
  }

  return lines.filter(Boolean).join('\n');
}

export default function AIWidget({
  title,
  subtitle,
  mode = 'owner',
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [level, setLevel] = useState(mode === 'vet' ? 'ASSIST' : 'YELLOW');
  const [running, setRunning] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);

  const tone = useMemo(() => {
    if (mode === 'vet') return 'info';
    if (level === 'RED') return 'danger';
    if (level === 'GREEN') return 'success';
    return 'warning';
  }, [mode, level]);

  async function onRun() {
    setRunning(true);
    try {
      if (mode === 'vet') {
        setLevel('ASSIST');
        setOutput(runVetStructurer(input, t));
        return;
      }

      const triagePayload = await apiRequest('/api/v1/medical/triage', {
        method: 'POST',
        body: {
          symptom_text: input,
          symptom_ids: selectedSymptoms.map((item) => item.id),
          symptom_names: selectedSymptoms.map((item) => item.name),
        },
      });

      setLevel(String(triagePayload?.level || 'YELLOW').toUpperCase());
      setOutput(formatTriageOutput(triagePayload, t));
    } catch (requestError) {
      setOutput(requestError.message || t('aiWidget.triageError'));
      setLevel('YELLOW');
    } finally {
      setRunning(false);
    }
  }

  return (
    <article className="surface-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-lapka-900">
            {title || (mode === 'vet' ? t('aiWidget.vetTitle') : t('aiWidget.ownerTitle'))}
          </h3>
          <p className="mt-1 text-sm text-lapka-600">
            {subtitle || (mode === 'vet' ? t('aiWidget.vetSubtitle') : t('aiWidget.ownerSubtitle'))}
          </p>
        </div>
        <Badge tone={tone}>{level}</Badge>
      </div>

      {mode === 'owner' ? (
        <SymptomAutocomplete
          label={t('aiWidget.symptomsLabel')}
          placeholder={t('aiWidget.symptomsPlaceholder')}
          selectedSymptoms={selectedSymptoms}
          onChange={setSelectedSymptoms}
          limit={8}
        />
      ) : null}

      <label className="label mt-3">{t('aiWidget.descriptionLabel')}</label>
      <textarea
        className="input min-h-[92px]"
        placeholder={mode === 'vet' ? t('aiWidget.vetDescriptionPlaceholder') : t('aiWidget.ownerDescriptionPlaceholder')}
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />

      <div className="mt-3 flex items-center justify-between gap-2">
        <button className="btn-primary" type="button" onClick={onRun} disabled={running}>
          {running ? t('aiWidget.running') : t('aiWidget.run')}
        </button>
        <span className="text-xs text-lapka-600">{t('aiWidget.safeMode')}</span>
      </div>

      <div className="mt-3 whitespace-pre-line rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm text-lapka-700">
        {output || t('aiWidget.outputPlaceholder')}
      </div>

      <p className="mt-3 text-xs text-lapka-600">
        {mode === 'vet' ? t('aiWidget.vetDisclaimer') : t('aiWidget.ownerDisclaimer')}
      </p>
    </article>
  );
}
