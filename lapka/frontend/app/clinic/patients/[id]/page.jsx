'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import Table from '@/components/ui/Table';
import { apiRequest } from '@/lib/api';
import { useClinicScope } from '@/lib/clinic-scope';
import { localizePetBreed, localizePetSpecies, resolvePetPhoto } from '@/lib/pets';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

export default function ClinicPatientDetailPage() {
  const params = useParams();
  const patientId = useMemo(() => String(params?.id || ''), [params]);
  const { clinicId } = useClinicScope();

  const [pet, setPet] = useState(null);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  const loadPatient = useCallback(async () => {
    if (!patientId || !clinicId) return;
    setLoading(true);
    setError('');
    setAccessDenied(false);
    try {
      const [petPayload, visitsPayload, docsPayload] = await Promise.all([
        apiRequest(`/api/v1/pets/${patientId}`),
        apiRequest(`/api/v1/visits?clinic_id=${encodeURIComponent(clinicId)}&pet_id=${encodeURIComponent(patientId)}&limit=50`),
        apiRequest(`/api/v1/documents?clinic_id=${encodeURIComponent(clinicId)}&pet_id=${encodeURIComponent(patientId)}`),
      ]);
      setPet(petPayload || null);
      setVisits(Array.isArray(visitsPayload) ? visitsPayload : []);
      setDocuments(Array.isArray(docsPayload) ? docsPayload : []);
    } catch (requestError) {
      setAccessDenied(requestError.status === 403);
      setError(requestError.message || 'Не удалось загрузить карточку пациента');
      setPet(null);
      setVisits([]);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId, patientId]);

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  const species = localizePetSpecies(pet?.species, 'ru');
  const breed = localizePetBreed(pet?.breed, 'ru');
  const petPhoto = resolvePetPhoto(pet);

  const visitRows = visits.map((visit) => [
    formatDateTime(visit.created_at),
    visit.chief_complaint || '—',
    visit.finalized_flag ? 'Завершён' : 'В работе',
    visit.owner_summary || visit.exam_findings || '—',
  ]);

  const documentRows = documents.map((doc) => [
    doc.document_type || 'Документ',
    formatDateTime(doc.created_at),
    doc.file_name || doc.title || 'Без названия',
  ]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Карточка пациента в реестре клиники</h1>
          <p className="page-subtitle">Администратор видит безопасный профиль питомца, историю визитов и документы в пределах выданного уровня доступа.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/clinic/patients" className="btn-secondary">
            К поиску пациентов
          </Link>
          <Link href="/clinic/checkin" className="btn-primary">
            Ресепшн
          </Link>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadPatient} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </section>
      ) : accessDenied ? (
        <EmptyState
          title="Доступ к карте не выдан"
          text="Администратор видит только безопасный минимум. Полная карточка появится после подтверждения владельцем."
        />
      ) : !pet ? (
        <EmptyState title="Пациент не найден" text="Проверьте ссылку или вернитесь к поиску пациентов." />
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Пациент клиники"
            title={`${pet.name || 'Питомец'}: спокойная карточка для ресепшн и администрирования`}
            description="Карточка помогает ресепшн и администраторам быстро сориентироваться: кто пациент, какие документы уже есть и когда был последний визит — без изменения медицинских записей."
            imageSrc={petPhoto}
            imageAlt={pet.name || 'Пациент'}
            badges={[
              species || 'Питомец',
              breed || 'Порода',
              pet.lapka_id || 'Lapka ID',
            ]}
            compact
          />

          <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
            <Card title={pet.name || 'Питомец'} subtitle={`${species} · ${breed}`} tone="tinted">
              <div className="space-y-4 text-base text-lapka-700">
                <PetVisualGallery
                  pet={pet}
                  language="ru"
                  title="Фото пациента"
                  subtitle="Основное фото из карты, породный JPG и 3D-визуал доступны в одной карточке."
                  compact
                  className="border-0 bg-transparent p-0 shadow-none"
                />
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-4 py-3">
                  <p><span className="font-semibold text-lapka-900">Lapka ID:</span> {pet.lapka_id || '—'}</p>
                  <p><span className="font-semibold text-lapka-900">Чип:</span> {pet.chip_id || '—'}</p>
                  <p><span className="font-semibold text-lapka-900">Паспорт:</span> {pet.passport_id || '—'}</p>
                  <p><span className="font-semibold text-lapka-900">Вид:</span> {species || '—'}</p>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <Card title="История визитов" subtitle="Лента завершённых и активных приёмов без редактирования">
                {visitRows.length ? (
                  <Table columns={['Дата', 'Жалоба', 'Статус', 'Сводка']} rows={visitRows} />
                ) : (
                  <EmptyState title="Визитов пока нет" text="История появится после первого приёма в клинике." />
                )}
              </Card>

              <Card title="Документы" subtitle="Анализы, изображения и архив файлов по пациенту">
                {documentRows.length ? (
                  <Table columns={['Тип', 'Дата', 'Файл']} rows={documentRows} />
                ) : (
                  <EmptyState title="Документов пока нет" text="Как только владелец или врач загрузят файл, он появится здесь." />
                )}
              </Card>

              <Card title="Следующие действия" subtitle="Сценарии для ресепшн и административной команды" tone="mint">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link href="/clinic/checkin" className="showcase-panel p-4 transition hover:-translate-y-0.5">
                    <p className="text-base font-black text-lapka-900">Ресепшн и регистрация</p>
                    <p className="mt-2 text-sm leading-7 text-lapka-600">Найти запись, подтвердить прибытие и подготовить маршрут пациента.</p>
                  </Link>
                  <Link href="/clinic/schedule" className="showcase-panel p-4 transition hover:-translate-y-0.5">
                    <p className="text-base font-black text-lapka-900">Расписание клиники</p>
                    <p className="mt-2 text-sm leading-7 text-lapka-600">Проверить слот врача, перенос записи и загрузку дня.</p>
                  </Link>
                </div>
              </Card>
            </div>
          </section>
        </>
      )}
    </>
  );
}
