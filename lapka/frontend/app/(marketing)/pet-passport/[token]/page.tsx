'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import { apiRequest } from '@/lib/api';

export default function PublicPetPassportPage() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const lang = langCode.startsWith('en') ? 'en' : 'ru';
  const tr = (ru, en) => (lang === 'en' ? en : ru);
  const params = useParams();
  const token = useMemo(() => params?.token || '', [params]);

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/v1/public/pet/${token}`, { auth: false });
      setPayload(data || null);
    } catch (requestError) {
      setError(requestError.message || (lang === 'en' ? 'Passport not found or revoked' : 'Паспорт не найден или отозван'));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [token, lang]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const heroTitle = loading
    ? tr('Загружаем публичный паспорт…', 'Loading public passport...')
    : payload?.pet_name || tr('Публичный паспорт питомца', 'Public pet passport');
  const heroSubtitle = loading
    ? tr('Проверяем токен и статус публичной ссылки.', 'Validating token and public link status.')
    : payload
      ? tr('Если вы нашли питомца, используйте безопасный контакт с владельцем.', 'If you found this pet, use secure owner contact.')
      : tr('Ссылка могла истечь или быть отозвана владельцем.', 'The link may have expired or been revoked by owner.');

  return (
    <main className="page-wrap py-6">
      <section className="mx-auto max-w-4xl space-y-4">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-fuchsia-400/12 via-surface-muted to-purple-400/14 p-5 shadow-card md:p-8 dark:from-fuchsia-500/10 dark:to-purple-500/10">
          <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">{tr('Нашли питомца?', 'Found a pet?')}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">{heroTitle}</h1>
              <p className="mt-3 text-sm leading-relaxed text-theme-muted">{heroSubtitle}</p>
              {!loading && payload ? (
                <p className="mt-2 text-sm font-semibold text-theme">
                  {payload.species}
                  {payload.breed ? ` · ${payload.breed}` : ''}
                  {payload.color ? ` · ${payload.color}` : ''}
                </p>
              ) : null}
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  {
                    label: tr('Чип', 'Chip'),
                    value: payload?.microchip_id ? tr('Указан', 'Provided') : tr('Скрыт', 'Hidden'),
                    tone: payload?.microchip_id ? 'text-emerald-700 dark:text-emerald-300' : '',
                  },
                  {
                    label: tr('Контакт', 'Contact'),
                    value: payload?.emergency_contact_phone ? tr('Есть', 'Available') : tr('Скрыт', 'Hidden'),
                    tone: payload?.emergency_contact_phone ? 'text-sky-700 dark:text-sky-300' : '',
                  },
                  {
                    label: tr('Аллергии', 'Allergies'),
                    value: payload?.allergies_summary ? tr('Кратко', 'Brief') : tr('Нет', 'No'),
                    tone: payload?.allergies_summary ? 'text-amber-700 dark:text-amber-300' : '',
                  },
                  {
                    label: tr('Фото', 'Photo'),
                    value: payload?.photo ? tr('Да', 'Yes') : tr('Нет', 'No'),
                    tone: payload?.photo ? 'text-violet-700 dark:text-violet-300' : '',
                  },
                  { label: tr('Токен', 'Token'), value: token ? 'OK' : '—', tone: 'text-rose-700 dark:text-rose-300' },
                  { label: tr('Статус', 'Status'), value: payload ? tr('Активен', 'Active') : tr('Недоступен', 'Unavailable'), tone: payload ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300' },
                ].map((cell) => (
                  <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                    <p className={`mt-1 text-lg font-black sm:text-xl ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {error ? <ErrorBanner message={error} onRetry={loadProfile} /> : null}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !payload ? (
          <EmptyState title={tr('Паспорт недоступен', 'Passport unavailable')} text={tr('Ссылка могла истечь или быть отозвана владельцем.', 'The link may have expired or been revoked by owner.')} />
        ) : (
          <>
          <section className="grid gap-4 md:grid-cols-[340px_minmax(0,1fr)]">
            <PetVisualGallery
              pet={{
                name: payload.pet_name,
                photo_url: payload.photo,
                species: payload.species,
                breed: payload.breed,
                chip_id: payload.microchip_id,
              }}
              language={lang}
              title={tr('Фото и ориентиры', 'Photo and landmarks')}
              subtitle={tr('Публичный паспорт показывает фото питомца, породный ориентир и 3D-визуал без доступа к медкарте.', 'Public passport shows pet photo, breed hints, and 3D visual without access to medical records.')}
              compact
            />

            <Card title={tr('Карточка для поиска', 'Search card')} subtitle={tr('Безопасные поля без доступа к медкарте', 'Safe fields without medical record access')}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface-muted/70 px-3 py-2 text-sm text-theme">
                  <p className="text-xs uppercase tracking-wide text-theme-muted">{tr('Окрас', 'Color')}</p>
                  <p className="font-semibold text-theme">{payload.color || '—'}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted/70 px-3 py-2 text-sm text-theme">
                  <p className="text-xs uppercase tracking-wide text-theme-muted">{tr('Чип', 'Chip')}</p>
                  <p className="font-semibold text-theme">{payload.microchip_id || tr('скрыт владельцем', 'hidden by owner')}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted/70 px-3 py-2 text-sm text-theme sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-theme-muted">{tr('Аллергии (кратко)', 'Allergies (brief)')}</p>
                  <p className="font-semibold text-theme">{payload.allergies_summary || tr('не указано', 'not specified')}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted/70 px-3 py-2 text-sm text-theme sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-theme-muted">{tr('Контакт для связи', 'Contact')}</p>
                  <p className="font-semibold text-theme">{payload.emergency_contact_phone || tr('контакт скрыт', 'contact hidden')}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <a href="/lost-pets" className="btn-primary">{tr('Сообщить о находке', 'Report a finding')}</a>
                <button className="btn-secondary" type="button" onClick={() => window.history.back()}>
                  {tr('Назад', 'Back')}
                </button>
              </div>

              <p className="mt-4 rounded-xl border border-border bg-surface-muted/65 px-3 py-2 text-xs text-theme-muted">
                {payload.disclaimer}
              </p>
            </Card>
          </section>
          </>
        )}
      </section>
    </main>
  );
}
