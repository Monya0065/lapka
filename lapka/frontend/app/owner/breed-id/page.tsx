'use client';

import { useEffect, useMemo, useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import StatsCard from '@/components/ui/StatsCard';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiRequest } from '@/lib/api';
import { analyzeBreedStub } from '@/lib/owner-experience';

export default function OwnerBreedIdPage() {
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPets() {
      setLoading(true);
      setError('');
      try {
        const payload = await apiRequest('/api/v1/pets');
        const rows = Array.isArray(payload) ? payload : [];
        setPets(rows);
        setSelectedPetId(rows[0]?.id || '');
      } catch (requestError) {
        setError(requestError.message || 'Не удалось загрузить питомцев');
        setPets([]);
      } finally {
        setLoading(false);
      }
    }
    loadPets();
  }, []);

  const selectedPet = useMemo(() => pets.find((pet) => pet.id === selectedPetId) || null, [pets, selectedPetId]);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
  }

  function runRecognition() {
    if (!fileName) {
      setError('Сначала загрузите фотографию питомца.');
      return;
    }
    setError('');
    setResult(analyzeBreedStub(fileName));
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Определение породы по фото</h1>
          <p className="page-subtitle">
            Вторичный инструмент профиля питомца: загрузите фото, получите вероятный тип породы и сохраните результат как заметку для дальнейшей проверки.
          </p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <Card className="min-h-[320px]" />
          <Card className="min-h-[320px]" />
        </div>
      ) : (
        <>
          <section className="kpi-grid">
            <StatsCard label="Питомцы в кабинете" value={String(pets.length)} />
            <StatsCard label="Активный профиль" value={selectedPet?.name || '—'} />
            <StatsCard label="Режим" value="Демо-модель" />
            <StatsCard label="Результат" value={result ? `${result.confidence}%` : 'ожидается'} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <Card title="Загрузка фотографии" subtitle="Сценарий готов для дальнейшего подключения реальной модели">
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Питомец</span>
                  <select className="input" value={selectedPetId} onChange={(event) => setSelectedPetId(event.target.value)}>
                    {pets.map((pet) => (
                      <option key={pet.id} value={pet.id}>
                        {pet.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Фото</span>
                  <input className="input" type="file" accept="image/*" onChange={handleFileChange} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" type="button" onClick={runRecognition}>Запустить распознавание</button>
                  <span className="pill">Результат демонстрационный и не заменяет экспертную оценку</span>
                </div>
                {previewUrl ? (
                  <AppImage
                    src={previewUrl}
                    alt="Предпросмотр"
                    width={960}
                    height={720}
                    sizes="(max-width: 768px) 100vw, 520px"
                    className="h-72 w-full rounded-3xl border border-lapka-200 object-cover"
                  />
                ) : (
                  <EmptyState title="Фото ещё не загружено" text="Выберите изображение питомца, чтобы увидеть демо-анализ." />
                )}
              </div>
            </Card>

            <Card title="Результат" subtitle="Вероятная порода и комментарий системы">
              {result ? (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-lapka-200 bg-white p-5">
                    <p className="text-xs uppercase tracking-wide text-lapka-500">Вероятный результат</p>
                    <p className="mt-2 text-3xl font-black text-lapka-900">{result.breed}</p>
                    <p className="mt-1 text-sm text-lapka-600">{result.species} · уверенность {result.confidence}%</p>
                  </div>
                  <div className="rounded-2xl border border-lapka-200 bg-lapka-50 p-4">
                    <p className="text-sm text-lapka-700">{result.note}</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
                    Следующий шаг: подтвердить породу и особенности внешности в профиле питомца, если это важно для ухода или истории наблюдения.
                  </div>
                </div>
              ) : (
                <EmptyState title="Результат ещё не рассчитан" text="Загрузите фото и запустите демо-распознавание." />
              )}
            </Card>
          </section>
        </>
      )}
    </>
  );
}
