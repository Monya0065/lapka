'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import TopNavigation from '@/components/ui/TopNavigation';

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

const links = [
  { href: '/', label: 'Главная' },
  { href: '/for-owners', label: 'Для владельцев' },
  { href: '/for-vets', label: 'Для врачей' },
  { href: '/for-clinics', label: 'Для клиник' },
  { href: '/security', label: 'Безопасность' },
];

export default function PublicRxClientPage({ token }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPublicRx = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${getApiBase()}/api/v1/public/prescriptions/${encodeURIComponent(token)}`);
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (!response.ok) {
        const message = body?.detail?.message || body?.message || 'Ссылка недоступна';
        throw new Error(message);
      }
      setPayload(body || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось открыть публичную ссылку');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPublicRx();
  }, [loadPublicRx]);

  return (
    <>
      <TopNavigation links={links} />
      <main className="page-wrap py-6">
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card title="Публичная страница назначений" subtitle="Только назначения по токену и безопасное уведомление для владельца">
            <div className="space-y-3">
              <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm text-lapka-700">
                <p className="font-semibold text-lapka-900">Токен</p>
                <p>{token}</p>
              </div>

              {error ? <ErrorBanner message={error} onRetry={loadPublicRx} /> : null}

              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !payload ? (
                <EmptyState title="Данные по ссылке не найдены" text="Проверьте токен, срок действия и статус отзыва." />
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700">
                    <p><span className="font-semibold text-lapka-900">Питомец:</span> {payload.pet_name}</p>
                    <p><span className="font-semibold text-lapka-900">ID визита:</span> {payload.visit_id}</p>
                    <p><span className="font-semibold text-lapka-900">Действует до:</span> {formatDate(payload.expires_at)}</p>
                  </div>

                  <div className="space-y-2">
                    {(payload.medications || []).length ? (
                      payload.medications.map((item) => (
                        <article key={item.id} className="rounded-2xl border border-lapka-200 bg-white p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-lg font-bold text-lapka-900">{item.medication_name}</h3>
                            {item.prescription_required ? (
                              <span className="badge-red">РЕЦЕПТУРНОЕ</span>
                            ) : (
                              <span className="badge-green">Без рецепта</span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-lapka-600">Формы: {(item.forms || []).join(', ') || 'не указано'}</p>
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-xs text-lapka-700">
                              <p className="font-semibold text-lapka-900">Онлайн</p>
                              {(item.where_to_buy?.online || []).slice(0, 2).map((offer, index) => (
                                <p key={`${item.id}-online-${index}`}>{offer.store} · {offer.price_text}</p>
                              ))}
                            </div>
                            <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-xs text-lapka-700">
                              <p className="font-semibold text-lapka-900">Рядом офлайн</p>
                              {(item.where_to_buy?.offline || []).slice(0, 2).map((offer, index) => (
                                <p key={`${item.id}-offline-${index}`}>{offer.pharmacy} · {offer.address}</p>
                              ))}
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <EmptyState title="Назначения не найдены" text="Визит ещё не содержит назначений." />
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="Ограничения доступа" subtitle="Безопасность публичного токена">
            <ul className="space-y-2 text-sm text-lapka-700">
              <li>• Доступ только к назначениям визита.</li>
              <li>• Полная медкарта по public ссылке недоступна.</li>
              <li>• Ссылка ограничена по сроку действия и может быть отозвана.</li>
              <li>• Просмотры токен-ссылки логируются в аудите.</li>
            </ul>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {payload?.safety_disclaimer || 'Информация носит справочный характер. Для медицинских решений обратитесь к ветеринарному врачу.'}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/owner/pharmacy" className="btn-secondary">Найти аптеки</Link>
              <Link href="/login" className="btn-primary">Войти в Лапку</Link>
            </div>
          </Card>
        </section>
      </main>
    </>
  );
}
