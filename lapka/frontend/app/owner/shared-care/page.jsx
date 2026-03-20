'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import SearchInput from '@/components/ui/SearchInput';
import { apiRequest } from '@/lib/api';
import { loadOwnerBaseData } from '@/lib/owner-data';
import {
  addSharedCareMember,
  loadSharedCareTeam,
  removeSharedCareMember,
  SHARED_CARE_SCOPES,
  summarizeSharedCare,
} from '@/lib/shared-care';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

export default function OwnerSharedCarePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pets, setPets] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [careTeam, setCareTeam] = useState([]);
  const [inviteForm, setInviteForm] = useState({ invited_email: '' });
  const [careForm, setCareForm] = useState({
    full_name: '',
    email: '',
    relation: 'Член семьи',
    pet_ids: [],
    scopes: ['timeline', 'medications', 'appointments'],
    note: '',
  });
  const [savingInvite, setSavingInvite] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [query, setQuery] = useState('');

  const loadSharedCare = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [base, referralsPayload] = await Promise.all([
        loadOwnerBaseData(),
        apiRequest('/api/v1/referrals/my'),
      ]);
      setPets(base.pets || []);
      setReferrals(Array.isArray(referralsPayload) ? referralsPayload : []);
      setCareTeam(loadSharedCareTeam());
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить контур совместного ухода');
      setPets([]);
      setReferrals([]);
      setCareTeam(loadSharedCareTeam());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSharedCare();
  }, [loadSharedCare]);

  const stats = useMemo(() => summarizeSharedCare(careTeam, referrals), [careTeam, referrals]);

  const petMap = useMemo(
    () => new Map((pets || []).map((pet) => [pet.id, pet.name])),
    [pets]
  );

  const filteredMembers = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return careTeam;
    return careTeam.filter((row) =>
      [row.full_name, row.email, row.relation]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [careTeam, query]);

  async function onSendInvite(event) {
    event.preventDefault();
    setSavingInvite(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest('/api/v1/referrals/invite', {
        method: 'POST',
        body: { invited_email: inviteForm.invited_email.trim().toLowerCase() },
      });
      setInviteForm({ invited_email: '' });
      setSuccess('Приглашение отправлено. Контакт появится в списке после регистрации.');
      await loadSharedCare();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отправить приглашение');
    } finally {
      setSavingInvite(false);
    }
  }

  function toggleScope(scopeId) {
    setCareForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scopeId)
        ? prev.scopes.filter((item) => item !== scopeId)
        : [...prev.scopes, scopeId],
    }));
  }

  function togglePet(petId) {
    setCareForm((prev) => ({
      ...prev,
      pet_ids: prev.pet_ids.includes(petId)
        ? prev.pet_ids.filter((item) => item !== petId)
        : [...prev.pet_ids, petId],
    }));
  }

  function onAddMember(event) {
    event.preventDefault();
    setSavingMember(true);
    setError('');
    setSuccess('');
    try {
      addSharedCareMember(careForm);
      setCareTeam(loadSharedCareTeam());
      setCareForm({
        full_name: '',
        email: '',
        relation: 'Член семьи',
        pet_ids: [],
        scopes: ['timeline', 'medications', 'appointments'],
        note: '',
      });
      setSuccess('Контакт добавлен в команду ухода владельца.');
    } catch {
      setError('Не удалось сохранить контакт команды ухода');
    } finally {
      setSavingMember(false);
    }
  }

  function onRemoveMember(memberId) {
    removeSharedCareMember(memberId);
    setCareTeam(loadSharedCareTeam());
  }

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Совместный уход</p>
          <h1 className="page-title">Семья, доверенные контакты и координация вокруг питомца</h1>
          <p className="page-subtitle">Единый маршрут для тех, кто помогает с лекарствами, визитами, документами и ежедневным уходом. Это не разрозненные приглашения, а понятный слой координации вокруг питомца.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadSharedCare} /> : null}
      {success ? <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</div> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </section>
      ) : (
        <>
          <section className="kpi-grid">
            <Card title="Команда ухода"><p className="text-[2.2rem] font-black tracking-tight text-lapka-950">{stats.caregivers}</p></Card>
            <Card title="Члены семьи"><p className="text-[2.2rem] font-black tracking-tight text-lapka-950">{stats.family}</p></Card>
            <Card title="Активные приглашения"><p className="text-[2.2rem] font-black tracking-tight text-lapka-950">{stats.activeInvites}</p></Card>
            <Card title="Подключились"><p className="text-[2.2rem] font-black tracking-tight text-lapka-950">{stats.connected}</p></Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.04fr_0.96fr]">
            <Card title="Кого можно подключить" subtitle="Семья, няня, доверенный человек или второй владелец. Настройте круг задач, не смешивая его с клиническим доступом.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-lg font-bold text-lapka-900">Лента и напоминания</p>
                  <p className="mt-2 text-sm text-lapka-600">Дать доступ к событиям, визитам и ближайшим домашним задачам.</p>
                </div>
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-lg font-bold text-lapka-900">Лекарства и курсы</p>
                  <p className="mt-2 text-sm text-lapka-600">Отметки по приёму, остатки и контроль следующего шага.</p>
                </div>
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-lg font-bold text-lapka-900">Документы и выписки</p>
                  <p className="mt-2 text-sm text-lapka-600">Поделиться архивом с тем, кто едет на визит или остаётся дома.</p>
                </div>
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-lg font-bold text-lapka-900">Сервисные задачи</p>
                  <p className="mt-2 text-sm text-lapka-600">Записи, счета, страхование и координация с клиникой.</p>
                </div>
              </div>
            </Card>

            <Card title="Пригласить владельца или члена семьи" subtitle="Приглашение создаёт аккуратную входную точку в Lapka, а не хаотичный обмен сообщениями вне продукта.">
              <form className="space-y-3" onSubmit={onSendInvite}>
                <label className="block">
                  <span className="label">Email приглашения</span>
                  <input
                    className="input"
                    value={inviteForm.invited_email}
                    onChange={(event) => setInviteForm({ invited_email: event.target.value })}
                    placeholder="family@example.com"
                    required
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button className="btn-primary" type="submit" disabled={savingInvite}>
                    {savingInvite ? 'Отправляем...' : 'Отправить приглашение'}
                  </button>
                  <Link href="/owner/services" className="btn-secondary">Вернуться к сервисам</Link>
                </div>
              </form>
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.06fr_0.94fr]">
            <Card title="Команда ухода" subtitle="Кто помогает с питомцем и какие разделы ему действительно нужны.">
              <div className="space-y-4">
                <SearchInput
                  label="Поиск по контактам"
                  placeholder="Имя, email или роль"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />

                {filteredMembers.length ? (
                  <div className="space-y-3">
                    {filteredMembers.map((row) => (
                      <div key={row.id} className="rounded-[26px] border border-lapka-200 bg-white px-5 py-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xl font-black tracking-tight text-lapka-950">{row.full_name}</p>
                            <p className="mt-1 text-sm text-lapka-600">{row.relation} · {row.email}</p>
                          </div>
                          <button type="button" className="btn-secondary !min-h-[40px] !px-4 !py-2 text-sm" onClick={() => onRemoveMember(row.id)}>
                            Удалить
                          </button>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {row.scopes.map((scope) => (
                            <span key={scope} className="pill !px-3 !py-1.5">
                              {SHARED_CARE_SCOPES.find((item) => item.id === scope)?.label || scope}
                            </span>
                          ))}
                        </div>
                        <p className="mt-3 text-sm text-lapka-600">
                          Питомцы: {row.pet_ids.length ? row.pet_ids.map((petId) => petMap.get(petId) || 'Питомец').join(', ') : 'для всех питомцев владельца'}
                        </p>
                        {row.note ? <p className="mt-2 text-sm leading-relaxed text-lapka-600">{row.note}</p> : null}
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Добавлен {formatDateTime(row.created_at)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Команда ухода пока пуста" text="Добавьте первого доверенного человека, который помогает с лекарствами, документами или визитами." />
                )}
              </div>
            </Card>

            <Card title="Добавить доверенный контакт" subtitle="Этот слой не даёт клинических прав и помогает только с бытовым контуром ухода.">
              <form className="space-y-3" onSubmit={onAddMember}>
                <label className="block">
                  <span className="label">Имя и фамилия</span>
                  <input
                    className="input"
                    value={careForm.full_name}
                    onChange={(event) => setCareForm((prev) => ({ ...prev, full_name: event.target.value }))}
                    required
                  />
                </label>
                <label className="block">
                  <span className="label">Email</span>
                  <input
                    className="input"
                    type="email"
                    value={careForm.email}
                    onChange={(event) => setCareForm((prev) => ({ ...prev, email: event.target.value }))}
                    required
                  />
                </label>
                <label className="block">
                  <span className="label">Роль в уходе</span>
                  <input
                    className="input"
                    value={careForm.relation}
                    onChange={(event) => setCareForm((prev) => ({ ...prev, relation: event.target.value }))}
                    placeholder="Член семьи, няня, второй владелец"
                  />
                </label>
                <div className="space-y-2">
                  <span className="label">Для каких питомцев</span>
                  <div className="flex flex-wrap gap-2">
                    {pets.map((pet) => (
                      <button
                        key={pet.id}
                        type="button"
                        className={careForm.pet_ids.includes(pet.id) ? 'btn-primary !min-h-[38px] !px-3 !py-2 text-sm' : 'btn-secondary !min-h-[38px] !px-3 !py-2 text-sm'}
                        onClick={() => togglePet(pet.id)}
                      >
                        {pet.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="label">Какие разделы показать</span>
                  <div className="flex flex-wrap gap-2">
                    {SHARED_CARE_SCOPES.map((scope) => (
                      <button
                        key={scope.id}
                        type="button"
                        className={careForm.scopes.includes(scope.id) ? 'btn-primary !min-h-[38px] !px-3 !py-2 text-sm' : 'btn-secondary !min-h-[38px] !px-3 !py-2 text-sm'}
                        onClick={() => toggleScope(scope.id)}
                      >
                        {scope.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="label">Комментарий</span>
                  <textarea
                    className="input min-h-[110px]"
                    value={careForm.note}
                    onChange={(event) => setCareForm((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="Например, помогает с вечерними лекарствами и возит в клинику по будням."
                  />
                </label>
                <button className="btn-primary" type="submit" disabled={savingMember}>
                  {savingMember ? 'Сохраняем...' : 'Добавить в команду ухода'}
                </button>
              </form>
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.02fr_0.98fr]">
            <Card title="Приглашения в Lapka" subtitle="Те, кто уже получил приглашение через продукт. Здесь видно, кто ещё ждёт регистрацию, а кто уже подключился.">
              {referrals.length ? (
                <div className="space-y-3">
                  {referrals.map((row) => (
                    <div key={row.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold text-lapka-900">{row.invited_email}</p>
                          <p className="mt-1 text-sm text-lapka-600">Код: {row.referral_code} · {formatDateTime(row.created_at)}</p>
                        </div>
                        <span className={row.status === 'registered' ? 'badge-green' : 'badge-yellow'}>
                          {row.status === 'registered' ? 'Подключился' : 'Ожидает регистрацию'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Приглашения ещё не отправлялись" text="Отправьте первое приглашение и соберите care-team вокруг питомца прямо в продукте." />
              )}
            </Card>

            <Card title="Связь с клиникой и сервисами" subtitle="Совместный уход связывается с сервисным контуром: карта, записи, документы и счета остаются в одной среде владельца.">
              <div className="grid gap-3">
                <Link href="/owner/services" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Клиники и карта</p>
                    <p className="mt-1 text-sm text-lapka-600">Выберите клинику и согласуйте, кто едет на визит.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Сервисы</span>
                </Link>
                <Link href="/owner/documents" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Документы питомца</p>
                    <p className="mt-1 text-sm text-lapka-600">Подготовьте архив для того, кто повезёт питомца в клинику.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Архив</span>
                </Link>
                <Link href="/owner/medications" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Лекарства и назначения</p>
                    <p className="mt-1 text-sm text-lapka-600">Синхронизируйте, кто отвечает за следующий приём и запасы.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Курс</span>
                </Link>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
