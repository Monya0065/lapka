'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/api';

interface VpnSubscription {
  user_id: string;
  status: string;
  plan_code: string;
  updated_at: string;
}

interface VpnWebhookEvent {
  provider: string;
  event_id: string;
  checkout_id: string;
  status: string;
  amount_rub: number;
  created_at: string;
}

export default function PlatformVpnPage() {
  const { t } = useTranslation();
  const [subscriptions, setSubscriptions] = useState<VpnSubscription[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<VpnWebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [pruning, setPruning] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [subsData, eventsData] = await Promise.all([
          apiRequest('/api/v1/vpn/platform/subscriptions').catch(() => []),
          apiRequest('/api/v1/vpn/platform/webhook-events').catch(() => []),
        ]);
        setSubscriptions(subsData);
        setWebhookEvents(eventsData);
      } catch (e) {
        console.error('Failed to load VPN platform data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const result = await apiRequest('/api/v1/vpn/platform/reconcile', { method: 'POST' });
      alert(t('vpn.reconciled', 'Сверено') + ': ' + result.updated_count);
      window.location.reload();
    } catch (e) {
      console.error('Failed to reconcile:', e);
    } finally {
      setReconciling(false);
    }
  };

  const handlePrune = async () => {
    if (!confirm(t('vpn.pruneConfirm', 'Удалить неактивные профили старше 90 дней?'))) return;
    setPruning(true);
    try {
      const result = await apiRequest('/api/v1/vpn/platform/maintenance/prune', { method: 'DELETE' });
      alert(t('vpn.pruned', 'Удалено') + ': ' + result.deleted_count);
      window.location.reload();
    } catch (e) {
      console.error('Failed to prune:', e);
    } finally {
      setPruning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lapka-500" />
      </div>
    );
  }

  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const pendingCount = subscriptions.filter(s => s.status === 'pending').length;
  const totalRevenue = webhookEvents
    .filter(e => e.status === 'captured')
    .reduce((sum, e) => sum + e.amount_rub, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-lapka-900">{t('vpn.platformTitle', 'VPN Платформа')}</h1>
        <p className="text-lapka-700 mt-2">
          {t('vpn.platformSubtitle', 'Управление VPN-сервисом и биллинг')}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="text-3xl font-bold text-green-700">{activeCount}</div>
          <div className="text-green-800">{t('vpn.activeSubscriptions', 'Активных подписок')}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="text-3xl font-bold text-yellow-700">{pendingCount}</div>
          <div className="text-yellow-800">{t('vpn.pendingSubscriptions', 'Ожидающих подписок')}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="text-3xl font-bold text-blue-700">{totalRevenue} ₽</div>
          <div className="text-blue-800">{t('vpn.totalRevenue', 'Всего получено')}</div>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <button
          onClick={handleReconcile}
          disabled={reconciling}
          className="btn-primary"
        >
          {reconciling ? '...' : t('vpn.reconcile', 'Сверка платежей')}
        </button>
        <button
          onClick={handlePrune}
          disabled={pruning}
          className="btn-secondary"
        >
          {pruning ? '...' : t('vpn.prune', 'Очистить старые профили')}
        </button>
      </div>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">{t('vpn.subscriptions', 'Подписки')}</h2>
        <div className="border rounded-xl overflow-hidden">
          {subscriptions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{t('vpn.noSubscriptions', 'Нет подписок')}</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">User ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('vpn.status', 'Статус')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('vpn.plan', 'Тариф')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('vpn.updated', 'Обновлено')}</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.user_id} className="border-t">
                    <td className="px-4 py-3 text-sm font-mono">{sub.user_id.slice(0, 8)}...</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-sm ${
                        sub.status === 'active' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          sub.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                        }`} />
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{sub.plan_code}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(sub.updated_at).toLocaleString('ru')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">{t('vpn.webhookEvents', 'События webhook')}</h2>
        <div className="border rounded-xl overflow-hidden">
          {webhookEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{t('vpn.noEvents', 'Нет событий')}</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('vpn.provider', 'Провайдер')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Event ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Checkout ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('vpn.status', 'Статус')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('vpn.amount', 'Сумма')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('vpn.created', 'Создано')}</th>
                </tr>
              </thead>
              <tbody>
                {webhookEvents.map((event) => (
                  <tr key={event.event_id} className="border-t">
                    <td className="px-4 py-3 text-sm">{event.provider}</td>
                    <td className="px-4 py-3 text-sm font-mono">{event.event_id.slice(0, 12)}...</td>
                    <td className="px-4 py-3 text-sm font-mono">{event.checkout_id.slice(0, 12)}...</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${
                        event.status === 'captured' ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{event.amount_rub} ₽</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(event.created_at).toLocaleString('ru')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}