'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { getStoredSession } from '@/lib/auth';

interface VpnPlan {
  code: string;
  name: string;
  price_rub: number;
  device_limit: number;
  features: string[];
}

interface VpnSubscription {
  user_id: string;
  status: string;
  plan_code: string;
  updated_at: string;
}

interface VpnProfile {
  id: string;
  device_name: string;
  wireguard_config: string | null;
  created_at: string;
  is_active: boolean;
}

export default function OwnerVpnPage() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<VpnPlan[]>([]);
  const [subscription, setSubscription] = useState<VpnSubscription | null>(null);
  const [profiles, setProfiles] = useState<VpnProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [plansData, subData, profilesData] = await Promise.all([
          apiRequest('/api/v1/vpn/plans').catch(() => []),
          apiRequest('/api/v1/vpn/subscription').catch(() => null),
          apiRequest('/api/v1/vpn/profiles').catch(() => []),
        ]);
        setPlans(plansData);
        setSubscription(subData);
        setProfiles(profilesData);
      } catch (e) {
        console.error('Failed to load VPN data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCreateProfile = async () => {
    if (!newDeviceName.trim()) return;
    setCreatingProfile(true);
    try {
      const profile = await apiRequest('/api/v1/vpn/profiles', {
        method: 'POST',
        body: JSON.stringify({ device_name: newDeviceName }),
      });
      setProfiles([profile, ...profiles]);
      setNewDeviceName('');
    } catch (e) {
      console.error('Failed to create profile:', e);
    } finally {
      setCreatingProfile(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    try {
      await apiRequest(`/api/v1/vpn/profiles/${profileId}`, { method: 'DELETE' });
      setProfiles(profiles.filter(p => p.id !== profileId));
    } catch (e) {
      console.error('Failed to delete profile:', e);
    }
  };

  const handleSubscribe = async (planCode: string) => {
    try {
      const checkout = await apiRequest('/api/v1/vpn/subscription/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan_code: planCode }),
      });
      if (checkout.payment_url) {
        window.location.href = checkout.payment_url;
      }
    } catch (e) {
      console.error('Failed to create checkout:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lapka-500" />
      </div>
    );
  }

  const isActive = subscription?.status === 'active';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-lapka-900">{t('vpn.title', 'VPN Защита')}</h1>
        <p className="text-lapka-700 mt-2">
          {t('vpn.subtitle', 'Защищённое соединение для вашего питомца')}
        </p>
      </div>

      {!isActive && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">
            {t('vpn.getProtection', 'Получите защиту')}
          </h2>
          <p className="text-blue-800 mb-4">
            {t('vpn.getProtectionDesc', 'Подключите VPN для безопасного доступа к данным питомца из любой точки мира.')}
          </p>
        </div>
      )}

      {isActive && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="font-semibold text-green-900">
              {t('vpn.active', 'VPN активен')} — {subscription?.plan_code}
            </span>
          </div>
        </div>
      )}

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">{t('vpn.plans', 'Тарифы')}</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.code}
              className={`border rounded-xl p-6 ${
                subscription?.plan_code === plan.code
                  ? 'border-lapka-500 bg-lapka-50'
                  : 'border-gray-200'
              }`}
            >
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="text-2xl font-bold mt-2">
                {plan.price_rub} ₽<span className="text-sm font-normal text-gray-500">/мес</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {t('vpn.devices', 'До')} {plan.device_limit} {t('vpn.devicesCount', 'устройств')}
              </p>
              <ul className="mt-4 space-y-2">
                {plan.features?.map((feature, i) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <span className="text-green-500">✓</span> {feature}
                  </li>
                ))}
              </ul>
              {subscription?.plan_code === plan.code ? (
                <button disabled className="mt-4 w-full btn bg-gray-300 cursor-not-allowed">
                  {t('vpn.current', 'Текущий тариф')}
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.code)}
                  className="mt-4 w-full btn-primary"
                >
                  {isActive ? t('vpn.changePlan', 'Сменить тариф') : t('vpn.subscribe', 'Подключить')}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">{t('vpn.myDevices', 'Мои устройства')}</h2>
        <div className="border rounded-xl overflow-hidden">
          {profiles.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {t('vpn.noDevices', 'Нет подключённых устройств')}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('vpn.device', 'Устройство')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('vpn.status', 'Статус')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('vpn.created', 'Создано')}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">{t('vpn.actions', 'Действия')}</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id} className="border-t">
                    <td className="px-4 py-3">{profile.device_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-sm ${
                        profile.is_active ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          profile.is_active ? 'bg-green-500' : 'bg-gray-300'
                        }`} />
                        {profile.is_active ? t('vpn.active', 'Активно') : t('vpn.inactive', 'Неактивно')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(profile.created_at).toLocaleDateString('ru')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteProfile(profile.id)}
                        className="text-red-600 text-sm hover:underline"
                      >
                        {t('vpn.delete', 'Удалить')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newDeviceName}
            onChange={(e) => setNewDeviceName(e.target.value)}
            placeholder={t('vpn.deviceNamePlaceholder', 'Название устройства')}
            className="flex-1 px-4 py-2 border rounded-lg"
          />
          <button
            onClick={handleCreateProfile}
            disabled={creatingProfile || !newDeviceName.trim()}
            className="btn-primary"
          >
            {creatingProfile ? '...' : t('vpn.addDevice', 'Добавить')}
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">{t('vpn.howToUse', 'Как использовать')}</h2>
        <div className="bg-gray-50 rounded-xl p-6">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-lapka-500 text-white flex items-center justify-center text-xs flex-shrink-0">1</span>
              <span>{t('vpn.step1', 'Создайте профиль для устройства (например, «iPhone» или «Ноутбук»)')}</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-lapka-500 text-white flex items-center justify-center text-xs flex-shrink-0">2</span>
              <span>{t('vpn.step2', 'Скачайте конфигурацию WireGuard на устройство')}</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-lapka-500 text-white flex items-center justify-center text-xs flex-shrink-0">3</span>
              <span>{t('vpn.step3', 'Импортируйте конфигурацию в приложение WireGuard')}</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-lapka-500 text-white flex items-center justify-center text-xs flex-shrink-0">4</span>
              <span>{t('vpn.step4', 'Подключитесь и пользуйтесь защищённым интернетом')}</span>
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}