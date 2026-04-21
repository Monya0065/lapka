'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';
import { useClinicScope } from '@/lib/clinic-scope';

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function SecureMessagesCenter({ role = 'owner' }) {
  const searchParams = useSearchParams();
  const preselectedPetId = searchParams.get('pet_id') || '';
  const preselectedVisitId = searchParams.get('visit_id') || '';
  const [pets, setPets] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [priority, setPriority] = useState('normal');
  const [templateKey, setTemplateKey] = useState('');
  const [selectedPetId, setSelectedPetId] = useState('');
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [selectedThreadKey, setSelectedThreadKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { clinicId } = useClinicScope();
  const templates = useMemo(
    () => [
      { key: 'triage_follow_up', label: 'Follow-up после осмотра', body: 'Нужен короткий follow-up по самочувствию питомца в течение 24 часов.' },
      { key: 'lab_ready', label: 'Готовы лабораторные результаты', body: 'Лабораторные результаты готовы. Пожалуйста, откройте раздел документов и подтвердите ознакомление.' },
      { key: 'inpatient_update', label: 'Обновление стационара', body: 'Есть обновление по стационару. Если нужно, подключим врача в чате в ближайшее время.' },
      { key: 'billing_question', label: 'Вопрос по счёту', body: 'Есть уточнение по счёту/страховому claim. Напишите удобное время для уточнения.' },
    ],
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [petsPayload, messagesPayload] = await Promise.all([
        apiRequest('/api/v1/pets'),
        apiRequest(
          `/api/v1/messages?limit=200${preselectedPetId ? `&pet_id=${encodeURIComponent(preselectedPetId)}` : ''}${
            preselectedVisitId ? `&visit_id=${encodeURIComponent(preselectedVisitId)}` : ''
          }`
        ),
      ]);
      const petRows = Array.isArray(petsPayload) ? petsPayload : [];
      setPets(petRows);
      setSelectedPetId((current) => {
        if (preselectedPetId && petRows.some((pet) => pet.id === preselectedPetId)) return preselectedPetId;
        return current && petRows.some((pet) => pet.id === current) ? current : (petRows[0]?.id || '');
      });
      setSelectedVisitId(preselectedVisitId || '');
      setMessages(Array.isArray(messagesPayload) ? messagesPayload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить secure messaging');
      setPets([]);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [preselectedPetId, preselectedVisitId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredMessages = useMemo(
    () =>
      messages.filter((row) => {
        if (selectedPetId && row.pet_id !== selectedPetId) return false;
        if (selectedVisitId && row.visit_id !== selectedVisitId) return false;
        if (selectedThreadKey) {
          const key = row.visit_id ? `visit:${row.visit_id}` : `pet:${row.pet_id || 'none'}`;
          return key === selectedThreadKey;
        }
        return true;
      }),
    [messages, selectedPetId, selectedThreadKey, selectedVisitId]
  );

  const threads = useMemo(() => {
    const byKey = new Map();
    (messages || []).forEach((row) => {
      if (selectedPetId && row.pet_id !== selectedPetId) return;
      if (selectedVisitId && row.visit_id !== selectedVisitId) return;
      const key = row.visit_id ? `visit:${row.visit_id}` : `pet:${row.pet_id || 'none'}`;
      const prev = byKey.get(key);
      if (!prev || new Date(row.created_at || 0).getTime() > new Date(prev.lastAt || 0).getTime()) {
        byKey.set(key, {
          key,
          pet_id: row.pet_id || '',
          visit_id: row.visit_id || '',
          lastAt: row.created_at,
          title: row.visit_id ? `Визит ${String(row.visit_id).slice(0, 8)}` : `Питомец ${String(row.pet_id || '').slice(0, 8)}`,
        });
      }
    });
    return Array.from(byKey.values()).sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
  }, [messages, selectedPetId, selectedVisitId]);

  const waitingStatus = useMemo(() => {
    if (role !== 'owner') return null;
    if (!filteredMessages.length) return null;
    const ordered = [...filteredMessages].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    const lastOutgoing = [...ordered].reverse().find((row) => row.direction === 'outgoing');
    if (!lastOutgoing) return null;
    const reply = ordered.find(
      (row) =>
        row.direction === 'incoming' &&
        new Date(row.created_at || 0).getTime() > new Date(lastOutgoing.created_at || 0).getTime()
    );
    if (reply) return { level: 'ok', text: 'Ответ получен' };
    const minutes = (Date.now() - new Date(lastOutgoing.created_at || 0).getTime()) / 60000;
    if (minutes >= 240) return { level: 'risk', text: 'Ожидание ответа > 4ч' };
    if (minutes >= 120) return { level: 'warn', text: 'Ожидание ответа > 2ч' };
    return { level: 'wait', text: 'Ожидаем ответ клиники' };
  }, [filteredMessages, role]);
  const incomingCount = useMemo(
    () => filteredMessages.filter((row) => row.direction === 'incoming').length,
    [filteredMessages]
  );
  const slaRiskIncomingCount = useMemo(() => {
    const now = Date.now();
    return filteredMessages.filter((row) => {
      if (row.direction !== 'incoming' || row.is_read) return false;
      const created = new Date(row.created_at || 0).getTime();
      if (!created) return false;
      return (now - created) / 60000 >= 120;
    }).length;
  }, [filteredMessages]);
  const highPriorityCount = useMemo(
    () => filteredMessages.filter((row) => row.priority === 'high').length,
    [filteredMessages]
  );
  const vetClinicalThreads = useMemo(
    () =>
      threads.filter((thread) => String(thread.visit_id || '').trim()).length,
    [threads]
  );
  const vetUnreadRiskCount = useMemo(() => {
    const now = Date.now();
    return filteredMessages.filter((row) => {
      if (row.direction !== 'incoming' || row.is_read) return false;
      const created = new Date(row.created_at || 0).getTime();
      if (!created) return false;
      return (now - created) / 60000 >= 90;
    }).length;
  }, [filteredMessages]);
  const vetMessagePressure = useMemo(() => {
    if (vetUnreadRiskCount >= 6 || highPriorityCount >= 5) return 'HIGH';
    if (vetUnreadRiskCount > 0 || highPriorityCount > 0 || incomingCount >= 8) return 'MED';
    if (filteredMessages.length > 0) return 'OK';
    return 'LOW';
  }, [filteredMessages.length, highPriorityCount, incomingCount, vetUnreadRiskCount]);
  const ownerUnreadCount = useMemo(
    () => filteredMessages.filter((row) => row.direction === 'incoming' && !row.is_read).length,
    [filteredMessages]
  );
  const ownerResponseRate = useMemo(() => {
    const outgoing = filteredMessages.filter((row) => row.direction === 'outgoing').length;
    if (!outgoing) return 0;
    const incomingAfter = filteredMessages.filter((row) => row.direction === 'incoming').length;
    return Math.min(100, Math.round((incomingAfter / outgoing) * 100));
  }, [filteredMessages]);
  const ownerMessagePressure = useMemo(() => {
    if (waitingStatus?.level === 'risk' || ownerUnreadCount >= 4) return 'HIGH';
    if (waitingStatus?.level === 'warn' || ownerUnreadCount > 0) return 'MED';
    if (filteredMessages.length > 0) return 'OK';
    return 'LOW';
  }, [filteredMessages.length, ownerUnreadCount, waitingStatus?.level]);

  async function sendMessage() {
    if (!selectedPetId || !text.trim()) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        pet_id: selectedPetId,
        body: text.trim(),
        priority,
        template_key: templateKey || undefined,
        visit_id: selectedVisitId || undefined,
      };
      if (role !== 'owner' || clinicId) {
        payload.clinic_id = clinicId || undefined;
      }
      await apiRequest('/api/v1/messages', { method: 'POST', body: payload });
      setText('');
      setTemplateKey('');
      setPriority('normal');
      setSuccess('Сообщение отправлено.');
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  }

  function applyTemplate(nextTemplateKey) {
    setTemplateKey(nextTemplateKey);
    const match = templates.find((item) => item.key === nextTemplateKey);
    if (match?.body) setText(match.body);
  }

  function slaBadge(row) {
    if (row.direction !== 'incoming' || row.is_read) return null;
    const created = new Date(row.created_at || 0).getTime();
    if (!created) return null;
    const minutes = (Date.now() - created) / 60000;
    if (minutes >= 240) return <span className="badge-red">SLA risk</span>;
    if (minutes >= 120) return <span className="badge-yellow">SLA warning</span>;
    return null;
  }

  const roleEyebrow =
    role === 'clinic' ? 'Клиника' : role === 'vet' ? 'Врач' : 'Владелец';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-teal-400/14 via-surface-muted to-indigo-400/12 p-6 shadow-card md:p-8 dark:from-teal-500/10 dark:to-indigo-600/10">
        <div className="relative grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">{roleEyebrow} · secure chat</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">Secure Messaging</h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-theme-muted">
              Защищённый канал по питомцу и визиту: шаблоны, приоритеты и треды — видно, что в продукте есть операционная глубина, а не пустая форма.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {role === 'clinic' ? (
                <Link href="/clinic/dashboard" className="btn-secondary">
                  Дашборд
                </Link>
              ) : null}
              <Link href={role === 'owner' ? '/owner/inbox' : role === 'vet' ? '/vet/inbox' : '/clinic/inbox'} className="btn-secondary">
                Вернуться во входящие
              </Link>
            </div>
          </div>
          {!loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Сообщений', value: messages.length, tone: '' },
                { label: 'В ленте', value: filteredMessages.length, tone: 'text-sky-700 dark:text-sky-300' },
                { label: 'Тредов', value: threads.length, tone: 'text-violet-700 dark:text-violet-300' },
                { label: 'Шаблонов', value: templates.length, tone: 'text-amber-700 dark:text-amber-300' },
                { label: 'Питомцев', value: pets.length, tone: 'text-emerald-700 dark:text-emerald-300' },
                { label: 'Ожидание', value: waitingStatus?.text || 'Нет', tone: waitingStatus?.level === 'risk' ? 'text-rose-700 dark:text-rose-300' : waitingStatus?.level === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-theme' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className={`mt-1 text-2xl font-black tabular-nums sm:text-3xl ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          )}
        </div>
      </section>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}
      {success ? <div className="callout-success">{success}</div> : null}

      {!loading && role === 'clinic' ? (
        <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Операционный срез</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">Сигналы коммуникаций смены</h2>
            </div>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
              message ops
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Входящий поток',
                value: incomingCount,
                text: 'Сообщения от владельцев и контуров клиники, требующие обработки на смене.',
                href: '/clinic/inbox',
                tone: 'text-sky-700 dark:text-sky-300',
              },
              {
                title: 'SLA под риском',
                value: slaRiskIncomingCount,
                text: 'Непрочитанные входящие старше 2 часов, которые могут влиять на сервис.',
                href: '/clinic/checkin',
                tone: slaRiskIncomingCount > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300',
              },
              {
                title: 'Высокий приоритет',
                value: highPriorityCount,
                text: 'High-priority треды для быстрого переключения врача или администратора.',
                href: '/clinic/flowboard',
                tone: 'text-violet-700 dark:text-violet-300',
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
      {!loading && role === 'vet' ? (
        <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Операционный срез</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">Сигналы коммуникаций врача</h2>
            </div>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
              vet message ops
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Давление смены',
                value: vetMessagePressure,
                text: 'Сводный риск по непрочитанным сообщениям, high-priority тредам и входящему потоку.',
                href: '/vet/inbox',
                tone: vetMessagePressure === 'HIGH'
                  ? 'text-rose-700 dark:text-rose-300'
                  : vetMessagePressure === 'MED'
                    ? 'text-amber-700 dark:text-amber-300'
                    : vetMessagePressure === 'OK'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-sky-700 dark:text-sky-300',
              },
              {
                title: 'Клинические треды',
                value: vetClinicalThreads,
                text: 'Диалоги, привязанные к визитам, где врачу нужно синхронизировать коммуникацию и лечение.',
                href: '/vet/visit',
                tone: 'text-violet-700 dark:text-violet-300',
              },
              {
                title: 'SLA 90+ мин',
                value: vetUnreadRiskCount,
                text: 'Непрочитанные входящие старше 90 минут, которые замедляют оперативную обратную связь.',
                href: '/vet/appointments',
                tone: vetUnreadRiskCount > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300',
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
      {!loading && role === 'owner' ? (
        <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Операционный срез</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">Сигналы коммуникаций владельца</h2>
            </div>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
              owner message ops
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Давление диалога',
                value: ownerMessagePressure,
                text: 'Сводный статус по времени ожидания и непрочитанным входящим сообщениям от клиники.',
                href: '/owner/inbox',
                tone: ownerMessagePressure === 'HIGH'
                  ? 'text-rose-700 dark:text-rose-300'
                  : ownerMessagePressure === 'MED'
                    ? 'text-amber-700 dark:text-amber-300'
                    : ownerMessagePressure === 'OK'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-sky-700 dark:text-sky-300',
              },
              {
                title: 'Ответ клиники',
                value: `${ownerResponseRate}%`,
                text: 'Доля обратной связи по вашему диалогу для контроля коммуникации с клиникой.',
                href: '/owner/messages',
                tone: 'text-violet-700 dark:text-violet-300',
              },
              {
                title: 'Непрочитанные',
                value: ownerUnreadCount,
                text: 'Входящие сообщения, которые стоит открыть в первую очередь в текущем треде.',
                href: '/owner/records',
                tone: ownerUnreadCount > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300',
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

      <Card title="Новое сообщение" subtitle="Сообщение отправляется только участникам с разрешенным доступом.">
        <div className="grid gap-3 md:grid-cols-[220px_220px_220px_180px_minmax(0,1fr)_auto]">
          <select className="input" value={selectedPetId} onChange={(event) => setSelectedPetId(event.target.value)}>
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            value={selectedVisitId}
            onChange={(event) => setSelectedVisitId(event.target.value.trim())}
            placeholder="visit_id (опц.)"
          />
          <select className="input" value={templateKey} onChange={(event) => applyTemplate(event.target.value)}>
            <option value="">Шаблон сообщения</option>
            {templates.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <select className="input" value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="low">Низкий приоритет</option>
            <option value="normal">Обычный приоритет</option>
            <option value="high">Высокий приоритет</option>
          </select>
          <input
            className="input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Напишите сообщение для владельца/клиники..."
          />
          <button type="button" className="btn-primary" disabled={sending || !selectedPetId || !text.trim()} onClick={sendMessage}>
            {sending ? 'Отправка...' : 'Отправить'}
          </button>
        </div>
      </Card>

      <Card title="История сообщений" subtitle="Лента по питомцу, визиту и треду.">
        {threads.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedThreadKey('')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${selectedThreadKey ? 'border-border bg-surface-muted/70 text-theme' : 'border-border-hover bg-surface-highlight text-theme'}`}
            >
              Все треды
            </button>
            {threads.slice(0, 8).map((thread) => (
              <button
                key={thread.key}
                type="button"
                onClick={() => setSelectedThreadKey(thread.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${selectedThreadKey === thread.key ? 'border-border-hover bg-surface-highlight text-theme' : 'border-border bg-surface-muted/70 text-theme'}`}
                title={thread.key}
              >
                {thread.title}
              </button>
            ))}
          </div>
        ) : null}
        {waitingStatus ? (
          <div
            className={`mb-3 ${
              waitingStatus.level === 'risk'
                ? 'callout-danger'
                : waitingStatus.level === 'warn'
                  ? 'callout-warning'
                  : waitingStatus.level === 'ok'
                    ? 'callout-success'
                    : 'rounded-xl border border-border bg-surface-muted/60 px-3 py-2 text-sm text-theme'
            }`}
          >
            {waitingStatus.text}
          </div>
        ) : null}
        {loading ? (
          <p className="text-sm text-theme-muted">Загрузка…</p>
        ) : filteredMessages.length ? (
          <div className="space-y-3">
            {filteredMessages.map((row) => (
              <article
                key={row.id}
                className={`rounded-[22px] border px-4 py-3 ${row.direction === 'outgoing' ? 'border-border-hover bg-surface-highlight' : 'border-border bg-surface-muted/70'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-theme">
                    {row.direction === 'outgoing' ? 'Вы' : (row.sender_label || 'Участник')}{' '}
                    <span className="text-theme-muted">({row.sender_role || 'role'})</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {row.priority === 'high' ? <span className="badge-red">High</span> : row.priority === 'low' ? <span className="pill">Low</span> : <span className="pill">Normal</span>}
                    {slaBadge(row)}
                    <span className="text-xs text-theme-muted">{formatDateTime(row.created_at)}</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-theme">{row.body}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Пока нет сообщений" text="Начните переписку по питомцу в защищенном канале." />
        )}
      </Card>
    </div>
  );
}
