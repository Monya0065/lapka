'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import { apiRequest } from '@/lib/api';
import { resolvePetPhoto } from '@/lib/pets';

export default function OwnerPetPassportPage() {
  const params = useParams();
  const petId = useMemo(() => params?.id || '', [params]);

  const [pet, setPet] = useState(null);
  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [phone, setPhone] = useState('');
  const [allergiesSummary, setAllergiesSummary] = useState('');
  const [allowUnmasked, setAllowUnmasked] = useState(false);
  const [includeMicrochip, setIncludeMicrochip] = useState(true);

  const loadData = useCallback(async () => {
    if (!petId) return;
    setLoading(true);
    setError('');
    try {
      const [petPayload, passportPayload] = await Promise.all([
        apiRequest(`/api/v1/pets/${petId}`),
        apiRequest(`/api/v1/owner/pets/${petId}/passport`),
      ]);
      setPet(petPayload || null);
      const nextPassport = passportPayload?.passport || null;
      setPassport(nextPassport);
      setPhone(nextPassport?.emergency_contact_phone || '');
      setAllergiesSummary(nextPassport?.allergies_summary || '');
      setAllowUnmasked(Boolean(nextPassport?.allow_unmasked_phone));
      setIncludeMicrochip(nextPassport?.include_microchip ?? true);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить QR-паспорт питомца');
      setPet(null);
      setPassport(null);
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const publicPageUrl = useMemo(() => {
    if (!passport?.token || typeof window === 'undefined') return '';
    return `${window.location.origin}/pet-passport/${passport.token}`;
  }, [passport]);

  const qrUrl = useMemo(() => {
    if (!publicPageUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(publicPageUrl)}`;
  }, [publicPageUrl]);

  async function onGenerate(event) {
    event.preventDefault();
    if (!petId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest(`/api/v1/owner/pets/${petId}/passport/generate`, {
        method: 'POST',
        body: {
          emergency_contact_phone: phone.trim() || null,
          allow_unmasked_phone: allowUnmasked,
          allergies_summary: allergiesSummary.trim() || null,
          include_microchip: includeMicrochip,
        },
      });
      setPassport(payload?.passport || null);
      setSuccess('Паспорт обновлён. Ссылка и QR готовы для печати или отправки.');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось сгенерировать паспорт');
    } finally {
      setSaving(false);
    }
  }

  async function onRevoke() {
    if (!petId || !passport) return;
    setConfirmRevokeOpen(false);
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/owner/pets/${petId}/passport/revoke`, { method: 'POST' });
      setSuccess('Публичный QR-паспорт отозван мгновенно. Старая ссылка больше неактивна.');
      setPassport((prev) => (prev ? { ...prev, revoked_at: new Date().toISOString() } : prev));
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отозвать паспорт');
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!publicPageUrl) return;
    try {
      await navigator.clipboard.writeText(publicPageUrl);
      setSuccess('Ссылка скопирована в буфер обмена.');
    } catch {
      setError('Не удалось скопировать ссылку. Скопируйте вручную из поля ниже.');
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">QR-паспорт питомца</h1>
          <p className="page-subtitle">Публичная карточка только с безопасными данными для поиска питомца.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
      ) : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-72 w-full" />
        </section>
      ) : !pet ? (
        <EmptyState title="Питомец не найден" text="Вернитесь к списку питомцев и проверьте карточку." />
      ) : (
        <section className="space-y-4">
          <ShowcasePanel
            eyebrow="Публичный паспорт"
            title={`${pet.name}: QR-паспорт для поиска и быстрой связи`}
            description="Паспорт показывает только безопасные данные: имя питомца, фото, окрас, контакт для связи и краткую информацию, которую владелец решил открыть публично."
            imageSrc={resolvePetPhoto(pet)}
            imageAlt="QR-паспорт питомца"
            badges={[
              passport && !passport.revoked_at ? 'Ссылка активна' : 'Ссылка неактивна',
              allowUnmasked ? 'Телефон открыт' : 'Телефон скрыт',
              includeMicrochip ? 'Чип показан' : 'Чип скрыт',
            ]}
            compact
          />

          <section className="grid-soft-2">
          <Card title="Настройки публичного паспорта" subtitle="Управление генерацией, отзывом и уровнем приватности">
            <div className="mb-4">
              <PetVisualGallery
                pet={pet}
                language="ru"
                title="Визуальный паспорт"
                subtitle="Фото владельца, породный ориентир и 3D-визуал для печатной и публичной карточки."
                compact
                imageClassName="object-contain p-3"
              />
            </div>

            <form className="space-y-3" onSubmit={onGenerate}>
              <label className="block">
                <span className="label">Контактный телефон для связи</span>
                <input
                  className="input"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+7..."
                />
              </label>

              <label className="block">
                <span className="label">Кратко об аллергиях (опционально)</span>
                <textarea
                  className="input min-h-[96px] resize-y"
                  value={allergiesSummary}
                  onChange={(event) => setAllergiesSummary(event.target.value)}
                  placeholder="Например: чувствительность к курице"
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-medium text-lapka-700">
                <input
                  type="checkbox"
                  checked={allowUnmasked}
                  onChange={(event) => setAllowUnmasked(event.target.checked)}
                />
                Показывать телефон без маски в публичной карточке
              </label>

              <label className="flex items-center gap-2 text-sm font-medium text-lapka-700">
                <input
                  type="checkbox"
                  checked={includeMicrochip}
                  onChange={(event) => setIncludeMicrochip(event.target.checked)}
                />
                Показывать чип в паспорте
              </label>

              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" type="submit" disabled={saving}>
                  {passport ? 'Обновить паспорт' : 'Сгенерировать паспорт'}
                </button>
                <button className="btn-secondary" type="button" onClick={() => window.print()}>
                  Скачать бирку для печати
                </button>
                <button className="btn-secondary" type="button" onClick={copyLink} disabled={!publicPageUrl}>
                  Поделиться ссылкой
                </button>
                <button className="btn-secondary" type="button" onClick={() => setConfirmRevokeOpen(true)} disabled={!passport || saving}>
                  Отозвать
                </button>
              </div>
            </form>
          </Card>

          <Card title="Предпросмотр QR" subtitle="Публичный профиль не содержит медкарту и диагнозы">
            {passport ? (
              <>
                <div className="rounded-2xl border border-lapka-200 bg-white p-4 text-center">
                  {qrUrl ? (
                    <AppImage
                      src={qrUrl}
                      alt="QR-паспорт"
                      width={480}
                      height={480}
                      sizes="240px"
                      className="mx-auto h-60 w-60 rounded-2xl border border-lapka-200 bg-white p-2"
                    />
                  ) : (
                    <div className="mx-auto h-60 w-60 rounded-2xl border border-dashed border-lapka-300" />
                  )}
                  <p className="mt-3 text-xs text-lapka-600">Токен: {passport.token}</p>
                </div>
                <label className="mt-3 block">
                  <span className="label">Публичная ссылка</span>
                  <input className="input" value={publicPageUrl} readOnly />
                </label>
                {passport.revoked_at ? (
                  <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    Паспорт отозван {new Date(passport.revoked_at).toLocaleString('ru-RU')}
                  </p>
                ) : null}
              </>
            ) : (
              <EmptyState title="Паспорт ещё не создан" text="Сгенерируйте паспорт, чтобы получить QR и публичную ссылку." />
            )}
          </Card>
          </section>
        </section>
      )}
      <ConfirmDialog
        open={confirmRevokeOpen}
        title="Отозвать QR-паспорт?"
        message="Текущая публичная ссылка перестанет работать сразу после подтверждения."
        confirmLabel="Да, отозвать"
        cancelLabel="Нет"
        danger
        loading={saving}
        onCancel={() => setConfirmRevokeOpen(false)}
        onConfirm={onRevoke}
      />
    </>
  );
}
