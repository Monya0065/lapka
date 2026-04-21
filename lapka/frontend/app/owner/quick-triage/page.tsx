'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';
import { loadOwnerBaseData } from '@/lib/owner-data';
import { formatDateTimeLabel } from '@/lib/owner-workspace';
import { localizePetBreed, localizePetSpecies } from '@/lib/pets';

const STORAGE_OK = 'lapka_mvp_pilot_ok';
const STORAGE_CODE = 'lapka_mvp_invite_code';

function formatTriage(data) {
  if (!data || typeof data !== 'object') return '';
  const parts = [];
  if (data.level) parts.push(`Уровень срочности: ${data.level}`);
  if (Array.isArray(data.key_reasons)?.length) parts.push(`Важно: ${data.key_reasons.join(' ')}`);
  if (Array.isArray(data.red_flags_detected)?.length) parts.push(`Красные флаги: ${data.red_flags_detected.join(', ')}`);
  if (Array.isArray(data.next_steps)?.length) parts.push(`Что делать: ${data.next_steps.join(' ')}`);
  if (Array.isArray(data.questions_to_ask)?.length) parts.push(`Вопросы врачу: ${data.questions_to_ask.join(' ')}`);
  if (Array.isArray(data.what_to_prepare_for_visit)?.length) {
    parts.push(`К визиту: ${data.what_to_prepare_for_visit.join(' ')}`);
  }
  if (data.disclaimer) parts.push(String(data.disclaimer));
  return parts.join('\n\n');
}

function QuickTriageContent() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');
  const docLocale = isEn ? 'en' : 'ru';
  const dtLocale = isEn ? 'en' : 'ru';
  const searchParams = useSearchParams();

  const [petsLoading, setPetsLoading] = useState(true);
  const [petsError, setPetsError] = useState('');
  const [pets, setPets] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');

  const [pilotLoading, setPilotLoading] = useState(true);
  const [inviteRequired, setInviteRequired] = useState(false);
  const [pilotReady, setPilotReady] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteErr, setInviteErr] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [storedInviteCode, setStoredInviteCode] = useState('');

  const [symptomText, setSymptomText] = useState('');
  const [resultText, setResultText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(false);
  const [lostPet, setLostPet] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [boostBanner, setBoostBanner] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackRating, setFeedbackRating] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackErr, setFeedbackErr] = useState('');

  const selectedPet = useMemo(() => pets.find((p) => p.id === selectedPetId) || null, [pets, selectedPetId]);
  const nextAppt = useMemo(() => {
    const mine = (appointments || []).filter((a) => a.pet_id === selectedPetId);
    const sorted = [...mine].sort((a, b) => String(a.scheduled_at || '').localeCompare(String(b.scheduled_at || '')));
    return sorted.find((a) => a.status !== 'cancelled') || null;
  }, [appointments, selectedPetId]);

  const loadPets = useCallback(async () => {
    setPetsLoading(true);
    setPetsError('');
    try {
      const base = await loadOwnerBaseData();
      const list = base.pets || [];
      setPets(list);
      setAppointments(base.appointments || []);
      const fromUrl =
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('pet') : null;
      setSelectedPetId((cur) => {
        if (fromUrl && list.some((p) => p.id === fromUrl)) return fromUrl;
        if (cur && list.some((p) => p.id === cur)) return cur;
        return list[0]?.id || '';
      });
    } catch (e) {
      setPetsError(e.message || (isEn ? 'Failed to load pets' : 'Не удалось загрузить питомцев'));
      setPets([]);
    } finally {
      setPetsLoading(false);
    }
  }, [isEn]);

  useEffect(() => {
    loadPets();
  }, [loadPets]);

  const petFromUrl = searchParams.get('pet');
  useEffect(() => {
    if (petsLoading || !pets.length || !petFromUrl) return;
    if (pets.some((p) => p.id === petFromUrl)) setSelectedPetId(petFromUrl);
  }, [petsLoading, pets, petFromUrl]);

  useEffect(() => {
    const b = searchParams.get('boost');
    if (b === 'success') setBoostBanner(isEn ? 'Payment received. Admin will be notified.' : 'Оплата прошла. Администратор получит уведомление.');
    else if (b === 'cancel') setBoostBanner(isEn ? 'Payment cancelled.' : 'Оплата отменена.');
    else setBoostBanner('');
  }, [searchParams, isEn]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPilotLoading(true);
      try {
        const cfg = await apiRequest('/api/v1/mvp/pilot-config', { method: 'GET' });
        if (cancelled) return;
        const required = Boolean(cfg?.invite_required);
        setInviteRequired(required);
        if (!required) {
          setPilotReady(true);
          setStoredInviteCode('');
          return;
        }
        if (typeof window !== 'undefined') {
          const ok = window.sessionStorage.getItem(STORAGE_OK);
          const code = window.sessionStorage.getItem(STORAGE_CODE) || '';
          if (ok === '1' && code) {
            setStoredInviteCode(code);
            setPilotReady(true);
          }
        }
      } catch {
        if (!cancelled) setInviteRequired(false);
        if (!cancelled) setPilotReady(true);
      } finally {
        if (!cancelled) setPilotLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onInviteSubmit(e) {
    e.preventDefault();
    setInviteErr('');
    setInviteSubmitting(true);
    try {
      const res = await apiRequest('/api/v1/mvp/invite/validate', {
        method: 'POST',
        body: { code: inviteInput.trim() },
      });
      if (!res?.valid) {
        setInviteErr(isEn ? 'Invalid code.' : 'Код неверный. Запросите код у команды пилота.');
        return;
      }
      const code = inviteInput.trim();
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(STORAGE_OK, '1');
        window.sessionStorage.setItem(STORAGE_CODE, code);
      }
      setStoredInviteCode(code);
      setPilotReady(true);
    } catch (requestError) {
      setInviteErr(requestError.message || (isEn ? 'Validation failed' : 'Не удалось проверить код'));
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErrorText('');
    setResultText('');
    const trimmed = String(symptomText || '').trim();
    if (!trimmed) {
      setErrorText(isEn ? 'Describe symptoms briefly.' : 'Опишите симптомы коротко.');
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest('/api/v1/ai/triage', {
        method: 'POST',
        body: {
          symptom_text: trimmed,
          selected_symptoms_ids: [],
          severity_indicators: [],
        },
      });
      setResultText(formatTriage(data));
    } catch (requestError) {
      setErrorText(requestError.message || (isEn ? 'Request failed' : 'Не удалось получить ответ'));
    } finally {
      setLoading(false);
    }
  }

  async function onBoostPay() {
    setPayError('');
    const note = String(symptomText || '').trim();
    if (!note) {
      setPayError(isEn ? 'Describe the situation above first.' : 'Сначала опишите ситуацию в поле выше.');
      return;
    }
    const inviteCode = storedInviteCode || (typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_CODE) || '' : '');
    if (inviteRequired && !inviteCode) {
      setPayError(isEn ? 'Pilot code required.' : 'Нужен пилотный код — обновите страницу и введите код.');
      return;
    }
    setPayLoading(true);
    try {
      const data = await apiRequest('/api/v1/mvp/lost-pet-boost/checkout', {
        method: 'POST',
        body: { lost_note: note, invite_code: inviteCode },
      });
      const url = data?.url;
      if (url && typeof window !== 'undefined') {
        window.location.href = url;
        return;
      }
      setPayError(isEn ? 'No checkout URL.' : 'Не получили ссылку на оплату.');
    } catch (requestError) {
      setPayError(requestError.message || (isEn ? 'Payment unavailable' : 'Оплата недоступна'));
    } finally {
      setPayLoading(false);
    }
  }

  async function onFeedbackSubmit(e) {
    e.preventDefault();
    setFeedbackErr('');
    const msg = feedbackMessage.trim();
    if (!msg) {
      setFeedbackErr(isEn ? 'Write at least one sentence.' : 'Напишите хотя бы одно предложение.');
      return;
    }
    const boostSuccess = searchParams.get('boost') === 'success';
    setFeedbackSending(true);
    try {
      await apiRequest('/api/v1/mvp/pilot-feedback', {
        method: 'POST',
        body: {
          message: msg,
          rating: feedbackRating ? Number(feedbackRating) : null,
          context: boostSuccess ? 'after_boost' : 'quick_triage',
        },
      });
      setFeedbackDone(true);
      setFeedbackMessage('');
      setFeedbackRating('');
    } catch (requestError) {
      setFeedbackErr(requestError.message || (isEn ? 'Send failed' : 'Не удалось отправить'));
    } finally {
      setFeedbackSending(false);
    }
  }

  if (pilotLoading) {
    return (
      <div className="min-w-0 space-y-4">
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (inviteRequired && !pilotReady) {
    return (
      <div className="min-w-0 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {isEn ? 'Pilot access' : 'Пилот Lapka'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isEn ? 'Enter your invite code to continue.' : 'Введите инвайт-код, чтобы открыть центр срочной помощи.'}
          </p>
        </header>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <form className="mx-auto max-w-md space-y-4" onSubmit={onInviteSubmit}>
            <input
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none ring-slate-900/10 focus:ring-2"
              autoComplete="off"
              placeholder={isEn ? 'Invite code' : 'Инвайт-код'}
              value={inviteInput}
              onChange={(ev) => setInviteInput(ev.target.value)}
              disabled={inviteSubmitting}
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={inviteSubmitting}
            >
              {inviteSubmitting ? (isEn ? 'Checking…' : 'Проверка…') : isEn ? 'Continue' : 'Продолжить'}
            </button>
          </form>
          {inviteErr ? <p className="mx-auto mt-4 max-w-md text-sm text-rose-600">{inviteErr}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {isEn ? 'Urgency & care hub' : 'Срочность и забота'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isEn ? 'Pet card, triage, and one-click boost — same layout as your dashboard.' : 'Карточка питомца, triage и оплата буста в одном привычном макете.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/owner/dashboard"
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {isEn ? 'Dashboard' : 'Дашборд'}
          </Link>
          <Link
            href="/owner/appointments"
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {isEn ? 'Appointments' : 'Записи'}
          </Link>
        </div>
      </header>

      {petsError ? <ErrorBanner message={petsError} onRetry={loadPets} /> : null}

      {petsLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !selectedPet ? (
        <EmptyState
          title={isEn ? 'Add a pet' : 'Добавьте питомца'}
          text={isEn ? 'Then you can attach triage and photos to a profile.' : 'Тогда triage и фото будут привязаны к профилю.'}
        />
      ) : (
        <>
          {boostBanner ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{boostBanner}</div>
          ) : null}

          {/* Hero: pet card + gallery (dashboard-style) */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid min-w-0 gap-0 lg:grid-cols-[1fr_min(380px,100%)]">
              <div className="min-w-0 p-6 sm:p-8">
                <div className="flex flex-wrap gap-2">
                  {pets.map((pet) => (
                    <button
                      key={pet.id}
                      type="button"
                      onClick={() => setSelectedPetId(pet.id)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        pet.id === selectedPetId ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {pet.name}
                    </button>
                  ))}
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-900 sm:text-2xl">{selectedPet.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {localizePetSpecies(selectedPet.species, docLocale)} · {localizePetBreed(selectedPet.breed, docLocale)}
                  {selectedPet.weight_kg ? ` · ${selectedPet.weight_kg} ${isEn ? 'kg' : 'кг'}` : ''}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/owner/pet/${selectedPet.id}`}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    {isEn ? 'Medical card' : 'Медкарта'}
                  </Link>
                  <Link
                    href={`/owner/pet/${selectedPet.id}/documents`}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {isEn ? 'Documents' : 'Документы'}
                  </Link>
                  <Link
                    href="/owner/triage"
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {isEn ? 'Full SOS flow' : 'Полный SOS'}
                  </Link>
                </div>
              </div>
              <div className="min-w-0 border-t border-slate-200 bg-slate-50/60 p-6 sm:p-8 lg:border-l lg:border-t-0">
                <PetVisualGallery pet={selectedPet} language={langCode} compact className="h-full" />
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{isEn ? 'Next visit' : 'Ближайший приём'}</p>
                  {nextAppt ? (
                    <Link
                      href={`/owner/appointment/${nextAppt.id}`}
                      className="mt-2 block text-sm font-medium text-slate-900 hover:underline"
                    >
                      {formatDateTimeLabel(nextAppt.scheduled_at, dtLocale)}
                    </Link>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">{isEn ? 'No upcoming visit' : 'Нет записей'}</p>
                  )}
                  <Link href="/owner/appointments" className="mt-3 inline-block text-sm font-medium text-slate-600 hover:text-slate-900">
                    {isEn ? 'Schedule →' : 'Записаться →'}
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Triage */}
          <Card title={isEn ? 'Symptom check (about 1 min)' : 'Проверка симптомов (~1 мин)'} subtitle={isEn ? 'Not a diagnosis. Urgency hints only.' : 'Не диагноз. Только ориентир по срочности.'}>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="symptoms">
                  {isEn ? 'What is wrong or missing?' : 'Что беспокоит или что случилось?'}
                </label>
                <textarea
                  id="symptoms"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-slate-900/10 focus:ring-2 min-h-[128px]"
                  placeholder={
                    selectedPet
                      ? isEn
                        ? `e.g. ${selectedPet.name}: vomiting since morning…`
                        : `Например, ${selectedPet.name}: рвота с утра…`
                      : isEn
                        ? 'Describe symptoms…'
                        : 'Опишите симптомы…'
                  }
                  value={symptomText}
                  onChange={(ev) => setSymptomText(ev.target.value)}
                  disabled={loading}
                  maxLength={1500}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={lostPet} onChange={(ev) => setLostPet(ev.target.checked)} disabled={loading} className="rounded border-slate-300" />
                {isEn ? 'Lost pet — show boost payment' : 'Питомец пропал — показать оплату «поднять объявление»'}
              </label>
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
                disabled={loading}
              >
                {loading ? (isEn ? 'Sending…' : 'Отправка…') : isEn ? 'Run triage' : 'Запустить triage'}
              </button>
            </form>

            {lostPet ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-sm font-semibold text-amber-950">{isEn ? 'Boost listing (Stripe)' : 'Поднять объявление (Stripe)'}</p>
                <p className="mt-1 text-xs text-amber-900/90">
                  {isEn
                    ? 'One-click secure checkout. Amount is set in your Stripe price.'
                    : 'Безопасная оплата в один клик. Сумма задаётся ценой в Stripe.'}
                </p>
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                  disabled={payLoading || loading}
                  onClick={onBoostPay}
                >
                  {payLoading ? (isEn ? 'Redirecting…' : 'Переход к оплате…') : isEn ? 'Pay boost — one click' : 'Оплатить буст — один клик'}
                </button>
                {payError ? <p className="mt-2 text-xs text-rose-700">{payError}</p> : null}
              </div>
            ) : null}

            {errorText ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 whitespace-pre-wrap">{errorText}</div>
            ) : null}

            {resultText ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap">{resultText}</div>
            ) : null}
          </Card>

          <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer select-none px-6 py-4 text-sm font-medium text-slate-800 hover:bg-slate-50">
              {isEn ? 'Feedback for the team (optional)' : 'Отзыв команде (по желанию)'}
            </summary>
            <div className="border-t border-slate-100 px-6 py-4">
              {feedbackDone ? (
                <p className="text-sm text-emerald-700">{isEn ? 'Thanks, recorded.' : 'Спасибо, записали.'}</p>
              ) : (
                <form className="space-y-3" onSubmit={onFeedbackSubmit}>
                  <select
                    className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={feedbackRating}
                    onChange={(ev) => setFeedbackRating(ev.target.value)}
                    disabled={feedbackSending}
                  >
                    <option value="">{isEn ? 'Rating (optional)' : 'Оценка (необяз.)'}</option>
                    <option value="5">5</option>
                    <option value="4">4</option>
                    <option value="3">3</option>
                    <option value="2">2</option>
                    <option value="1">1</option>
                  </select>
                  <textarea
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[72px]"
                    placeholder={isEn ? 'Comment…' : 'Комментарий…'}
                    value={feedbackMessage}
                    onChange={(ev) => setFeedbackMessage(ev.target.value)}
                    disabled={feedbackSending}
                    maxLength={2000}
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    disabled={feedbackSending}
                  >
                    {feedbackSending ? (isEn ? 'Sending…' : 'Отправка…') : isEn ? 'Send' : 'Отправить'}
                  </button>
                </form>
              )}
              {feedbackErr ? <p className="mt-2 text-xs text-rose-600">{feedbackErr}</p> : null}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

export default function QuickTriagePage() {
  return (
    <Suspense
      fallback={
        <div className="min-w-0 space-y-4 p-2">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-48 w-full" />
        </div>
      }
    >
      <QuickTriageContent />
    </Suspense>
  );
}
