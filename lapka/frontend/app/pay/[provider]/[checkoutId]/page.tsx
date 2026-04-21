'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

interface PaymentStatus {
  checkout_id: string;
  provider: string;
  status: string;
  amount_rub: number;
  created_at: string;
}

export default function PaymentStatusPage({ params }: { params: { provider: string; checkoutId: string } }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      try {
        const data = await fetch(`/api/v1/vpn/checkouts/${params.checkoutId}`).then(r => r.json()).catch(() => null);
        setStatus(data);
      } catch (e) {
        console.error('Failed to fetch payment status:', e);
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, [params.checkoutId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lapka-500" />
      </div>
    );
  }

  const isSuccess = status?.status === 'captured';
  const isPending = status?.status === 'pending';
  const isFailed = status?.status === 'failed' || status?.status === 'canceled';

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center">
        {isSuccess && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-green-900 mb-2">
              {t('payment.success', 'Оплата успешна!')}
            </h1>
            <p className="text-green-700 mb-6">
              {t('payment.successDesc', 'Ваш VPN активирован. Спасибо за покупку!')}
            </p>
          </>
        )}

        {isPending && (
          <>
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-yellow-900 mb-2">
              {t('payment.pending', 'Ожидание оплаты')}
            </h1>
            <p className="text-yellow-700 mb-6">
              {t('payment.pendingDesc', 'Пожалуйста, завершите оплату. Страница обновится автоматически.')}
            </p>
          </>
        )}

        {isFailed && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-red-900 mb-2">
              {t('payment.failed', 'Оплата не удалась')}
            </h1>
            <p className="text-red-700 mb-6">
              {t('payment.failedDesc', 'Попробуйте ещё раз или свяжитесь с поддержкой.')}
            </p>
          </>
        )}

        {status && (
          <div className="bg-gray-50 rounded-xl p-4 text-left mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('payment.checkout', 'Номер заказа')}</span>
              <span className="font-mono">{status.checkout_id.slice(0, 16)}...</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-500">{t('payment.amount', 'Сумма')}</span>
              <span className="font-semibold">{status.amount_rub} ₽</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-500">{t('payment.provider', 'Способ оплаты')}</span>
              <span>{status.provider}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {isSuccess && (
            <Link href="/owner/vpn" className="btn-primary w-full">
              {t('payment.goToVpn', 'Перейти в VPN')}
            </Link>
          )}
          
          {(isPending || isFailed) && (
            <button onClick={() => window.location.reload()} className="btn-primary w-full">
              {t('payment.refresh', 'Проверить статус')}
            </button>
          )}
          
          <Link href="/owner" className="btn-secondary w-full">
            {t('payment.backToAccount', 'Вернуться в аккаунт')}
          </Link>
        </div>
      </div>
    </div>
  );
}