'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';
import { loadOwnerBaseData, loadOwnerServicesData } from '@/lib/owner-data';
import { buildServiceOverview, SERVICE_ACTIONS, formatDateTimeLabel } from '@/lib/owner-workspace';
import { localizeServiceType, localizeVisitType, resolveClinicGallery, resolveClinicPhoto } from '@/lib/pets';
import AppImage from '@/components/ui/AppImage';

function money(cents, currency = 'RUB') {
  return `${(Number(cents || 0) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currency}`;
}

export default function OwnerServicesHubPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [insuranceClaims, setInsuranceClaims] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [referralEmail, setReferralEmail] = useState('');
  const [sendingReferral, setSendingReferral] = useState(false);

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [base, services] = await Promise.all([loadOwnerBaseData(), loadOwnerServicesData()]);
      setAppointments(base.appointments);
      setInvoices(base.invoices);
      setClinics(services.clinics || []);
      setInsuranceClaims(services.insuranceClaims || []);
      setReferrals(services.referrals || []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить сервисный центр');
      setAppointments([]);
      setInvoices([]);
      setClinics([]);
      setInsuranceClaims([]);
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  const overview = useMemo(() => buildServiceOverview({ clinics, appointments, invoices }), [appointments, clinics, invoices]);

  async function sendReferralInvite(event) {
    event.preventDefault();
    if (!referralEmail.trim()) return;
    setSendingReferral(true);
    setError('');
    try {
      await apiRequest('/api/v1/referrals/invite', {
        method: 'POST',
        body: {
          invited_email: referralEmail.trim(),
        },
      });
      setReferralEmail('');
      await loadHub();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отправить приглашение');
    } finally {
      setSendingReferral(false);
    }
  }

  function actionLabel(itemId) {
    if (itemId === 'appointments') return 'Открыть записи';
    if (itemId === 'clinics' || itemId === 'map') return 'Открыть карту';
    if (itemId === 'shared-care') return 'Совместный уход';
    if (itemId === 'billing') return 'Открыть финансы';
    return 'Перейти';
  }

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Сервисы</p>
          <h1 className="page-title">Клиники, карта и сервисный контур владельца</h1>
          <p className="page-subtitle">Один центр для записи, клиник рядом, счетов, страховых заявок и сервисов владельца.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/owner/appointments" className="btn-primary">Открыть записи</Link>
          <Link href="/owner/map" className="btn-secondary">Открыть карту</Link>
          <Link href="/owner/passport-center" className="btn-secondary">Паспорт питомца</Link>
          <Link href="/owner/expenses" className="btn-secondary">Открыть расходы</Link>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadHub} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-[420px] w-full" />
        </section>
      ) : (
        <>
          <section className="grid items-start gap-4 xl:grid-cols-2 2xl:grid-cols-4">
            {SERVICE_ACTIONS.map((item) => (
              <Card key={item.id} title={item.title} subtitle={item.description}>
                <Link href={item.href} className="btn-primary">{actionLabel(item.id)}</Link>
              </Card>
            ))}
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
            <Card title="Ближайшие сервисные действия" subtitle="Что нужно сделать сейчас: запись, карта клиник, счета или страховка.">
              <div className="space-y-3">
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Следующая запись</p>
                  <p className="mt-2 text-xl font-black text-lapka-950">{overview.nextAppointment ? localizeServiceType(overview.nextAppointment.service_type || overview.nextAppointment.service_name, 'ru') : 'Пока нет записи'}</p>
                  <p className="mt-1 text-sm text-lapka-600">{overview.nextAppointment ? formatDateTimeLabel(overview.nextAppointment.scheduled_at) : 'Откройте запись и выберите слот в клинике.'}</p>
                </div>
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Открытые счета</p>
                  <p className="mt-2 text-xl font-black text-lapka-950">{overview.outstandingCount} счета</p>
                  <p className="mt-1 text-sm text-lapka-600">На сумму {money(overview.outstandingTotal)}</p>
                </div>
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Страховые заявки</p>
                  <p className="mt-2 text-xl font-black text-lapka-950">{insuranceClaims.length}</p>
                  <p className="mt-1 text-sm text-lapka-600">От черновика до решения страховой в одном сервисном маршруте.</p>
                </div>
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Совместный уход</p>
                  <p className="mt-2 text-xl font-black text-lapka-950">{referrals.length}</p>
                  <p className="mt-1 text-sm text-lapka-600">Приглашения для семьи и доверенных людей вокруг питомца.</p>
                </div>
              </div>
            </Card>

            <Card title="Клиники рядом" subtitle="Реальные клиники Санкт-Петербурга, каталог профилей и быстрый переход на карту.">
              <div className="mb-4 flex flex-wrap gap-2">
                <Link href="/owner/market" className="btn-primary">Открыть каталог клиник</Link>
                <Link href="/owner/map" className="btn-secondary">Открыть карту клиник</Link>
              </div>
              {clinics.length ? (
                <div className="grid gap-3 xl:grid-cols-2">
                  {clinics.slice(0, 6).map((clinic) => (
                    <Link
                      key={clinic.id}
                      href={`/owner/clinic/${clinic.id}`}
                      className="group overflow-hidden rounded-[24px] border border-lapka-200 bg-white transition hover:-translate-y-0.5 hover:shadow-soft"
                    >
                      <div className="relative aspect-[16/8] overflow-hidden border-b border-lapka-200 bg-lapka-100">
                        <AppImage
                          src={resolveClinicPhoto(clinic)}
                          alt={clinic.name}
                          fill
                          className="object-cover transition duration-500 group-hover:scale-[1.02]"
                        />
                      </div>
                      <div className="px-4 py-4">
                        <p className="text-lg font-bold text-lapka-900">{clinic.name}</p>
                        <p className="mt-1 text-sm text-lapka-600">{[clinic.city, clinic.address].filter(Boolean).join(' · ')}</p>
                        {clinic.website ? <p className="mt-1 text-xs text-lapka-500">{clinic.website}</p> : null}
                        <div className="mt-3 flex gap-2 overflow-hidden">
                          {resolveClinicGallery(clinic).slice(0, 3).map((src, index) => (
                            <div key={`${clinic.id}-gallery-${index}`} className="relative h-12 w-16 overflow-hidden rounded-xl border border-lapka-200 bg-lapka-100">
                              <AppImage src={src} alt={`${clinic.name} ${index + 1}`} fill sizes="64px" className="object-cover" />
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="pill !px-3 !py-1.5">Профиль клиники</span>
                          <span className="pill !px-3 !py-1.5">Карта</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title="Клиники пока не загружены" text="Откройте карту или каталог клиник." />
              )}
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.04fr_0.96fr]">
            <Card title="Финансы и страхование" subtitle="Сервисные сущности больше не разбросаны между разными мелкими разделами.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Link href="/owner/billing" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Счета и оплаты</p>
                    <p className="mt-1 text-sm text-lapka-600">История счетов, оплаты в демо-режиме и статусы.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">{invoices.length}</span>
                </Link>
                <Link href="/owner/insurance" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Страхование</p>
                    <p className="mt-1 text-sm text-lapka-600">Полисы и текущие страховые заявки.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">{insuranceClaims.length}</span>
                </Link>
                <Link href="/owner/shared-care" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Совместный уход</p>
                    <p className="mt-1 text-sm text-lapka-600">Семья, доверенные контакты и координация задач вокруг питомца.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">{referrals.length}</span>
                </Link>
                <Link href="/owner/map" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Карта и точки рядом</p>
                    <p className="mt-1 text-sm text-lapka-600">Клиники, аптеки и pet-friendly сервисы вокруг владельца.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Карта</span>
                </Link>
              </div>
            </Card>

            <Card title="Записи и визиты" subtitle="Понятный маршрут от выбора клиники до подтверждённого визита.">
              {appointments.length ? (
                <div className="space-y-3">
                  {appointments.slice(0, 4).map((row) => (
                    <Link key={row.id} href={`/owner/appointment/${row.id}`} className="block rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                      <p className="text-lg font-bold text-lapka-900">{localizeServiceType(row.service_type || row.service_name, 'ru')}</p>
                      <p className="mt-1 text-sm text-lapka-600">{formatDateTimeLabel(row.scheduled_at)} · {localizeVisitType(row.visit_type, 'ru').toLowerCase()}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title="Записей пока нет" text="Сервисный центр связывает клиники, карту и запись в один понятный маршрут." />
              )}
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.02fr_0.98fr]">
            <Card title="Второй слой сервисного центра" subtitle="Дополнительные сценарии владельца не разрастают меню, а усиливают сервисный контур вокруг питомца.">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { title: 'Паспорт питомца', text: 'Чип, паспорт, QR и важные данные в одном центре.', href: '/owner/passport-center' },
                  { title: 'Краткая сводка для врача', text: 'Собрать короткую сводку для врача, поездки или второй клиники.', href: '/owner/export-pack' },
                  { title: 'Поездка с питомцем', text: 'Подготовка к дороге, документы, дорожный комплект и клиники по пути.', href: '/owner/travel' },
                  { title: 'Режим восстановления', text: 'Повторный контроль, ограничения и наблюдение после процедуры.', href: '/owner/recovery' },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className="action-grid-link">
                    <div>
                      <p className="text-lg font-bold text-lapka-900">{item.title}</p>
                      <p className="mt-1 text-sm text-lapka-600">{item.text}</p>
                    </div>
                    <span className="pill !px-3 !py-1.5">
                      {item.href === '/owner/passport-center'
                        ? 'Паспорт'
                        : item.href === '/owner/export-pack'
                          ? 'Экспорт'
                          : item.href === '/owner/travel'
                            ? 'Поездка'
                            : 'Восстановление'}
                    </span>
                  </Link>
                ))}
              </div>
            </Card>

            <Card title="Growth loop: совместный уход" subtitle="Приглашения помогают вернуть владельца в сервис и укрепляют координацию ухода.">
              <form className="space-y-3" onSubmit={sendReferralInvite}>
                <label className="block">
                  <span className="label">Email для приглашения</span>
                  <input
                    className="input"
                    type="email"
                    value={referralEmail}
                    onChange={(event) => setReferralEmail(event.target.value)}
                    placeholder="friend@example.com"
                    required
                  />
                </label>
                <button type="submit" className="btn-primary" disabled={sendingReferral}>
                  {sendingReferral ? 'Отправляем...' : 'Отправить приглашение'}
                </button>
              </form>
              <div className="mt-4 space-y-2 text-sm text-lapka-700">
                {referrals.length ? (
                  referrals.slice(0, 5).map((row) => (
                    <div key={row.id} className="rounded-xl border border-lapka-200 bg-white px-3 py-2">
                      <p className="font-semibold text-lapka-900">{row.invited_email}</p>
                      <p className="text-xs text-lapka-500">
                        {row.status} · {formatDateTimeLabel(row.created_at)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>Пока нет приглашений. Добавьте первого участника совместного ухода.</p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/owner/shared-care" className="btn-secondary">Открыть shared-care</Link>
                <Link href="/owner/inbox" className="btn-secondary">Открыть входящие</Link>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
