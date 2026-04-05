'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import { loadOwnerBaseData } from '@/lib/owner-data';
import { localizePetSpecies } from '@/lib/pets';

export default function OwnerPassportCenterPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const passports = useMemo(() => pets || [], [pets]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = await loadOwnerBaseData();
      setPets(base.pets);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить центр паспортов');
      setPets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  return (
    <div className="space-y-7">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Паспортный центр</p>
          <h1 className="page-title">Паспорт, чип и важные данные питомца</h1>
          <p className="page-subtitle">Единый центр профиля питомца: имя, вид, пол, возраст, вес, чип, паспорт, экстренные контакты и быстрый доступ к QR-паспорту.</p>
        </div>
      </header>
      {error ? <ErrorBanner message={error} onRetry={loadPage} /> : null}
      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </section>
      ) : !passports.length ? (
        <EmptyState title="Паспортов пока нет" text="Добавьте питомца, чтобы открыть его паспортный центр." />
      ) : (
        <section className="grid gap-4 2xl:grid-cols-2">
          {passports.map((item) => (
            <Card key={item.id} className="overflow-hidden p-0">
              <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                <div className="border-r border-lapka-200 bg-[radial-gradient(circle_at_20%_18%,rgba(96,170,255,0.18),transparent_38%),linear-gradient(180deg,#f8fbff_0%,#edf7ff_100%)] p-4">
                  <PetVisualGallery
                    pet={item}
                    language="ru"
                    title="Визуальный паспорт"
                    subtitle="Фото из карты, породный ориентир и 3D-визуал доступны в одном центре."
                    compact
                    imageClassName="object-cover"
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-2xl font-black text-lapka-900">{item.name}</h3>
                  <p className="mt-1 text-base text-lapka-600">{localizePetSpecies(item.species, 'ru')} · {item.weight_kg ? `${item.weight_kg} кг` : 'вес не указан'}</p>
                  <div className="mt-4 grid gap-2 text-sm text-lapka-700 sm:grid-cols-2">
                    <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">Чип: {item.chip_id || 'не указан'}</div>
                    <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">Паспорт: {item.passport_id || 'не указан'}</div>
                    <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">Lapka ID: {item.lapka_id || item.id}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/owner/pet/${item.id}/passport`} className="btn-primary">QR-паспорт</Link>
                    <Link href={`/owner/pet/${item.id}`} className="btn-secondary">Карточка питомца</Link>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
