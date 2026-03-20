'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import TopNavigation from '@/components/ui/TopNavigation';
import AuthDropdown from '@/components/auth/AuthDropdown';
import RoleGate from '@/components/auth/RoleGate';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import EmptyState from '@/components/ui/EmptyState';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';

function emergencyBadge(level) {
  const value = String(level || '').toUpperCase();
  if (value === 'RED') return <Badge tone="danger">RED</Badge>;
  if (value === 'YELLOW') return <Badge tone="warning">YELLOW</Badge>;
  return <Badge tone="success">GREEN</Badge>;
}

function localizeCategory(value, lang) {
  const map = {
    dermatology: { ru: 'Дерматология', en: 'Dermatology' },
    gastroenterology: { ru: 'Гастроэнтерология', en: 'Gastroenterology' },
    neurology: { ru: 'Неврология', en: 'Neurology' },
    cardiology: { ru: 'Кардиология', en: 'Cardiology' },
    infectious: { ru: 'Инфекционные', en: 'Infectious' },
    trauma: { ru: 'Травмы', en: 'Trauma' },
    toxicology: { ru: 'Токсикология', en: 'Toxicology' },
    respiratory: { ru: 'Респираторные', en: 'Respiratory' },
    urinary: { ru: 'Мочевыделительная система', en: 'Urinary' },
    endocrine: { ru: 'Эндокринология', en: 'Endocrine' },
    ophthalmology: { ru: 'Офтальмология', en: 'Ophthalmology' },
  };
  const normalized = String(value || '').toLowerCase();
  return map[normalized]?.[lang] || value || '—';
}

function localizeSpecies(items, lang) {
  const map = {
    cat: { ru: 'Кошки', en: 'Cats' },
    dog: { ru: 'Собаки', en: 'Dogs' },
    rabbit: { ru: 'Кролики', en: 'Rabbits' },
    ferret: { ru: 'Хорьки', en: 'Ferrets' },
    bird: { ru: 'Птицы', en: 'Birds' },
  };
  return (Array.isArray(items) ? items : [])
    .map((item) => map[String(item || '').toLowerCase()]?.[lang] || item)
    .filter(Boolean);
}

function localizePrevalence(value, lang) {
  const map = {
    common: { ru: 'часто', en: 'common' },
    uncommon: { ru: 'нечасто', en: 'uncommon' },
    rare: { ru: 'редко', en: 'rare' },
  };
  return map[String(value || '').toLowerCase()]?.[lang] || '—';
}

function diseaseIllustration(category) {
  const normalized = String(category || '').toLowerCase();
  if (normalized === 'trauma') return '/assets/img/inpatient.svg';
  if (normalized === 'cardiology') return '/assets/img/vet-doctor.svg';
  if (normalized === 'infectious' || normalized === 'respiratory') return '/assets/img/ai-assistant.svg';
  return '/assets/img/clinic-ops.svg';
}

export default function DiseaseDetailsPage({ params }) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'ru';

  const copy = useMemo(() => (
    lang === 'en'
      ? {
          topLinks: [
            { href: '/', labelKey: 'nav.home' },
            { href: '/owner/dashboard', labelKey: 'roles.owner' },
            { href: '/vet/dashboard', labelKey: 'roles.vet' },
            { href: '/clinic/dashboard', labelKey: 'roles.clinicAdmin' },
            { href: '/diseases', labelKey: 'nav.diseases' },
            { href: '/security', labelKey: 'nav.security' },
          ],
          pageTitle: 'Disease Card',
          pageSubtitle: 'Reference information for the team. No treatment guidance for owners.',
          back: '← Back to disease library',
          navTitle: 'Navigation',
          navSubtitle: 'Related sections of the medical library',
          sectionReference: 'Disease library',
          sectionProtocols: 'Protocols',
          sectionCalculators: 'Calculators',
          hintTitle: 'How to use',
          hintSubtitle: 'Reference only',
          hintItems: [
            'Use together with protocols and symptom library',
            'Emergency level reflects urgency, not a diagnosis',
            'Treatment decisions remain with the veterinarian',
          ],
          loadError: 'Failed to load disease card',
          notFoundTitle: 'Disease not found',
          notFoundText: 'Check the identifier or return to the library.',
          species: 'Species',
          category: 'Category',
          prevalence: 'Prevalence',
          emergency: 'Emergency level',
          description: 'Description',
          symptoms: 'Typical symptoms',
          noSymptoms: 'No symptoms listed',
          openTriage: 'Open urgency view',
          openLibrary: 'Back to list',
        }
      : {
          topLinks: [
            { href: '/', labelKey: 'nav.home' },
            { href: '/owner/dashboard', labelKey: 'roles.owner' },
            { href: '/vet/dashboard', labelKey: 'roles.vet' },
            { href: '/clinic/dashboard', labelKey: 'roles.clinicAdmin' },
            { href: '/diseases', labelKey: 'nav.diseases' },
            { href: '/security', labelKey: 'nav.security' },
          ],
          pageTitle: 'Карточка заболевания',
          pageSubtitle: 'Справочная информация для команды. Без схем лечения для владельца.',
          back: '← Назад к справочнику заболеваний',
          navTitle: 'Навигация',
          navSubtitle: 'Связанные разделы медицинского контура',
          sectionReference: 'Справочник заболеваний',
          sectionProtocols: 'Протоколы',
          sectionCalculators: 'Калькуляторы',
          hintTitle: 'Как использовать',
          hintSubtitle: 'Только справочный режим',
          hintItems: [
            'Используйте вместе с протоколами и библиотекой симптомов',
            'Уровень срочности показывает приоритет, а не диагноз',
            'Клиническое решение принимает ветеринарный врач',
          ],
          loadError: 'Не удалось загрузить карточку заболевания',
          notFoundTitle: 'Заболевание не найдено',
          notFoundText: 'Проверьте идентификатор или вернитесь к списку.',
          species: 'Виды животных',
          category: 'Категория',
          prevalence: 'Распространённость',
          emergency: 'Уровень срочности',
          description: 'Описание',
          symptoms: 'Типичные симптомы',
          noSymptoms: 'Симптомы не указаны',
          openTriage: 'Открыть оценку срочности',
          openLibrary: 'Вернуться к списку',
        }
  ), [lang]);

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest(`/api/v1/diseases/${params.id}`);
      setItem(payload || null);
    } catch (requestError) {
      setError(requestError.message || copy.loadError);
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [params.id, copy.loadError]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const species = useMemo(() => localizeSpecies(item?.species, lang), [item?.species, lang]);
  const category = localizeCategory(item?.category, lang);
  const prevalence = localizePrevalence(item?.prevalence, lang);

  return (
    <RoleGate allowedRoles={['owner', 'vet', 'clinic_admin']}>
      <>
        <TopNavigation links={copy.topLinks} actions={<AuthDropdown mode="menu" />} />
        <main className="page-wrap space-y-4 py-6">
          <header className="page-header">
            <div className="space-y-3">
              <Link href="/diseases" className="btn-secondary inline-flex !px-4 !py-2">
                {copy.back}
              </Link>
              <div>
                <h1 className="page-title">{copy.pageTitle}</h1>
                <p className="page-subtitle">{copy.pageSubtitle}</p>
              </div>
            </div>
          </header>

          {error ? <ErrorBanner message={error} onRetry={loadItem} /> : null}

          <section className="grid gap-4 2xl:grid-cols-[248px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-[96px] xl:self-start">
              <Card title={copy.navTitle} subtitle={copy.navSubtitle}>
                <div className="grid gap-2">
                  <Link href="/diseases" className="sidebar-link">{copy.sectionReference}</Link>
                  <Link href="/clinical/protocols" className="sidebar-link">{copy.sectionProtocols}</Link>
                  <Link href="/tools/calculators" className="sidebar-link">{copy.sectionCalculators}</Link>
                </div>
              </Card>
              <Card title={copy.hintTitle} subtitle={copy.hintSubtitle}>
                <ul className="space-y-2 text-sm text-lapka-700">
                  {copy.hintItems.map((entry) => (
                    <li key={entry}>• {entry}</li>
                  ))}
                </ul>
              </Card>
            </aside>

            <div className="space-y-4">
              {loading ? (
                <>
                  <Skeleton className="h-[320px] w-full rounded-[32px]" />
                  <div className="grid gap-4 2xl:grid-cols-2">
                    <Skeleton className="h-64 w-full rounded-[28px]" />
                    <Skeleton className="h-64 w-full rounded-[28px]" />
                  </div>
                </>
              ) : !item ? (
                <Card>
                  <EmptyState title={copy.notFoundTitle} text={copy.notFoundText} />
                </Card>
              ) : (
                <>
                  <ShowcasePanel
                    eyebrow={category}
                    title={item.name}
                    description={item.description || '—'}
                    imageSrc={diseaseIllustration(item.category)}
                    imageAlt={item.name}
                    badges={[
                      `${copy.species}: ${species.join(', ') || '—'}`,
                      `${copy.prevalence}: ${prevalence}`,
                      `${copy.emergency}: ${String(item.emergency_level || 'GREEN').toUpperCase()}`,
                    ]}
                    compact
                  />

                  <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                    <Card title={copy.description} subtitle={`${copy.category}: ${category}`}>
                      <div className="space-y-4 text-[1.05rem] leading-8 text-lapka-700">
                        <div className="flex flex-wrap items-center gap-2">
                          {emergencyBadge(item.emergency_level)}
                          <span className="pill">{copy.prevalence}: {prevalence}</span>
                          <span className="pill">ID: {item.id}</span>
                        </div>
                        <p>{item.description || '—'}</p>
                      </div>
                    </Card>

                    <Card title={copy.symptoms} subtitle={`${item.symptoms?.length || 0}`}>
                      {(item.symptoms || []).length ? (
                        <div className="flex flex-wrap gap-2">
                          {item.symptoms.map((symptom) => (
                            <span key={symptom} className="rounded-full border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm font-semibold text-lapka-700">
                              {symptom}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-base text-lapka-600">{copy.noSymptoms}</p>
                      )}

                      <div className="mt-5 flex flex-wrap gap-3">
                        <Link href="/owner/triage" className="btn-secondary">
                          {copy.openTriage}
                        </Link>
                        <Link href="/diseases" className="btn-primary">
                          {copy.openLibrary}
                        </Link>
                      </div>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </section>
        </main>
      </>
    </RoleGate>
  );
}
