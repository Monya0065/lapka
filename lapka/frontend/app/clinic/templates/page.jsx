'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';
import { useClinicScope } from '@/lib/clinic-scope';

const TEMPLATE_BLUEPRINTS = [
  {
    id: 'primary_exam',
    title: 'Первичный осмотр',
    type: 'protocol',
    sections: {
      intro: 'Первичный приём {{pet_name}}',
      complaints: 'Снижение аппетита, вялость, изменения поведения.',
      anamnesis: 'Симптомы начались {{today}}, владелец отмечает постепенное снижение активности.',
      exam: 'Состояние стабильное, слизистые розовые, дегидратация не выражена.',
      diagnostics: 'ОАК, биохимия, УЗИ по показаниям.',
      ownerSummary: 'Владельцу объяснены текущие наблюдения и план диагностики.',
      followUp: 'Контрольный контакт через 24–48 часов.',
    },
    checklist: ['Проверить вес', 'Уточнить аппетит', 'Зафиксировать оценку срочности'],
  },
  {
    id: 'anesthesia',
    title: 'Анестезиологический чек-лист',
    type: 'checklist',
    sections: {
      intro: 'Анестезиологический протокол {{pet_name}}',
      complaints: 'Подготовка к вмешательству.',
      anamnesis: 'Анамнез по предыдущим анестезиям и реакциям собран.',
      exam: 'Заполнить ASA-риск, оценить дыхание и сердечно-сосудистый статус.',
      diagnostics: 'Предоперационные анализы и визуальная оценка готовности.',
      ownerSummary: 'Владельцу объяснены риски анестезии и ход наблюдения.',
      followUp: 'Послеоперационный контроль и связь с владельцем.',
    },
    checklist: ['ASA-оценка', 'Подтверждение согласия владельца', 'Проверка оборудования'],
  },
  {
    id: 'inpatient_round',
    title: 'Стационарный раунд',
    type: 'recommendation',
    sections: {
      intro: 'Стационарное обновление {{pet_name}}',
      complaints: 'Текущие наблюдения смены.',
      anamnesis: 'Динамика за последние сутки.',
      exam: 'Указать общее состояние, hydration, pain score.',
      diagnostics: 'Планируемые исследования и повторные контрольные точки.',
      ownerSummary: 'Владелец получил безопасное резюме без лечебных схем.',
      followUp: 'Следующее обновление для владельца через 4–6 часов.',
    },
    checklist: ['Фото-отчёт', 'Обновление для владельца', 'Проверка камер'],
  },
];

const FIELD_META = [
  { key: 'intro', label: 'Заголовок / контекст', placeholder: 'Например: Первичный приём {{pet_name}}' },
  { key: 'complaints', label: 'Жалобы', placeholder: 'Основная жалоба и причины обращения' },
  { key: 'anamnesis', label: 'Анамнез', placeholder: 'Когда появились симптомы, динамика, важные уточнения' },
  { key: 'exam', label: 'Осмотр', placeholder: 'Физикальный осмотр, жизненные показатели, боль, гидратация' },
  { key: 'diagnostics', label: 'Диагностика / план', placeholder: 'Исследования, контрольные точки, повторный контроль' },
  { key: 'ownerSummary', label: 'Сводка для владельца', placeholder: 'Только безопасное резюме для владельца' },
  { key: 'followUp', label: 'Контроль и следующий шаг', placeholder: 'Когда вернуться, что обсудить с врачом' },
];

const PLACEHOLDER_VALUES = {
  '{{pet_name}}': 'Барсик',
  '{{weight}}': '5.2 кг',
  '{{complaints}}': 'Снижение аппетита',
  '{{exam}}': 'Состояние стабильное',
  '{{plan}}': 'Контроль через 24 часа',
  '{{meds}}': 'По протоколу клиники',
  '{{today}}': 'сегодня',
};

const EMPTY_STRUCTURED = {
  intro: '',
  complaints: '',
  anamnesis: '',
  exam: '',
  diagnostics: '',
  ownerSummary: '',
  followUp: '',
};

const TEMPLATE_SCOPE_OPTIONS = [
  { value: 'system', label: 'Платформа' },
  { value: 'clinic', label: 'Клиника' },
  { value: 'branch', label: 'Филиал' },
  { value: 'personal', label: 'Личный врач' },
];

function localizeTemplateType(type) {
  const map = {
    protocol: 'Протокол',
    checklist: 'Чек-лист',
    recommendation: 'Рекомендации',
  };
  return map[type] || type || '—';
}

function localizeScope(scope) {
  const map = {
    system: 'Платформа',
    clinic: 'Клиника',
    branch: 'Филиал',
    personal: 'Личный врач',
  };
  return map[scope] || scope || '—';
}

function localizeSpecialty(value) {
  const map = {
    general: 'Общая практика',
    therapy: 'Терапия',
    surgery: 'Хирургия',
    dermatology: 'Дерматология',
    cardiology: 'Кардиология',
    neurology: 'Неврология',
    anesthesia: 'Анестезиология',
    inpatient: 'Стационар',
  };
  return map[value] || value || '—';
}

function parseBody(body) {
  const lines = String(body || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const next = { ...EMPTY_STRUCTURED };
  const checklist = [];

  for (const line of lines) {
    if (line.startsWith('Заголовок:')) next.intro = line.replace('Заголовок:', '').trim();
    else if (line.startsWith('Жалобы:')) next.complaints = line.replace('Жалобы:', '').trim();
    else if (line.startsWith('Анамнез:')) next.anamnesis = line.replace('Анамнез:', '').trim();
    else if (line.startsWith('Осмотр:')) next.exam = line.replace('Осмотр:', '').trim();
    else if (line.startsWith('Диагностика:')) next.diagnostics = line.replace('Диагностика:', '').trim();
    else if (line.startsWith('Сводка владельцу:')) next.ownerSummary = line.replace('Сводка владельцу:', '').trim();
    else if (line.startsWith('Контроль:')) next.followUp = line.replace('Контроль:', '').trim();
    else if (line.startsWith('Follow-up:')) next.followUp = line.replace('Follow-up:', '').trim();
    else if (line.startsWith('Контроль:')) next.followUp = line.replace('Контроль:', '').trim();
    else if (line.startsWith('- ')) checklist.push(line.replace('- ', '').trim());
  }

  return { sections: next, checklist };
}

function buildBody(sections, checklist) {
  const blocks = [
    `Заголовок: ${sections.intro || 'Шаблон протокола'}`,
    `Жалобы: ${sections.complaints || '{{complaints}}'}`,
    `Анамнез: ${sections.anamnesis || 'Уточнить timeline симптомов.'}`,
    `Осмотр: ${sections.exam || '{{exam}}'}`,
    `Диагностика: ${sections.diagnostics || '{{plan}}'}`,
    `Сводка владельцу: ${sections.ownerSummary || 'Безопасное резюме для владельца.'}`,
    `Контроль: ${sections.followUp || 'Контроль по показаниям.'}`,
  ];

  if (checklist.length) {
    blocks.push('', 'Чек-лист:');
    checklist.forEach((item) => {
      blocks.push(`- ${item}`);
    });
  }

  return blocks.join('\n');
}

function injectPreview(text) {
  return Object.entries(PLACEHOLDER_VALUES).reduce((acc, [key, value]) => acc.replaceAll(key, value), text);
}

function isSystemTemplate(template) {
  return String(template?.id || '').startsWith('system-') || template?.scope === 'system';
}

export default function ClinicTemplatesPage() {
  const { clinicId, selectedClinic } = useClinicScope();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedScope, setSelectedScope] = useState('clinic');
  const [editorMode, setEditorMode] = useState('structured');
  const [name, setName] = useState('Первичный осмотр');
  const [type, setType] = useState('protocol');
  const [specialty, setSpecialty] = useState('general');
  const [visibility, setVisibility] = useState('private');
  const [status, setStatus] = useState('draft');
  const [version, setVersion] = useState(1);
  const [scenarioTags, setScenarioTags] = useState([]);
  const [scenarioTagDraft, setScenarioTagDraft] = useState('');
  const [suggestedTemplates, setSuggestedTemplates] = useState([]);
  const [body, setBody] = useState('');
  const [structured, setStructured] = useState({ ...EMPTY_STRUCTURED });
  const [checklistDraft, setChecklistDraft] = useState('');
  const [checklistItems, setChecklistItems] = useState([]);
  const selectedIdRef = useRef('');

  const specialtyOptions = ['general', 'therapy', 'surgery', 'dermatology', 'cardiology', 'neurology', 'anesthesia', 'inpatient'];
  const visibilityOptions = [
    { value: 'private', label: 'Личный доступ' },
    { value: 'clinic', label: 'Вся клиника' },
    { value: 'branch', label: 'Филиал' },
    { value: 'platform', label: 'Платформа' },
  ];
  const statusOptions = [
    { value: 'draft', label: 'Черновик' },
    { value: 'published', label: 'Опубликован' },
    { value: 'archived', label: 'Архив' },
  ];

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const hydrateFromTemplate = useCallback((template, options = {}) => {
    const parsed = parseBody(template.body);
    setSelectedId(template.id);
    setName(template.name);
    setType(template.template_type);
    setSelectedScope(template.scope || 'clinic');
    setSpecialty(template.specialty || 'general');
    setVisibility(template.visibility || 'private');
    setStatus(template.status || 'draft');
    setVersion(template.version || 1);
    setScenarioTags(Array.isArray(template.scenario_tags) ? template.scenario_tags : []);
    setScenarioTagDraft('');
    setBody(template.body);
    setStructured(parsed.sections);
    setChecklistItems(parsed.checklist);
    setChecklistDraft('');
    if (options.resetFeedback !== false) {
      setSuccess('');
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [clinicPayload] = await Promise.all([
        clinicId ? apiRequest(`/api/v1/clinics/${clinicId}/templates`) : Promise.resolve([]),
      ]);

      const clinicTemplates = (Array.isArray(clinicPayload) ? clinicPayload : []).map((row) => ({
        ...row,
        specialty: row.specialty || 'general',
        visibility: row.visibility || 'clinic',
        status: row.status || 'draft',
        version: row.version || 1,
        author: row.author || localizeScope(row.scope),
      }));
      const systemTemplates = TEMPLATE_BLUEPRINTS.map((blueprint, index) => ({
        id: `system-${blueprint.id}`,
        name: blueprint.title,
        template_type: blueprint.type,
        body: buildBody(blueprint.sections, blueprint.checklist),
        updated_at: new Date(Date.now() - (index + 1) * 86400000).toISOString(),
        scope: 'system',
        specialty: 'general',
        visibility: 'platform',
        status: 'published',
        version: 1,
        author: 'Платформа',
        is_default: false,
        usage_count: 0,
        source_template_id: null,
      }));

      const templates = [...systemTemplates, ...clinicTemplates].sort(
        (left, right) => new Date(right.updated_at || 0) - new Date(left.updated_at || 0)
      );
      setRows(templates);
      if (templates.length) {
        const currentId = selectedIdRef.current;
        const targetTemplate = currentId
          ? templates.find((template) => template.id === currentId) || templates[0]
          : templates[0];
        if (targetTemplate) {
          hydrateFromTemplate(targetTemplate, { resetFeedback: false });
        }
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить шаблоны');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId, hydrateFromTemplate]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    let cancelled = false;

    async function loadSuggestions() {
      if (!clinicId || selectedScope === 'system') {
        setSuggestedTemplates([]);
        return;
      }
      try {
        const params = new URLSearchParams();
        if (specialty) params.set('specialty', specialty);
        const payload = await apiRequest(`/api/v1/clinics/${clinicId}/templates/suggestions?${params.toString()}`);
        if (!cancelled) {
          setSuggestedTemplates(Array.isArray(payload) ? payload.slice(0, 6) : []);
        }
      } catch {
        if (!cancelled) setSuggestedTemplates([]);
      }
    }

    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [clinicId, selectedScope, specialty]);

  const generatedBody = useMemo(() => buildBody(structured, checklistItems), [structured, checklistItems]);
  const previewText = useMemo(() => injectPreview(editorMode === 'raw' ? body : generatedBody), [body, editorMode, generatedBody]);
  const selectedTemplate = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);
  const filteredRows = useMemo(
    () => rows.filter((row) => (row.scope || 'clinic') === selectedScope),
    [rows, selectedScope]
  );
  const templateInsights = useMemo(() => {
    const liveRows = rows.filter((row) => !isSystemTemplate(row));
    const published = liveRows.filter((row) => row.status === 'published').length;
    const archived = liveRows.filter((row) => row.status === 'archived').length;
    const defaults = liveRows.filter((row) => row.is_default).length;
    const topUsed = [...liveRows]
      .sort((left, right) => (right.usage_count || 0) - (left.usage_count || 0))
      .slice(0, 3);
    const recentUse = [...liveRows]
      .filter((row) => row.last_used_at)
      .sort((left, right) => new Date(right.last_used_at) - new Date(left.last_used_at))
      .slice(0, 3);
    return { published, archived, defaults, topUsed, recentUse };
  }, [rows]);

  const tableRows = useMemo(
    () =>
      filteredRows.map((row) => [
        row.scope_label || localizeScope(row.scope),
        localizeTemplateType(row.template_type),
        row.name,
        row.author_name || row.author || '—',
        `v${row.version || 1}`,
        row.status_label || (row.status === 'published' ? 'Опубликован' : row.status === 'archived' ? 'Архив' : 'Черновик'),
        new Date(row.updated_at).toLocaleString('ru-RU'),
        <button
          key={row.id}
          type="button"
          className="btn-secondary !px-3 !py-1 text-xs"
          onClick={() => hydrateFromTemplate(row)}
        >
          Открыть шаблон
        </button>,
      ]),
    [filteredRows, hydrateFromTemplate]
  );

  useEffect(() => {
    if (!filteredRows.length) return;
    const currentScope = rows.find((row) => row.id === selectedIdRef.current)?.scope || '';
    if (currentScope !== selectedScope) {
      hydrateFromTemplate(filteredRows[0], { resetFeedback: false });
    }
  }, [filteredRows, hydrateFromTemplate, rows, selectedScope]);

  async function saveTemplate() {
    setError('');
    setSuccess('');
    const finalBody = editorMode === 'raw' ? body.trim() : generatedBody.trim();

    if (!name.trim() || !finalBody) {
      setError('Название и содержимое шаблона обязательны.');
      return;
    }
    if (!clinicId && selectedScope !== 'system') {
      setError('Сначала выберите клинику или филиал в верхней панели.');
      return;
    }
    if (selectedScope === 'system') {
      setError('Системные шаблоны редактируются из центра платформы.');
      return;
    }

    setSaving(true);
    try {
      const metadata = {
        template_type: type,
        name: name.trim(),
        body: finalBody,
        scope: selectedScope,
        specialty,
        visibility,
        status,
        scenario_tags: scenarioTags,
      };

      if (selectedId && !String(selectedId).startsWith('system-')) {
        const updated = await apiRequest(`/api/v1/templates/${selectedId}`, {
          method: 'PATCH',
          body: {
            name: name.trim(),
            body: finalBody,
            specialty,
            visibility,
            status,
            scenario_tags: scenarioTags,
          },
        });
        setSelectedId(updated.id);
      } else {
        const created = await apiRequest(`/api/v1/clinics/${clinicId}/templates`, {
          method: 'POST',
          body: metadata,
        });
        setSelectedId(created.id);
      }
      setVersion((current) => (selectedId && !isSystemTemplate({ id: selectedId }) ? current + 1 : 1));
      setBody(finalBody);
      setSuccess('Шаблон сохранён.');
      await loadTemplates();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось сохранить шаблон');
    } finally {
      setSaving(false);
    }
  }

  async function runTemplateAction(kind) {
    if (!selectedId || isSystemTemplate({ id: selectedId })) {
      setError('Выберите шаблон клиники, филиала или врача.');
      return;
    }
    setWorkflowBusy(kind);
    setError('');
    setSuccess('');
    try {
      let nextTemplate = null;
      if (kind === 'publish') {
        nextTemplate = await apiRequest(`/api/v1/templates/${selectedId}/publish`, { method: 'POST' });
        setSuccess('Шаблон опубликован.');
      } else if (kind === 'archive') {
        nextTemplate = await apiRequest(`/api/v1/templates/${selectedId}/archive`, { method: 'POST' });
        setSuccess('Шаблон отправлен в архив.');
      } else if (kind === 'default') {
        nextTemplate = await apiRequest(`/api/v1/templates/${selectedId}/set-default`, { method: 'POST' });
        setSuccess('Шаблон отмечен как основной.');
      } else if (kind === 'use') {
        const tracked = await apiRequest(`/api/v1/templates/${selectedId}/track-use`, { method: 'POST' });
        nextTemplate = tracked?.template || null;
        setSuccess('Использование шаблона отмечено.');
      }
      await loadTemplates();
      if (nextTemplate?.id) {
        hydrateFromTemplate(nextTemplate, { resetFeedback: false });
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось выполнить действие');
    } finally {
      setWorkflowBusy('');
    }
  }

  async function cloneSelectedTemplate(targetScope = null) {
    if (!clinicId) {
      setError('Сначала выберите клинику или филиал в верхней панели.');
      return;
    }
    setWorkflowBusy('clone');
    setError('');
    setSuccess('');
    try {
      const resolvedScope = targetScope || (selectedScope === 'system' ? 'clinic' : selectedScope);
      let created = null;
      if (selectedId && !isSystemTemplate({ id: selectedId })) {
        created = await apiRequest(`/api/v1/templates/${selectedId}/clone`, {
          method: 'POST',
          body: {
            name: `${name.trim()} — копия`,
            scope: resolvedScope,
            status: 'draft',
          },
        });
      } else {
        created = await apiRequest(`/api/v1/clinics/${clinicId}/templates`, {
          method: 'POST',
          body: {
            template_type: type,
            name: `${name.trim()} — копия`,
            body: (editorMode === 'raw' ? body : generatedBody).trim(),
            scope: resolvedScope,
            specialty,
            visibility,
            status: 'draft',
            scenario_tags: scenarioTags,
          },
        });
      }
      setSelectedScope(created.scope || 'clinic');
      setSelectedId(created.id);
      setSuccess('Копия шаблона создана.');
      await loadTemplates();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось создать копию шаблона');
    } finally {
      setWorkflowBusy('');
    }
  }

  function resetTemplate() {
    const blueprint = TEMPLATE_BLUEPRINTS[0];
    setSelectedId('');
    setSelectedScope('clinic');
    setName('Новый шаблон');
    setType('protocol');
    setSpecialty('general');
    setVisibility('private');
    setStatus('draft');
    setVersion(1);
    setScenarioTags([]);
    setScenarioTagDraft('');
    setEditorMode('structured');
    setStructured({ ...blueprint.sections });
    setChecklistItems([...blueprint.checklist]);
    setBody(buildBody(blueprint.sections, blueprint.checklist));
    setChecklistDraft('');
    setSuccess('');
    setError('');
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Шаблоны</h1>
          <p className="page-subtitle">
            Система шаблонов по уровням доступа: платформа, клиника, филиал и личный врач. Протоколы, чек-листы и безопасные сводки собираются в едином редакторе.
          </p>
        </div>
        <button className="btn-primary" type="button" onClick={resetTemplate}>
          Создать шаблон
        </button>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadTemplates} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      <ShowcasePanel
        eyebrow="Клинические шаблоны"
        title={`Шаблоны ${selectedClinic?.name || 'клиники'} по уровням платформа / клиника / филиал / личный врач`}
        description="Клиника видит системные базовые шаблоны, управляет клиническими и филиальными версиями и может собирать персональные наборы врача без хаоса в протоколах."
        imageSrc="/assets/img/admin-side.svg"
        imageAlt="Шаблоны клиники"
        badges={[
          `${rows.length} шаблонов`,
          'Структура',
          'Предпросмотр',
        ]}
        compact
      />

      <section className="grid gap-4 2xl:grid-cols-[0.94fr_1.06fr]">
        <Card title="Список шаблонов" subtitle="Хранение клинических шаблонов для визитов и чек-листов">
          <div className="mb-4 flex flex-wrap gap-2">
            {TEMPLATE_SCOPE_OPTIONS.map((scope) => (
              <button
                key={scope.value}
                type="button"
                className={selectedScope === scope.value ? 'btn-primary !px-3 !py-1.5' : 'btn-secondary !px-3 !py-1.5'}
                onClick={() => setSelectedScope(scope.value)}
              >
                {scope.label}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredRows.length ? (
            <Table columns={['Уровень', 'Тип', 'Название', 'Автор', 'Версия', 'Статус', 'Обновлён', 'Действие']} rows={tableRows} initialPageSize={6} />
          ) : (
            <EmptyState title="На этом уровне пока нет шаблонов" text="Переключите уровень или создайте новый шаблон для выбранного контура." />
          )}

          <div className="mt-4 rounded-2xl border border-lapka-200 bg-lapka-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-lapka-900">Рекомендуемые шаблоны</p>
                <p className="text-sm text-lapka-600">Подбор по специализации и фактическому использованию в клинике.</p>
              </div>
              <span className="pill">{suggestedTemplates.length}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {suggestedTemplates.length ? suggestedTemplates.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="rounded-2xl border border-lapka-200 bg-white px-4 py-3 text-left transition hover:border-lapka-300 hover:shadow-card"
                  onClick={() => hydrateFromTemplate(row)}
                >
                  <p className="font-bold text-lapka-900">{row.name}</p>
                  <p className="mt-1 text-sm text-lapka-600">
                    {localizeScope(row.scope)} · {localizeSpecialty(row.specialty)}
                    {row.is_default ? ' · основной' : ''}
                  </p>
                </button>
              )) : (
                <p className="text-sm text-lapka-600">Для выбранной специализации пока нет рекомендованных шаблонов.</p>
              )}
            </div>
          </div>
        </Card>

        <Card title="Конструктор шаблона" subtitle="Структурированный редактор, исходный режим и живой предпросмотр">
          <div className="space-y-4">
            <div className="grid gap-3 xl:grid-cols-4">
              <div className="rounded-2xl border border-lapka-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Опубликовано</p>
                <p className="mt-2 text-3xl font-black text-lapka-900">{templateInsights.published}</p>
                <p className="mt-2 text-sm text-lapka-600">Готовые шаблоны клиники и врача.</p>
              </div>
              <div className="rounded-2xl border border-lapka-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Основные</p>
                <p className="mt-2 text-3xl font-black text-lapka-900">{templateInsights.defaults}</p>
                <p className="mt-2 text-sm text-lapka-600">Шаблоны по умолчанию в рабочих сценариях.</p>
              </div>
              <div className="rounded-2xl border border-lapka-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Архив</p>
                <p className="mt-2 text-3xl font-black text-lapka-900">{templateInsights.archived}</p>
                <p className="mt-2 text-sm text-lapka-600">Старые версии и закрытые контуры.</p>
              </div>
              <div className="rounded-2xl border border-lapka-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Сценарии</p>
                <p className="mt-2 text-3xl font-black text-lapka-900">{scenarioTags.length}</p>
                <p className="mt-2 text-sm text-lapka-600">Теги для быстрого подбора шаблона.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {['structured', 'raw', 'preview'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={editorMode === mode ? 'btn-primary !px-3 !py-1.5' : 'btn-secondary !px-3 !py-1.5'}
                  onClick={() => {
                    if (mode === 'raw') {
                      setBody(generatedBody);
                    }
                    setEditorMode(mode);
                  }}
                >
                  {mode === 'structured' ? 'Структура' : mode === 'raw' ? 'Исходник' : 'Предпросмотр'}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {TEMPLATE_BLUEPRINTS.map((blueprint) => (
                <button
                  key={blueprint.id}
                  type="button"
                  className="rounded-[1.7rem] border border-lapka-200 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(244,250,255,0.96))] p-5 text-left transition hover:-translate-y-0.5 hover:shadow-card"
                  onClick={() => {
                    setType(blueprint.type);
                    setName(blueprint.title);
                    setStructured({ ...blueprint.sections });
                    setChecklistItems([...blueprint.checklist]);
                    setBody(buildBody(blueprint.sections, blueprint.checklist));
                    setEditorMode('structured');
                  }}
                >
                  <p className="text-lg font-extrabold text-lapka-900">{blueprint.title}</p>
                  <p className="mt-1 text-sm uppercase tracking-wide text-lapka-500">{localizeTemplateType(blueprint.type)}</p>
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="label">Название</span>
                <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="block">
                <span className="label">Тип</span>
                <select className="input" value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="protocol">Протокол</option>
                  <option value="checklist">Чек-лист</option>
                  <option value="recommendation">Рекомендации</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <label className="block">
                <span className="label">Уровень шаблона</span>
                <select className="input" value={selectedScope} onChange={(event) => setSelectedScope(event.target.value)}>
                  {TEMPLATE_SCOPE_OPTIONS.map((scope) => (
                    <option key={scope.value} value={scope.value}>{scope.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Специализация</span>
                <select className="input" value={specialty} onChange={(event) => setSpecialty(event.target.value)}>
                  {specialtyOptions.map((item) => (
                    <option key={item} value={item}>
                      {localizeSpecialty(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Видимость</span>
                <select className="input" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                  {visibilityOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Статус</span>
                <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
                  {statusOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-lapka-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-black text-lapka-900">Сценарии применения</p>
                  <p className="text-sm text-lapka-600">Теги помогают быстрее подбирать шаблон под сценарий приёма.</p>
                </div>
                <span className="pill">{scenarioTags.length} тегов</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {scenarioTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-2 rounded-full border border-lapka-200 bg-lapka-50 px-3 py-1 text-sm text-lapka-700">
                    {tag}
                    <button
                      type="button"
                      className="text-lapka-400 transition hover:text-rose-500"
                      onClick={() => setScenarioTags((prev) => prev.filter((item) => item !== tag))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  className="input max-w-xl"
                  value={scenarioTagDraft}
                  placeholder="Например: первичный_приём, контроль, стационар"
                  onChange={(event) => setScenarioTagDraft(event.target.value)}
                />
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    const normalized = scenarioTagDraft.trim().replace(/\s+/g, '_');
                    if (!normalized || scenarioTags.includes(normalized)) return;
                    setScenarioTags((prev) => [...prev, normalized]);
                    setScenarioTagDraft('');
                  }}
                >
                  Добавить тег
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-lapka-200 bg-lapka-50 p-4 text-sm text-lapka-700">
              Версия: <span className="font-semibold">{version}</span> · Уровень: <span className="font-semibold">{TEMPLATE_SCOPE_OPTIONS.find((row) => row.value === selectedScope)?.label || 'Клиника'}</span>
              {selectedTemplate?.is_default ? <span className="ml-2 pill">Основной</span> : null}
              {selectedTemplate?.usage_count ? <span className="ml-2 pill">{selectedTemplate.usage_count} использований</span> : null}
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <div className="rounded-2xl border border-lapka-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-black text-lapka-900">Самые используемые</p>
                    <p className="text-sm text-lapka-600">Шаблоны, которые реально работают в приёме.</p>
                  </div>
                  <span className="pill">{templateInsights.topUsed.length}</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {templateInsights.topUsed.length ? templateInsights.topUsed.map((row) => (
                    <button
                      key={`top-${row.id}`}
                      type="button"
                      className="rounded-2xl border border-lapka-200 bg-lapka-50 px-4 py-3 text-left transition hover:border-lapka-300 hover:bg-white hover:shadow-card"
                      onClick={() => hydrateFromTemplate(row)}
                    >
                      <p className="font-bold text-lapka-900">{row.name}</p>
                      <p className="mt-1 text-sm text-lapka-600">
                        {row.usage_count || 0} использований · {localizeScope(row.scope)}
                      </p>
                    </button>
                  )) : <p className="text-sm text-lapka-600">Использование ещё не накоплено.</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-lapka-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-black text-lapka-900">Последнее применение</p>
                    <p className="text-sm text-lapka-600">Что недавно использовали в клинической работе.</p>
                  </div>
                  <span className="pill">{templateInsights.recentUse.length}</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {templateInsights.recentUse.length ? templateInsights.recentUse.map((row) => (
                    <button
                      key={`recent-${row.id}`}
                      type="button"
                      className="rounded-2xl border border-lapka-200 bg-lapka-50 px-4 py-3 text-left transition hover:border-lapka-300 hover:bg-white hover:shadow-card"
                      onClick={() => hydrateFromTemplate(row)}
                    >
                      <p className="font-bold text-lapka-900">{row.name}</p>
                      <p className="mt-1 text-sm text-lapka-600">
                        {new Date(row.last_used_at).toLocaleString('ru-RU')} · {localizeSpecialty(row.specialty)}
                      </p>
                    </button>
                  )) : <p className="text-sm text-lapka-600">Недавних использований пока нет.</p>}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-lapka-200 bg-white p-4">
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" type="button" onClick={cloneSelectedTemplate} disabled={workflowBusy === 'clone'}>
                  {workflowBusy === 'clone' ? 'Создаём копию...' : 'Клонировать'}
                </button>
                {!isSystemTemplate(selectedTemplate) ? (
                  <>
                    <button className="btn-secondary" type="button" onClick={() => cloneSelectedTemplate('personal')} disabled={workflowBusy === 'clone'}>
                      {workflowBusy === 'clone' ? 'Создаём...' : 'Личная копия врача'}
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => cloneSelectedTemplate('branch')} disabled={workflowBusy === 'clone'}>
                      {workflowBusy === 'clone' ? 'Создаём...' : 'Копия для филиала'}
                    </button>
                  </>
                ) : null}
                {!isSystemTemplate(selectedTemplate) ? (
                  <>
                    <button className="btn-secondary" type="button" onClick={() => runTemplateAction('publish')} disabled={workflowBusy === 'publish'}>
                      {workflowBusy === 'publish' ? 'Публикуем...' : 'Опубликовать'}
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => runTemplateAction('archive')} disabled={workflowBusy === 'archive'}>
                      {workflowBusy === 'archive' ? 'Архивируем...' : 'В архив'}
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => runTemplateAction('default')} disabled={workflowBusy === 'default'}>
                      {workflowBusy === 'default' ? 'Обновляем...' : 'Сделать основным'}
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => runTemplateAction('use')} disabled={workflowBusy === 'use'}>
                      {workflowBusy === 'use' ? 'Фиксируем...' : 'Отметить использование'}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-lapka-600">Системный шаблон можно открыть и использовать как основу, но управление публикацией доступно только для шаблонов клиники и врача.</p>
                )}
              </div>
            </div>

            {editorMode === 'structured' ? (
              <div className="space-y-4">
                <div className="grid gap-3">
                  {FIELD_META.map((field) => (
                    <label className="block" key={field.key}>
                      <span className="label">{field.label}</span>
                      <textarea
                        className="input min-h-[92px]"
                        value={structured[field.key]}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          setStructured((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>

                <div className="rounded-2xl border border-lapka-200 bg-lapka-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-lg font-black text-lapka-900">Чек-лист шаблона</p>
                      <p className="text-sm text-lapka-600">Элементы контроля полноты приёма или процедуры.</p>
                    </div>
                    <span className="pill">{checklistItems.length} пунктов</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {checklistItems.map((item) => (
                      <span key={item} className="inline-flex items-center gap-2 rounded-full border border-lapka-200 bg-white px-3 py-1 text-sm text-lapka-700">
                        {item}
                        <button
                          type="button"
                          className="text-lapka-400 transition hover:text-rose-500"
                          onClick={() => setChecklistItems((prev) => prev.filter((entry) => entry !== item))}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      className="input max-w-xl"
                      value={checklistDraft}
                      placeholder="Добавить пункт чек-листа"
                      onChange={(event) => setChecklistDraft(event.target.value)}
                    />
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => {
                        if (!checklistDraft.trim()) return;
                        setChecklistItems((prev) => [...prev, checklistDraft.trim()]);
                        setChecklistDraft('');
                      }}
                    >
                      Добавить
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {editorMode === 'raw' ? (
              <label className="block">
                <span className="label">Исходное содержимое</span>
                <textarea className="input min-h-[340px]" value={body} onChange={(event) => setBody(event.target.value)} />
              </label>
            ) : null}

            {editorMode === 'preview' ? (
              <div className="rounded-2xl border border-lapka-200 bg-lapka-50 p-4">
                <p className="text-xs uppercase tracking-wide text-lapka-500">Предпросмотр с плейсхолдерами</p>
                <div className="mt-3 whitespace-pre-line rounded-2xl border border-lapka-200 bg-white p-4 text-sm leading-7 text-lapka-700">
                  {previewText}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" type="button" onClick={() => setEditorMode('preview')}>
                Обновить предпросмотр
              </button>
              <button className="btn-primary" type="button" onClick={saveTemplate} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить шаблон'}
              </button>
            </div>
          </div>
        </Card>
      </section>
    </>
  );
}
