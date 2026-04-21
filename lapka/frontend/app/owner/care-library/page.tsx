'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';

const FALLBACK_TOPICS = [
  {
    id: 'offline',
    title_ru: 'Нет связи с сервером',
    title_en: 'Offline',
    summary_ru: 'Откройте страницу позже — материалы подгружаются из клиники Lapka.',
    summary_en: 'Try again later — content is loaded from Lapka.',
    bullets_ru: ['Проверьте интернет.', 'Раздел «Симптомы · SOS» доступен для срочной ориентации.'],
    bullets_en: ['Check your connection.', 'Use Symptoms · SOS for urgent orientation.'],
  },
];

function pickTopicFields(topic, locale) {
  if (locale === 'en') {
    return {
      title: topic.title_en || topic.title_ru,
      summary: topic.summary_en || topic.summary_ru,
      bullets: topic.bullets_en?.length ? topic.bullets_en : topic.bullets_ru || [],
    };
  }
  return {
    title: topic.title_ru,
    summary: topic.summary_ru,
    bullets: topic.bullets_ru || [],
  };
}

export default function OwnerCareLibraryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topics, setTopics] = useState([]);
  const [locale, setLocale] = useState('ru');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/api/v1/public/care-guides', { auth: false, cacheTtlMs: 300_000 });
      if (Array.isArray(data) && data.length) {
        setTopics(data);
      } else {
        setTopics(FALLBACK_TOPICS);
      }
    } catch (e) {
      setError(e.message || 'Не удалось загрузить памятки');
      setTopics(FALLBACK_TOPICS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalBullets = useMemo(
    () =>
      topics.reduce((acc, topic) => acc + (pickTopicFields(topic, locale).bullets?.length || 0), 0),
    [topics, locale]
  );

  const headerCopy = useMemo(() => {
    if (locale === 'en') {
      return {
        kicker: 'Care library',
        title: 'Owner quick guides',
        subtitle:
          'Short orientation before and after visits — no dosages or prescriptions; your veterinarian decides treatment.',
        footer:
          'This information is general and does not replace an exam. If your pet worsens, contact your clinic or use Symptoms · SOS.',
      };
    }
    return {
      kicker: 'Библиотека заботы',
      title: 'Памятки для владельцев',
      subtitle:
        'Короткие ориентиры до и после визита, без дозировок и назначений — всё индивидуально решает ваш ветеринар.',
      footer:
        'Информация носит общий характер и не заменяет очный осмотр. При ухудшении состояния обращайтесь в клинику или используйте раздел «Симптомы · SOS».',
    };
  }, [locale]);

  return (
    <div className="space-y-7">
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-400/12 via-surface-muted to-teal-400/12 p-5 shadow-card md:p-8 dark:from-emerald-500/10 dark:to-teal-500/10">
        <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">
              {loading ? 'Загрузка памяток…' : headerCopy.kicker}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">{headerCopy.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">{headerCopy.subtitle}</p>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            <div className="flex w-full shrink-0 justify-end gap-1 rounded-xl border border-border bg-surface-muted/80 p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setLocale('ru')}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  locale === 'ru' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                RU
              </button>
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  locale === 'en' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                EN
              </button>
            </div>
            {loading ? (
              <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: locale === 'en' ? 'Topics' : 'Тем', value: topics.length, tone: '' },
                  { label: locale === 'en' ? 'Language' : 'Язык', value: locale.toUpperCase(), tone: 'text-violet-700 dark:text-violet-300' },
                  { label: locale === 'en' ? 'Bullets' : 'Пунктов', value: totalBullets, tone: 'text-sky-700 dark:text-sky-300' },
                  { label: locale === 'en' ? 'Source' : 'Статус', value: error ? 'Fallback' : 'API', tone: error ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300' },
                  { label: locale === 'en' ? 'Cards' : 'Карточек', value: topics.length, tone: 'text-rose-700 dark:text-rose-300' },
                  {
                    label: locale === 'en' ? 'Avg bullets' : 'Ср. пунктов',
                    value: topics.length ? Math.round(totalBullets / topics.length) : 0,
                    tone: 'text-amber-700 dark:text-amber-300',
                  },
                ].map((cell) => (
                  <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                    <p className={`mt-1 text-2xl font-black tabular-nums sm:text-3xl ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {topics.map((topic) => {
            const fields = pickTopicFields(topic, locale);
            return (
              <Card key={topic.id} className="space-y-3 p-5">
                <h2 className="text-lg font-semibold text-theme">{fields.title}</h2>
                <p className="text-sm text-theme-muted">{fields.summary}</p>
                <ul className="list-disc space-y-2 pl-5 text-sm text-theme">
                  {fields.bullets.map((line, idx) => (
                    <li key={`${topic.id}-${idx}`}>{line}</li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-theme-muted">{headerCopy.footer}</p>
    </div>
  );
}
