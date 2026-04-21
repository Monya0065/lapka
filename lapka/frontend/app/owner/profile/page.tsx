'use client';

import { useCallback, useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { validateStoredSession } from '@/lib/auth';
import { apiRequest } from '@/lib/api';

interface NotificationPrefs {
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  appointment_reminders: boolean;
  document_alerts: boolean;
  marketing: boolean;
}

export default function OwnerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    email_enabled: true,
    push_enabled: true,
    sms_enabled: false,
    appointment_reminders: true,
    document_alerts: true,
    marketing: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const sessionUser = await validateStoredSession();
        if (cancelled) return;
        setUser(sessionUser || null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Не удалось загрузить профиль');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePrefChange = useCallback((key: keyof NotificationPrefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }, []);

  const handleSavePrefs = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      await apiRequest('/api/v1/users/me/preferences', {
        method: 'PATCH',
        body: {
          email: prefs.email_enabled,
          push: prefs.push_enabled,
          sms: prefs.sms_enabled,
          appointment_reminder: prefs.appointment_reminders,
          document_alerts: prefs.document_alerts,
          marketing: prefs.marketing,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Профиль</h1>
          <p className="page-subtitle">Настройки владельца и роль доступа.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : !user ? (
        <EmptyState title="Профиль недоступен" text="Выполните вход заново, чтобы открыть настройки." />
      ) : (
        <>
          <Card title="Аккаунт владельца" subtitle="Текущая сессия">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-lapka-200 bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-lapka-500">Email</p>
                <p className="mt-1 text-sm font-semibold text-lapka-800">{String(user.email || '—')}</p>
              </div>
              <div className="rounded-xl border border-lapka-200 bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-lapka-500">Роль</p>
                <p className="mt-1 text-sm font-semibold text-lapka-800">{String(user.role || 'owner')}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-lapka-600">
              Для изменения контактных данных в MVP используйте профиль администратора или seed-конфигурацию.
            </p>
          </Card>

          <Card title="Уведомления" subtitle="Каналы и типы оповещений" className="mt-4">
            <div className="space-y-4">
              <fieldset>
                <legend className="text-sm font-semibold text-lapka-700 mb-2">Каналы доставки</legend>
                <div className="space-y-2">
                  {[
                    { key: 'email_enabled', label: 'Email' },
                    { key: 'push_enabled', label: 'Push-уведомления' },
                    { key: 'sms_enabled', label: 'SMS' },
                  ].map((ch) => (
                    <label key={ch.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prefs[ch.key as keyof NotificationPrefs] as boolean}
                        onChange={() => handlePrefChange(ch.key as keyof NotificationPrefs)}
                        className="w-4 h-4 text-lapka-600 rounded"
                      />
                      <span className="text-sm text-lapka-700">{ch.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-semibold text-lapka-700 mb-2">Типы уведомлений</legend>
                <div className="space-y-2">
                  {[
                    { key: 'appointment_reminders', label: 'Напоминания о визитах' },
                    { key: 'document_alerts', label: 'Готовность документов' },
                    { key: 'marketing', label: 'Маркетинговые рассылки' },
                  ].map((ch) => (
                    <label key={ch.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prefs[ch.key as keyof NotificationPrefs] as boolean}
                        onChange={() => handlePrefChange(ch.key as keyof NotificationPrefs)}
                        className="w-4 h-4 text-lapka-600 rounded"
                      />
                      <span className="text-sm text-lapka-700">{ch.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="button"
                onClick={handleSavePrefs}
                disabled={saving}
                className="btn-primary mt-2"
              >
                {saving ? 'Сохранение...' : 'Сохранить настройки'}
              </button>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
