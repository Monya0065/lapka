'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import { apiRequest } from '@/lib/api';

export default function PublicPetPassportPage() {
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
      setError(requestError.message || 'Паспорт не найден или отозван');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <main className="page-wrap py-6">
      <section className="mx-auto max-w-4xl space-y-4">
        <header className="page-header">
          <div>
            <h1 className="page-title">Публичный паспорт питомца</h1>
            <p className="page-subtitle">Если вы нашли питомца, используйте кнопку связи с владельцем.</p>
          </div>
        </header>

        {error ? <ErrorBanner message={error} onRetry={loadProfile} /> : null}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !payload ? (
          <EmptyState title="Паспорт недоступен" text="Ссылка могла истечь или быть отозвана владельцем." />
        ) : (
          <section className="grid gap-4 md:grid-cols-[340px_minmax(0,1fr)]">
            <PetVisualGallery
              pet={{
                name: payload.pet_name,
                photo_url: payload.photo,
                species: payload.species,
                breed: payload.breed,
                chip_id: payload.microchip_id,
              }}
              language="ru"
              title="Фото и ориентиры"
              subtitle="Публичный паспорт показывает фото питомца, породный ориентир и 3D-визуал без доступа к медкарте."
              compact
            />

            <Card title="Карточка для поиска" subtitle="Безопасные поля без доступа к медкарте">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700">
                  <p className="text-xs uppercase tracking-wide text-lapka-500">Окрас</p>
                  <p className="font-semibold text-lapka-900">{payload.color || '—'}</p>
                </div>
                <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700">
                  <p className="text-xs uppercase tracking-wide text-lapka-500">Чип</p>
                  <p className="font-semibold text-lapka-900">{payload.microchip_id || 'скрыт владельцем'}</p>
                </div>
                <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700 sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-lapka-500">Аллергии (кратко)</p>
                  <p className="font-semibold text-lapka-900">{payload.allergies_summary || 'не указано'}</p>
                </div>
                <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700 sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-lapka-500">Контакт для связи</p>
                  <p className="font-semibold text-lapka-900">{payload.emergency_contact_phone || 'контакт скрыт'}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <a href="/lost-pets" className="btn-primary">Сообщить о находке</a>
                <button className="btn-secondary" type="button" onClick={() => window.history.back()}>
                  Назад
                </button>
              </div>

              <p className="mt-4 rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-xs text-lapka-600">
                {payload.disclaimer}
              </p>
            </Card>
          </section>
        )}
      </section>
    </main>
  );
}
