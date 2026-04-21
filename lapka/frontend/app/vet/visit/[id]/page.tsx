'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import SymptomAutocomplete from '@/components/ui/SymptomAutocomplete';
import Table from '@/components/ui/Table';
import { apiRequest } from '@/lib/api';
import { getApiBase, getStoredSession } from '@/lib/auth';
import { localizePetBreed, localizePetSpecies, resolvePetPhoto } from '@/lib/pets';

const TAB_ITEMS = [
  { id: 'complaints', label: 'Жалобы' },
  { id: 'exam', label: 'Осмотр' },
  { id: 'diagnostics', label: 'Диагностика' },
  { id: 'assessment', label: 'Оценка врача' },
  { id: 'plan', label: 'План врача' },
  { id: 'prescriptions', label: 'Назначения' },
  { id: 'follow_up', label: 'Повторный контроль' },
];

const RED_FLAGS = [
  'Судороги',
  'Дыхательная недостаточность',
  'Шок',
  'Сильное кровотечение',
  'Подозрение на отравление',
  'Тяжёлая травма',
];

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

function calculateAgeYears(birthDate) {
  if (!birthDate) return '';
  const dt = new Date(birthDate);
  if (Number.isNaN(dt.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  return years > 0 ? String(Math.round(years * 10) / 10) : '';
}

function statusBadge(status, finalized) {
  if (finalized || status === 'completed') return <span className="badge-green">Завершён</span>;
  if (status === 'in_progress') return <span className="badge-yellow">В процессе</span>;
  if (status === 'draft') return <span className="pill">Черновик</span>;
  return <span className="pill">{status || 'Черновик'}</span>;
}

function formatPublicLinkState(row) {
  const isExpired = row?.revoked_at || (row?.expires_at && new Date(row.expires_at).getTime() <= Date.now());
  if (row?.revoked_at) return { label: 'Отозвана', tone: 'red' };
  if (isExpired) return { label: 'Истекла', tone: 'yellow' };
  return { label: 'Активна', tone: 'green' };
}

function truncateMiddle(value, head = 8, tail = 6) {
  const source = String(value || '');
  if (!source || source.length <= head + tail + 1) return source || '—';
  return `${source.slice(0, head)}…${source.slice(-tail)}`;
}

async function downloadVisitPdf(visitId) {
  const session = getStoredSession();
  if (!session.accessToken) throw new Error('Нет активной сессии');

  const response = await fetch(`${getApiBase()}/api/v1/visits/${visitId}/export/pdf`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!response.ok) {
    let message = 'Не удалось сформировать PDF';
    try {
      const payload = await response.json();
      message = payload?.detail?.message || payload?.message || message;
    } catch {
      // ignore json parse errors for binary route
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `lapka-visit-${visitId}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export default function VetVisitWorkspacePage() {
  const params = useParams();
  const visitId = useMemo(() => String(params?.id || ''), [params]);

  const [activeTab, setActiveTab] = useState('complaints');
  const [visit, setVisit] = useState(null);
  const [pet, setPet] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [publicLinks, setPublicLinks] = useState([]);

  const [form, setForm] = useState({
    complaints: '',
    anamnesis: '',
    physical_exam: '',
    diagnostics: '',
    assessment_note: '',
    plan_note: '',
    follow_up_note: '',
    owner_summary: '',
  });
  const [newPrescription, setNewPrescription] = useState({
    drug_name: '',
    instruction_note: '',
    prescription_required: false,
  });
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [ttlHours, setTtlHours] = useState(24);
  const [redFlagsMarked, setRedFlagsMarked] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isHydrating, setIsHydrating] = useState(true);
  const [autosaveState, setAutosaveState] = useState('idle');
  const [autosaveAt, setAutosaveAt] = useState('');

  const [actionState, setActionState] = useState({
    starting: false,
    finalizing: false,
    exporting: false,
    generatingLink: false,
    savingPrescription: false,
    revokeToken: '',
  });
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [aiInput, setAiInput] = useState({
    transcriptText: '',
    labText: '',
    species: 'cat',
  });
  const [aiOutput, setAiOutput] = useState({
    structured: null,
    lab: null,
  });
  const [aiBusy, setAiBusy] = useState({
    structuring: false,
    explaining: false,
  });
  const [clinicalInput, setClinicalInput] = useState({
    species: '',
    age: '',
    sex: '',
    labText: '',
  });
  const [clinicalBusy, setClinicalBusy] = useState({
    check: false,
    differential: false,
    labFlags: false,
  });
  const [clinicalOutput, setClinicalOutput] = useState({
    visitCheck: null,
    differential: [],
    labFlags: null,
  });
  const [suggestedProtocols, setSuggestedProtocols] = useState([]);
  const [protocolState, setProtocolState] = useState({
    loading: false,
    error: '',
  });

  const urgent = redFlagsMarked.length > 0;
  const localizedSpecies = localizePetSpecies(pet?.species, 'ru');
  const localizedBreed = localizePetBreed(pet?.breed, 'ru');
  const petPhoto = resolvePetPhoto(pet);

  const loadVisitWorkspace = useCallback(async () => {
    if (!visitId) return;
    setLoading(true);
    setError('');
    setSuccess('');
    setIsHydrating(true);

    try {
      const visitPayload = await apiRequest(`/api/v1/visits/${visitId}`);
      const [petPayload, prescriptionsPayload, linksPayload] = await Promise.all([
        apiRequest(`/api/v1/pets/${visitPayload.pet_id}`),
        apiRequest(`/api/v1/visits/${visitId}/prescriptions`),
        apiRequest(`/api/v1/public-links/prescription?visit_id=${encodeURIComponent(visitId)}&include_expired=true`),
      ]);

      setVisit(visitPayload || null);
      setPet(petPayload || null);
      setPrescriptions(Array.isArray(prescriptionsPayload) ? prescriptionsPayload : []);
      setPublicLinks(Array.isArray(linksPayload) ? linksPayload : []);
      setClinicalInput((prev) => ({
        ...prev,
        species: String(petPayload?.species || prev.species || '').toLowerCase(),
        age: prev.age || calculateAgeYears(petPayload?.birth_date),
        sex: String(petPayload?.sex || prev.sex || '').toLowerCase(),
      }));

      setForm({
        complaints: visitPayload?.complaints || '',
        anamnesis: visitPayload?.anamnesis || '',
        physical_exam: visitPayload?.physical_exam || '',
        diagnostics: visitPayload?.diagnostics || '',
        assessment_note: visitPayload?.assessment_note || '',
        plan_note: visitPayload?.plan_note || '',
        follow_up_note: visitPayload?.follow_up_note || '',
        owner_summary: visitPayload?.owner_summary || '',
      });
      setRedFlagsMarked([]);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить карточку визита');
      setVisit(null);
      setPet(null);
      setPrescriptions([]);
      setPublicLinks([]);
    } finally {
      setLoading(false);
      setIsHydrating(false);
    }
  }, [visitId]);

  useEffect(() => {
    loadVisitWorkspace();
  }, [loadVisitWorkspace]);

  useEffect(() => {
    if (loading || isHydrating || !visit || visit.finalized_flag) return undefined;

    const handle = window.setTimeout(async () => {
      setAutosaveState('saving');
      try {
        const payload = await apiRequest(`/api/v1/visits/${visitId}`, {
          method: 'PATCH',
          queueOnOffline: true,
          body: {
            complaints: form.complaints,
            anamnesis: form.anamnesis,
            physical_exam: form.physical_exam,
            diagnostics: form.diagnostics,
            assessment_note: form.assessment_note,
            plan_note: form.plan_note,
            follow_up_note: form.follow_up_note,
            owner_summary: form.owner_summary,
            chief_complaint: form.complaints,
            exam_findings: form.physical_exam,
          },
        });
        if (payload?.queued) {
          setAutosaveState('queued');
          setAutosaveAt(new Date().toLocaleTimeString('ru-RU'));
          return;
        }
        setVisit((prev) => ({ ...(prev || {}), ...(payload || {}) }));
        setAutosaveState('saved');
        setAutosaveAt(new Date().toLocaleTimeString('ru-RU'));
      } catch (requestError) {
        setAutosaveState('error');
        setError(requestError.message || 'Ошибка автосохранения');
      }
    }, 800);

    return () => window.clearTimeout(handle);
  }, [form, loading, isHydrating, visit, visitId]);

  useEffect(() => {
    if (loading || !visit || !pet) return undefined;
    const handle = window.setTimeout(() => {
      loadSuggestedProtocols({ silent: false });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [clinicalInput.species, form.complaints, form.diagnostics, loadSuggestedProtocols, loading, pet, selectedSymptoms, visit]);

  async function onStartVisit() {
    setError('');
    setSuccess('');
    setActionState((prev) => ({ ...prev, starting: true }));
    try {
      await apiRequest(`/api/v1/visits/${visitId}/start`, { method: 'POST' });
      setSuccess('Приём начат. Статус визита обновлён.');
      await loadVisitWorkspace();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось начать визит');
    } finally {
      setActionState((prev) => ({ ...prev, starting: false }));
    }
  }

  async function onFinalizeVisit() {
    setError('');
    setSuccess('');
    setActionState((prev) => ({ ...prev, finalizing: true }));
    try {
      await apiRequest(`/api/v1/visits/${visitId}/finalize`, {
        method: 'POST',
        body: {
          owner_summary: form.owner_summary,
          follow_up_note: form.follow_up_note,
        },
      });
      setConfirmFinalizeOpen(false);
      setSuccess('Визит финализирован. Владелец получил in-app уведомление.');
      await loadVisitWorkspace();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось финализировать визит');
    } finally {
      setActionState((prev) => ({ ...prev, finalizing: false }));
    }
  }

  async function onExportPdf() {
    setError('');
    setSuccess('');
    setActionState((prev) => ({ ...prev, exporting: true }));
    try {
      await downloadVisitPdf(visitId);
      setSuccess('PDF выписки сформирован и загружен.');
      await loadVisitWorkspace();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось экспортировать PDF');
    } finally {
      setActionState((prev) => ({ ...prev, exporting: false }));
    }
  }

  async function onGeneratePublicLink() {
    if (!visit?.pet_id) return;
    setError('');
    setSuccess('');
    setActionState((prev) => ({ ...prev, generatingLink: true }));
    try {
      const payload = await apiRequest('/api/v1/public-links/prescription', {
        method: 'POST',
        body: {
          visit_id: visitId,
          pet_id: visit.pet_id,
          expires_in_hours: Number(ttlHours) || 24,
        },
      });
      setSuccess(`Публичная QR-ссылка создана. Срок действия: ${Number(ttlHours) || 24} ч.`);
      window.open(`/public-rx/${payload.token}`, '_blank', 'noopener,noreferrer');
      await loadVisitWorkspace();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось создать публичную QR-ссылку');
    } finally {
      setActionState((prev) => ({ ...prev, generatingLink: false }));
    }
  }

  async function onRevokeLinkById(linkId) {
    setError('');
    setSuccess('');
    setActionState((prev) => ({ ...prev, revokeToken: linkId }));
    try {
      await apiRequest(`/api/v1/public-links/id/${encodeURIComponent(linkId)}/revoke`, { method: 'POST' });
      setSuccess('Публичная ссылка отозвана.');
      await loadVisitWorkspace();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отозвать публичную ссылку');
    } finally {
      setActionState((prev) => ({ ...prev, revokeToken: '' }));
    }
  }

  async function onAddPrescription(event) {
    event.preventDefault();
    if (!newPrescription.drug_name.trim() || !newPrescription.instruction_note.trim()) {
      setError('Заполните препарат и заметку по назначению.');
      return;
    }

    setError('');
    setSuccess('');
    setActionState((prev) => ({ ...prev, savingPrescription: true }));
    try {
      await apiRequest(`/api/v1/visits/${visitId}/prescriptions`, {
        method: 'POST',
        body: {
          drug_name: newPrescription.drug_name.trim(),
          instruction_note: newPrescription.instruction_note.trim(),
          prescription_required: Boolean(newPrescription.prescription_required),
        },
      });
      setNewPrescription({ drug_name: '', instruction_note: '', prescription_required: false });
      setSuccess('Назначение добавлено в визит.');
      await loadVisitWorkspace();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось добавить назначение');
    } finally {
      setActionState((prev) => ({ ...prev, savingPrescription: false }));
    }
  }

  async function onAiStructureNotes() {
    if (!visit?.pet_id) return;
    const fallbackText = [
      form.complaints,
      form.anamnesis,
      form.physical_exam,
      form.diagnostics,
    ]
      .filter(Boolean)
      .join('\n');
    const transcriptText = aiInput.transcriptText.trim() || fallbackText.trim();
    if (!transcriptText) {
      setError('Добавьте текст заметок для AI-структурирования.');
      return;
    }

    setError('');
    setAiBusy((prev) => ({ ...prev, structuring: true }));
    try {
      const payload = await apiRequest('/api/v1/ai/visit-structure', {
        method: 'POST',
        body: {
          transcript_text: transcriptText,
          patient_id: visit.pet_id,
        },
      });
      setAiOutput((prev) => ({ ...prev, structured: payload }));
      setForm((prev) => ({
        ...prev,
        complaints: payload.complaints || prev.complaints,
        anamnesis: payload.history || prev.anamnesis,
        physical_exam: payload.physical_exam || prev.physical_exam,
        diagnostics: payload.diagnostics || prev.diagnostics,
        assessment_note: payload.assessment || prev.assessment_note,
        plan_note: payload.plan || prev.plan_note,
        follow_up_note: payload.follow_up || prev.follow_up_note,
      }));
      setSuccess('AI структурировал заметки и обновил поля визита.');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось структурировать заметки через AI');
    } finally {
      setAiBusy((prev) => ({ ...prev, structuring: false }));
    }
  }

  async function onAiExplainLab() {
    const labText = aiInput.labText.trim();
    if (!labText) {
      setError('Добавьте текст лабораторного результата для AI-объяснения.');
      return;
    }

    setError('');
    setAiBusy((prev) => ({ ...prev, explaining: true }));
    try {
      const payload = await apiRequest('/api/v1/ai/lab-explain', {
        method: 'POST',
        body: {
          lab_text: labText,
          species: aiInput.species || 'cat',
        },
      });
      setAiOutput((prev) => ({ ...prev, lab: payload }));
      setSuccess('AI сформировал безопасное объяснение лабораторного текста.');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось выполнить AI-объяснение');
    } finally {
      setAiBusy((prev) => ({ ...prev, explaining: false }));
    }
  }

  const collectSymptomsForDifferential = useCallback(() => {
    const fromAutocomplete = (selectedSymptoms || []).map((item) => String(item?.name || '').trim()).filter(Boolean);
    const fromComplaints = String(form.complaints || '')
      .split(/[,\n;]+/g)
      .map((item) => item.trim())
      .filter((item) => item.length >= 3)
      .slice(0, 10);
    const merged = [...fromAutocomplete, ...fromComplaints];
    return [...new Set(merged)].slice(0, 20);
  }, [form.complaints, selectedSymptoms]);

  const buildProtocolSearchQuery = useCallback(() => {
    const symptoms = collectSymptomsForDifferential();
    if (symptoms.length) return symptoms.slice(0, 6).join(' ');
    const diagnostics = String(form.diagnostics || '')
      .split(/[,\n;]+/g)
      .map((item) => item.trim())
      .filter((item) => item.length >= 4)
      .slice(0, 3)
      .join(' ');
    return diagnostics;
  }, [collectSymptomsForDifferential, form.diagnostics]);

  const loadSuggestedProtocols = useCallback(async ({ silent = false } = {}) => {
    const species = (clinicalInput.species || String(pet?.species || '') || 'cat').toLowerCase();
    const query = buildProtocolSearchQuery();

    if (!silent) {
      setProtocolState((prev) => ({ ...prev, loading: true, error: '' }));
    } else {
      setProtocolState((prev) => ({ ...prev, error: '' }));
    }

    try {
      const params = new URLSearchParams();
      params.set('species', species || 'cat');
      params.set('limit', '6');
      if (query) params.set('q', query);
      const payload = await apiRequest(`/api/v1/protocols?${params.toString()}`);
      let rows = Array.isArray(payload?.items) ? payload.items : [];
      if (!rows.length && query) {
        const fallbackPayload = await apiRequest(`/api/v1/protocols?species=${encodeURIComponent(species || 'cat')}&limit=6`);
        rows = Array.isArray(fallbackPayload?.items) ? fallbackPayload.items : [];
      }
      setSuggestedProtocols(rows.slice(0, 6));
      setProtocolState((prev) => ({ ...prev, loading: false, error: '' }));
    } catch (requestError) {
      setSuggestedProtocols([]);
      setProtocolState((prev) => ({
        ...prev,
        loading: false,
        error: requestError.message || 'Не удалось загрузить протоколы',
      }));
    }
  }, [buildProtocolSearchQuery, clinicalInput.species, pet?.species]);

  async function onClinicalVisitCheck() {
    setError('');
    setClinicalBusy((prev) => ({ ...prev, check: true }));
    try {
      const payload = await apiRequest('/api/v1/clinical/visit-check', {
        method: 'POST',
        body: {
          visit_id: visitId,
          complaints: form.complaints,
          exam: form.physical_exam,
          assessment: form.assessment_note,
          plan: form.plan_note,
          symptoms: (selectedSymptoms || []).map((item) => item.name).filter(Boolean),
        },
      });
      setClinicalOutput((prev) => ({ ...prev, visitCheck: payload }));
      if (Array.isArray(payload?.red_flags_detected) && payload.red_flags_detected.length) {
        setSuccess('Клинический ассистент: обнаружены красные флаги, визит помечен как срочный.');
      } else {
        setSuccess('Клинический ассистент: проверка полноты визита выполнена.');
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось выполнить проверку полноты визита');
    } finally {
      setClinicalBusy((prev) => ({ ...prev, check: false }));
    }
  }

  async function onClinicalDifferential() {
    const symptoms = collectSymptomsForDifferential();
    if (!symptoms.length) {
      setError('Добавьте симптомы в жалобы или через поиск симптомов.');
      return;
    }

    setError('');
    setClinicalBusy((prev) => ({ ...prev, differential: true }));
    try {
      const payload = await apiRequest('/api/v1/clinical/differential', {
        method: 'POST',
        body: {
          visit_id: visitId,
          symptoms,
          species: clinicalInput.species || String(pet?.species || '').toLowerCase() || 'cat',
          age: clinicalInput.age ? Number(clinicalInput.age) : undefined,
          sex: clinicalInput.sex || String(pet?.sex || '').toLowerCase() || undefined,
        },
      });
      setClinicalOutput((prev) => ({ ...prev, differential: Array.isArray(payload) ? payload : [] }));
      if (Array.isArray(payload) && payload.some((item) => item.emergency_flag)) {
        setSuccess('Клинический ассистент: найдены дифференциалы с флагом срочности.');
      } else {
        setSuccess('Клинический ассистент: дифференциальные подсказки обновлены.');
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось сформировать список дифференциалов');
    } finally {
      setClinicalBusy((prev) => ({ ...prev, differential: false }));
    }
  }

  async function onClinicalLabFlags() {
    const labText = String(clinicalInput.labText || '').trim() || String(aiInput.labText || '').trim();
    if (!labText) {
      setError('Добавьте текст лабораторных данных для анализа.');
      return;
    }

    setError('');
    setClinicalBusy((prev) => ({ ...prev, labFlags: true }));
    try {
      const payload = await apiRequest('/api/v1/clinical/lab-flags', {
        method: 'POST',
        body: {
          species: clinicalInput.species || String(pet?.species || '').toLowerCase() || 'cat',
          lab_text: labText,
        },
      });
      setClinicalOutput((prev) => ({ ...prev, labFlags: payload }));
      setSuccess('Клинический ассистент: анализ лабораторных маркеров завершён.');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось проанализировать лабораторные маркеры');
    } finally {
      setClinicalBusy((prev) => ({ ...prev, labFlags: false }));
    }
  }

  const prescriptionRows = prescriptions.map((row) => [
    row.drug_name,
    row.prescription_required ? <span key={`${row.id}-rx`} className="badge-red">Рецептурное</span> : <span key={`${row.id}-otc`} className="badge-green">Без рецепта</span>,
    row.instruction_note || '—',
    formatDateTime(row.created_at),
  ]);

  function onToggleRedFlag(flag) {
    setRedFlagsMarked((prev) => (
      prev.includes(flag) ? prev.filter((item) => item !== flag) : [...prev, flag]
    ));
  }

  function updateFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function appendSelectedSymptomsToComplaints() {
    if (!selectedSymptoms.length) return;
    const summary = selectedSymptoms.map((item) => item.name).join(', ');
    const current = String(form.complaints || '').trim();
    const nextValue = current ? `${current}\nСимптомы: ${summary}` : `Симптомы: ${summary}`;
    updateFormField('complaints', nextValue);
  }

  function renderTabContent() {
    if (activeTab === 'complaints') {
      return (
        <div className="space-y-3">
          <SymptomAutocomplete
            label="Поиск симптомов"
            placeholder="Введите симптом для быстрого добавления"
            selectedSymptoms={selectedSymptoms}
            onChange={setSelectedSymptoms}
            limit={12}
            disabled={Boolean(visit?.finalized_flag)}
          />
          <button
            className="btn-secondary"
            type="button"
            onClick={appendSelectedSymptomsToComplaints}
            disabled={!selectedSymptoms.length || Boolean(visit?.finalized_flag)}
          >
            Добавить выбранные симптомы в жалобы
          </button>
          <label className="block">
            <span className="label">Жалобы</span>
            <textarea
              className="input min-h-[180px]"
              value={form.complaints}
              onChange={(event) => updateFormField('complaints', event.target.value)}
            />
          </label>
        </div>
      );
    }
    if (activeTab === 'exam') {
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="label">Анамнез</span>
            <textarea className="input min-h-[130px]" value={form.anamnesis} onChange={(event) => updateFormField('anamnesis', event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Физикальный осмотр</span>
            <textarea className="input min-h-[180px]" value={form.physical_exam} onChange={(event) => updateFormField('physical_exam', event.target.value)} />
          </label>
        </div>
      );
    }
    if (activeTab === 'diagnostics') {
      return (
        <label className="block">
          <span className="label">Диагностический блок</span>
          <textarea className="input min-h-[200px]" value={form.diagnostics} onChange={(event) => updateFormField('diagnostics', event.target.value)} />
        </label>
      );
    }
    if (activeTab === 'assessment') {
      return (
        <label className="block">
          <span className="label">Оценка состояния врача</span>
          <textarea className="input min-h-[200px]" value={form.assessment_note} onChange={(event) => updateFormField('assessment_note', event.target.value)} />
        </label>
      );
    }
    if (activeTab === 'plan') {
      return (
        <div className="space-y-3">
          <label className="block">
            <span className="label">План врача</span>
            <textarea className="input min-h-[170px]" value={form.plan_note} onChange={(event) => updateFormField('plan_note', event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Краткое описание для владельца</span>
            <textarea className="input min-h-[130px]" value={form.owner_summary} onChange={(event) => updateFormField('owner_summary', event.target.value)} />
          </label>
        </div>
      );
    }
    if (activeTab === 'prescriptions') {
      return (
        <div className="space-y-4">
          {prescriptionRows.length ? (
            <Table columns={['Препарат', 'Тип', 'Заметка врача', 'Создано']} rows={prescriptionRows} />
          ) : (
            <EmptyState title="Назначения пока не добавлены" text="Добавьте назначения перед финализацией визита." />
          )}

          <form className="surface-card p-4" onSubmit={onAddPrescription}>
            <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr_auto]">
              <label className="block">
                <span className="label">Препарат</span>
                <input
                  className="input"
                  value={newPrescription.drug_name}
                  onChange={(event) => setNewPrescription((prev) => ({ ...prev, drug_name: event.target.value }))}
                  placeholder="Например: Амоксициллин"
                />
              </label>
              <label className="block">
                <span className="label">Заметка</span>
                <input
                  className="input"
                  value={newPrescription.instruction_note}
                  onChange={(event) => setNewPrescription((prev) => ({ ...prev, instruction_note: event.target.value }))}
                  placeholder="По протоколу клиники"
                />
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm text-lapka-700">
                <input
                  type="checkbox"
                  checked={newPrescription.prescription_required}
                  onChange={(event) => setNewPrescription((prev) => ({ ...prev, prescription_required: event.target.checked }))}
                />
                Рецептурное
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary" type="submit" disabled={actionState.savingPrescription || visit?.finalized_flag}>
                {actionState.savingPrescription ? 'Сохраняем...' : 'Добавить назначение'}
              </button>
              <Link href="/vet/drugs" className="btn-secondary">
                Открыть справочник препаратов
              </Link>
            </div>
          </form>
        </div>
      );
    }

    return (
      <label className="block">
        <span className="label">Повторный контроль</span>
        <textarea className="input min-h-[220px]" value={form.follow_up_note} onChange={(event) => updateFormField('follow_up_note', event.target.value)} />
      </label>
    );
  }

  function renderPublicLinksCard() {
    return (
      <Card title="Публичные QR-ссылки" subtitle="Токенизированный доступ к назначениям с ограниченным сроком">
        <div className="space-y-4 text-sm text-lapka-700">
          <div className="grid gap-3 md:grid-cols-[220px_auto] md:items-end">
            <label className="block">
              <span className="label">Срок действия (часы)</span>
              <input
                className="input"
                type="number"
                min={1}
                max={168}
                value={ttlHours}
                onChange={(event) => setTtlHours(event.target.value)}
              />
            </label>
            <button
              className="btn-primary md:w-fit"
              type="button"
              onClick={onGeneratePublicLink}
              disabled={actionState.generatingLink || !visit?.finalized_flag}
            >
              {actionState.generatingLink ? 'Создаём...' : 'Сгенерировать QR-ссылку'}
            </button>
          </div>

          <p className="rounded-2xl border border-lapka-200 bg-lapka-50 px-4 py-4 text-base text-lapka-700">
            Ссылка доступна только после завершения визита. На публичной странице видны только назначения, отметка о рецептурности и безопасное предупреждение для владельца.
          </p>

          {publicLinks.length ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {publicLinks.map((row) => {
                const state = formatPublicLinkState(row);
                const badgeClass =
                  state.tone === 'green'
                    ? 'badge-green'
                    : state.tone === 'yellow'
                      ? 'badge-yellow'
                      : 'badge-red';
                return (
                  <article key={row.id} className="rounded-2xl border border-lapka-200 bg-white p-4 shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-lapka-900">{truncateMiddle(row.id, 10, 8)}</p>
                        <p className="mt-1 text-sm text-lapka-600">Истекает: {formatDateTime(row.expires_at)}</p>
                      </div>
                      <span className={badgeClass}>{state.label}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.token ? (
                        <Link href={`/public-rx/${row.token}`} target="_blank" className="btn-secondary !min-h-[44px] !px-4 !py-2">
                          Открыть страницу
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="btn-secondary !min-h-[44px] !px-4 !py-2"
                        disabled={Boolean(row.revoked_at) || actionState.revokeToken === row.id}
                        onClick={() => onRevokeLinkById(row.id)}
                      >
                        {actionState.revokeToken === row.id ? 'Отзываем...' : 'Отозвать'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Ссылок пока нет" text="Создайте первую QR-ссылку после завершения визита." />
          )}
        </div>
      </Card>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="pill">Маршрут клинического визита</p>
          <h1 className="page-title">Рабочее пространство визита</h1>
          <p className="page-subtitle">
            Визит ID: {visitId} · {statusBadge(visit?.status, visit?.finalized_flag)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/vet/patient/${visit?.pet_id || ''}`} className="btn-secondary">
            Карточка пациента
          </Link>
          {!visit?.finalized_flag ? (
            <button className="btn-primary" type="button" onClick={() => setConfirmFinalizeOpen(true)} disabled={actionState.finalizing || loading}>
              {actionState.finalizing ? 'Финализируем...' : 'Завершить визит'}
            </button>
          ) : null}
          <button className="btn-secondary" type="button" onClick={onExportPdf} disabled={actionState.exporting || loading}>
            {actionState.exporting ? 'Генерируем...' : 'Экспорт PDF'}
          </button>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadVisitWorkspace} /> : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
      ) : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-[420px] w-full" />
        </section>
      ) : !visit ? (
        <EmptyState title="Визит не найден" text="Проверьте ссылку или выберите визит из списка записей." />
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Рабочее место врача"
            title={`Приём ${pet?.name || 'пациента'}: единое пространство осмотра, AI-поддержки и QR-доступа`}
            description="Большой рабочий экран без лишнего шума: симптомы, осмотр, план, назначения, клинические подсказки и безопасная owner-сводка находятся в одном контуре."
            imageSrc={petPhoto}
            imageAlt={pet?.name || 'Пациент'}
            badges={[
              localizedSpecies || 'Пациент',
              localizedBreed || 'Порода',
              visit?.finalized_flag ? 'Визит завершён' : 'Визит в работе',
            ]}
            compact
          />

        <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)_420px]">
          <aside className="space-y-5">
            <Card title={pet?.name || 'Пациент'} subtitle={`${localizedSpecies} · ${localizedBreed}`} tone="tinted">
              <div className="space-y-4 text-base text-lapka-700">
                <div
                  className="relative overflow-hidden rounded-[2rem] border border-lapka-200 bg-[radial-gradient(circle_at_top_left,rgba(111,195,255,0.34),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(64,211,154,0.26),transparent_30%),linear-gradient(180deg,#fafdff_0%,#edf6ff_100%)] p-3 shadow-soft"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div className="absolute -left-6 top-4 h-20 w-20 rounded-full bg-cyan-200/50 blur-2xl" />
                  <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-emerald-200/50 blur-2xl" />
                  <span className="absolute left-4 top-4 z-10 inline-flex items-center rounded-full border border-white/70 bg-white/85 px-3 py-1 text-sm font-semibold text-lapka-800 shadow-soft">
                    Пациент визита
                  </span>
                  <div className="relative h-56 w-full overflow-hidden rounded-[1.65rem] border border-white/80 shadow-[0_24px_60px_rgba(26,73,120,0.22)]" style={{ transform: 'translateZ(18px)' }}>
                    <Image
                      src={petPhoto}
                      alt={pet?.name || 'Питомец'}
                      fill
                      sizes="(max-width: 1280px) 100vw, 320px"
                      className="object-cover"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                  <p><span className="font-semibold text-lapka-900">ID:</span> {pet?.id || '—'}</p>
                  <p><span className="font-semibold text-lapka-900">Чип:</span> {pet?.chip_id || '—'}</p>
                  <p><span className="font-semibold text-lapka-900">Lapka ID:</span> {pet?.lapka_id || '—'}</p>
                </div>
                <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2">
                  <p><span className="font-semibold text-lapka-900">Создан:</span> {formatDateTime(visit.created_at)}</p>
                  <p><span className="font-semibold text-lapka-900">Старт:</span> {formatDateTime(visit.started_at)}</p>
                  <p><span className="font-semibold text-lapka-900">Финал:</span> {formatDateTime(visit.finalized_at)}</p>
                </div>
              </div>
            </Card>
          </aside>

          <main className="space-y-5">
            <Card>
              <div className="flex gap-2 overflow-x-auto rounded-2xl border border-lapka-200 bg-white/80 p-2">
                {TAB_ITEMS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-base font-semibold transition ${
                      activeTab === tab.id ? 'bg-lapka-gradient text-white shadow-soft' : 'text-lapka-700 hover:bg-lapka-100'
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="mt-4">{renderTabContent()}</div>
            </Card>

            {renderPublicLinksCard()}
          </main>

          <aside className="space-y-5 xl:col-span-2 2xl:col-span-1">
            <Card title="Состояние визита" subtitle="Автосохранение, статус и срочность" tone="mint">
              <div className="space-y-2 text-sm text-lapka-700">
                <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2">
                  Автосохранение:{' '}
                  {autosaveState === 'saving'
                    ? 'сохраняем...'
                    : autosaveState === 'saved'
                      ? `сохранено (${autosaveAt})`
                      : autosaveState === 'queued'
                        ? `очередь офлайн (${autosaveAt})`
                        : 'ожидание изменений'}
                </div>
                {visit.status !== 'in_progress' ? (
                  <button className="btn-secondary w-full" type="button" onClick={onStartVisit} disabled={actionState.starting || visit.finalized_flag}>
                    {actionState.starting ? 'Запуск...' : 'Начать приём'}
                  </button>
                ) : (
                  <div className="badge-yellow">Приём в процессе</div>
                )}
              </div>
            </Card>

            <Card title="Чек-лист красных флагов" subtitle="Правила срочности визита">
              <div className="space-y-2">
                {RED_FLAGS.map((flag) => (
                  <label key={flag} className="flex items-center gap-2 rounded-xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700">
                    <input
                      type="checkbox"
                      checked={redFlagsMarked.includes(flag)}
                      onChange={() => onToggleRedFlag(flag)}
                    />
                    {flag}
                  </label>
                ))}
              </div>
              <div className="mt-3">
                {urgent ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    Срочно: требуется немедленная очная оценка в клинике.
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Критические флаги не отмечены.
                  </div>
                )}
              </div>
            </Card>

            <Card title="Подходящие протоколы" subtitle="Подсказки по симптомам и состоянию">
              {protocolState.loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : protocolState.error ? (
                <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <p>{protocolState.error}</p>
                  <button className="btn-secondary !px-3 !py-1" type="button" onClick={() => loadSuggestedProtocols()}>
                    Повторить
                  </button>
                </div>
              ) : suggestedProtocols.length === 0 ? (
                <EmptyState title="Подходящие протоколы не найдены" text="Добавьте симптомы в жалобы, чтобы получить рекомендации." />
              ) : (
                <div className="space-y-2">
                  {suggestedProtocols.map((row) => (
                    <article key={row.id} className="rounded-xl border border-lapka-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-lapka-900">{row.name}</p>
                          <p className="text-xs text-lapka-600">{row.category}</p>
                        </div>
                        {row.emergency_flag ? <span className="badge-red">Срочно</span> : <span className="pill">Стандарт</span>}
                      </div>
                      {Array.isArray(row.steps) && row.steps.length ? (
                        <p className="mt-2 text-xs text-lapka-700">{row.steps[0]}</p>
                      ) : null}
                      <div className="mt-2 flex gap-2">
                        <Link
                          href={`/clinical/protocols?q=${encodeURIComponent(row.name)}&species=${encodeURIComponent((pet?.species || 'cat').toLowerCase())}`}
                          className="btn-secondary !px-3 !py-1 text-xs"
                        >
                          Открыть протокол
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Card>

            <Card title="AI и клинические инструменты">
              <div className="space-y-3 text-sm text-lapka-700">
                <div className="rounded-2xl border border-lapka-200 bg-lapka-50 p-3">
                  <p className="font-semibold text-lapka-900">Клинический ассистент врача</p>
                  <p className="mt-1 text-xs text-lapka-600">
                    Только для поддержки принятия решений. Финальный диагноз и клиническое решение принимает врач.
                  </p>

                  <div className="mt-3 grid gap-2">
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        className="input"
                        value={clinicalInput.species}
                        onChange={(event) => setClinicalInput((prev) => ({ ...prev, species: event.target.value.toLowerCase() }))}
                        placeholder="вид"
                      />
                      <input
                        className="input"
                        value={clinicalInput.age}
                        onChange={(event) => setClinicalInput((prev) => ({ ...prev, age: event.target.value }))}
                        placeholder="возраст"
                      />
                      <input
                        className="input"
                        value={clinicalInput.sex}
                        onChange={(event) => setClinicalInput((prev) => ({ ...prev, sex: event.target.value.toLowerCase() }))}
                        placeholder="пол"
                      />
                    </div>

                    <button className="btn-secondary w-full" type="button" onClick={onClinicalVisitCheck} disabled={clinicalBusy.check}>
                      {clinicalBusy.check ? 'Проверяем...' : 'Проверить полноту визита'}
                    </button>
                    <button className="btn-secondary w-full" type="button" onClick={onClinicalDifferential} disabled={clinicalBusy.differential}>
                      {clinicalBusy.differential ? 'Генерируем...' : 'Сформировать дифференциалы'}
                    </button>
                    <button className="btn-secondary w-full" type="button" onClick={onClinicalLabFlags} disabled={clinicalBusy.labFlags}>
                      {clinicalBusy.labFlags ? 'Анализируем...' : 'Проанализировать лабораторию'}
                    </button>
                  </div>

                  {clinicalOutput.visitCheck ? (
                    <details className="mt-3 rounded-xl border border-lapka-200 bg-white px-3 py-2" open>
                      <summary className="cursor-pointer font-semibold text-lapka-800">Полнота визита</summary>
                      <div className="mt-2 space-y-1 text-xs text-lapka-700">
                        <p>
                          <span className="font-semibold">Статус:</span> {clinicalOutput.visitCheck.status}
                        </p>
                        <p>
                          <span className="font-semibold">Флаг визита:</span> {clinicalOutput.visitCheck.visit_flag}
                        </p>
                        <p>
                          <span className="font-semibold">Не хватает:</span>{' '}
                          {(clinicalOutput.visitCheck.missing_sections || []).join(', ') || 'ничего'}
                        </p>
                        {(clinicalOutput.visitCheck.warnings || []).length ? (
                          <ul className="list-disc pl-4">
                            {(clinicalOutput.visitCheck.warnings || []).map((item, index) => (
                              <li key={`warn-${index}`}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </details>
                  ) : null}

                  {Array.isArray(clinicalOutput.differential) && clinicalOutput.differential.length ? (
                    <details className="mt-3 rounded-xl border border-lapka-200 bg-white px-3 py-2" open>
                      <summary className="cursor-pointer font-semibold text-lapka-800">Дифференциальные подсказки</summary>
                      <div className="mt-2 space-y-2 text-xs">
                        {clinicalOutput.differential.slice(0, 8).map((item, index) => (
                          <div key={`${item.disease_name}-${index}`} className="rounded-lg border border-lapka-200 px-2 py-1 text-lapka-700">
                            <p className="font-semibold text-lapka-900">{item.disease_name}</p>
                            <p>{item.category} · вероятность: {item.probability_hint}</p>
                            {item.emergency_flag ? <span className="badge-red mt-1">Флаг срочности</span> : null}
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}

                  {clinicalOutput.labFlags ? (
                    <details className="mt-3 rounded-xl border border-lapka-200 bg-white px-3 py-2" open>
                      <summary className="cursor-pointer font-semibold text-lapka-800">Лабораторные флаги</summary>
                      <div className="mt-2 space-y-1 text-xs text-lapka-700">
                        <p>
                          <span className="font-semibold">Выявлено маркеров:</span> {clinicalOutput.labFlags.count || 0}
                        </p>
                        <ul className="list-disc pl-4">
                          {(clinicalOutput.labFlags.markers_outside_normal_range || []).slice(0, 10).map((item, index) => (
                            <li key={`lab-flag-${index}`}>
                              {item.marker}: {item.value} {item.unit || ''} ({item.flag})
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  ) : null}
                </div>

                <p>AI для врача: структурирование заметок и объяснение лабораторных данных.</p>
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  AI не назначает лечение владельцу и не выдаёт дозировки.
                </p>

                <label className="block">
                  <span className="label">Заметки приёма / транскрипт</span>
                  <textarea
                    className="input min-h-[84px]"
                    value={aiInput.transcriptText}
                    onChange={(event) => setAiInput((prev) => ({ ...prev, transcriptText: event.target.value }))}
                    placeholder="Вставьте текст беседы или заметки по приёму"
                  />
                </label>
                <button className="btn-secondary w-full" type="button" onClick={onAiStructureNotes} disabled={aiBusy.structuring}>
                  {aiBusy.structuring ? 'Структурируем...' : 'Структурировать заметки'}
                </button>

                <label className="block">
                  <span className="label">Текст лабораторного результата</span>
                  <textarea
                    className="input min-h-[84px]"
                    value={aiInput.labText}
                    onChange={(event) => setAiInput((prev) => ({ ...prev, labText: event.target.value }))}
                    placeholder="Вставьте описание лабораторного документа"
                  />
                </label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    className="input"
                    value={aiInput.species}
                    onChange={(event) => setAiInput((prev) => ({ ...prev, species: event.target.value }))}
                    placeholder="Вид: кот / собака"
                  />
                  <button className="btn-secondary" type="button" onClick={onAiExplainLab} disabled={aiBusy.explaining}>
                    {aiBusy.explaining ? 'Объясняем...' : 'Объяснить лабораторию'}
                  </button>
                </div>

                {aiOutput.structured ? (
                  <details className="rounded-xl border border-lapka-200 bg-white px-3 py-2" open>
                    <summary className="cursor-pointer font-semibold text-lapka-800">AI-структурирование заметок</summary>
                    <div className="mt-2 space-y-1 text-xs text-lapka-700">
                      <p><span className="font-semibold">Жалобы:</span> {aiOutput.structured.complaints}</p>
                      <p><span className="font-semibold">Анамнез:</span> {aiOutput.structured.history}</p>
                      <p><span className="font-semibold">Осмотр:</span> {aiOutput.structured.physical_exam}</p>
                      <p><span className="font-semibold">Диагностика:</span> {aiOutput.structured.diagnostics}</p>
                    </div>
                  </details>
                ) : null}

                {aiOutput.lab ? (
                  <details className="rounded-xl border border-lapka-200 bg-white px-3 py-2">
                    <summary className="cursor-pointer font-semibold text-lapka-800">AI-объяснение лаборатории</summary>
                    <div className="mt-2 space-y-1 text-xs text-lapka-700">
                      <p><span className="font-semibold">Кратко:</span> {aiOutput.lab.summary}</p>
                      <p><span className="font-semibold">Что может значить:</span> {aiOutput.lab.possible_meaning}</p>
                      <p className="font-semibold">Что обсудить с врачом:</p>
                      <ul className="list-disc pl-4">
                        {(aiOutput.lab.questions_for_vet || []).map((item, index) => (
                          <li key={`q-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </details>
                ) : null}

                <Link href="/vet/tools" className="btn-secondary w-full">
                  Клинические калькуляторы
                </Link>
              </div>
            </Card>
          </aside>
        </section>
        </>
      )}

      {confirmFinalizeOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-lapka-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-lapka-200 bg-white p-5 shadow-float">
            <h3 className="text-2xl font-black tracking-tight text-lapka-900">Подтвердить финализацию?</h3>
            <p className="mt-2 text-sm text-lapka-600">
              После финализации визит блокируется для редактирования. Владелец получит in-app уведомление о готовой выписке.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button className="btn-secondary" type="button" onClick={() => setConfirmFinalizeOpen(false)}>
                Отмена
              </button>
              <button className="btn-primary" type="button" onClick={onFinalizeVisit} disabled={actionState.finalizing}>
                {actionState.finalizing ? 'Финализация...' : 'Завершить визит'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
