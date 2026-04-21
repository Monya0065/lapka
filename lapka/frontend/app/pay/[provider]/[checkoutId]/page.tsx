'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiRequest } from '@/lib/api';

function vpnErrorCode(err) {
  const d = err?.payload?.detail;
  if (typeof d === 'object' && d && d.code) return d.code;
  return null;
}

function statusHint(status, t) {
  if (status === 'pending') return t('payVpnPage.pendingHint');
  if (status === 'captured') return t('payVpnPage.capturedHint');
  if (status === 'failed') return t('payVpnPage.failedHint');
  if (status === 'refunded') return t('payVpnPage.refundedHint');
  return '';
}

export default function PayVpnCheckoutPage() {
  const params = useParams();
  const provider = params?.provider ? String(params.provider) : '';
  const checkoutId = params?.checkoutId ? String(params.checkoutId) : '';
  const { t, i18n } = useTranslation('common');
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [row, setRow] = useState(null);

  const loginNext = `/pay/${encodeURIComponent(provider)}/${encodeURIComponent(checkoutId)}`;

  const load = useCallback(async () => {
    if (!checkoutId) return;
    setLoading(true);
    setError('');
    setUnauthorized(false);
    setNotFound(false);
    setSchemaMissing(false);
    try {
      const data = await apiRequest(`/api/v1/vpn/billing/checkout/${encodeURIComponent(checkoutId)}`, { noCache: true });
      setRow(data);
    } catch (e) {
      const st = e.status;
      if (st === 401) setUnauthorized(true);
      else if (st === 404) setNotFound(true);
      else if (vpnErrorCode(e) === 'VPN_SCHEMA_MISSING') setSchemaMissing(true);
      else setError(e.message || t('payVpnPage.loadError'));
    } finally {
      setLoading(false);
    }
  }, [checkoutId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const formatDt = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(isEn ? 'en-US' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="page-wrap flex min-h-[70vh] flex-col items-center justify-center py-10">
      <div className="w-full max-w-lg space-y-4">
        <header className="text-center">
          <h1 className="text-2xl font-semibold text-slate-900">{t('payVpnPage.title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('payVpnPage.subtitle')}</p>
        </header>

        {unauthorized ? (
          <Card headerSize="md" title={t('payVpnPage.loginRequired')}>
            <Link
              href={`/login?role=owner&next=${encodeURIComponent(loginNext)}`}
              prefetch={false}
              className="btn-primary mt-2 inline-flex"
            >
              {t('payVpnPage.loginCta')}
            </Link>
          </Card>
        ) : null}

        {schemaMissing ? <ErrorBanner message={t('payVpnPage.schemaMissing')} /> : null}
        {notFound ? <ErrorBanner message={t('payVpnPage.notFound')} /> : null}
        {error ? <ErrorBanner message={error} /> : null}

        {!unauthorized && !notFound && !schemaMissing ? (
          <Card headerSize="md" title={t('payVpnPage.checkoutId')}>
            {loading ? <p className="text-sm text-slate-500">…</p> : null}
            {!loading && row ? (
              <div className="space-y-3 text-sm">
                <dl className="grid gap-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">{t('payVpnPage.checkoutId')}</dt>
                    <dd className="font-mono text-xs text-slate-800">{row.checkout_id}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">{t('payVpnPage.provider')}</dt>
                    <dd>{provider || row.provider}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">{t('payVpnPage.plan')}</dt>
                    <dd>{row.plan_code}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">{t('payVpnPage.amount')}</dt>
                    <dd>
                      {row.amount_rub} {isEn ? 'RUB' : '₽'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">{t('payVpnPage.status')}</dt>
                    <dd>
                      <span className={row.status === 'captured' ? 'badge-green' : row.status === 'pending' ? 'pill' : 'badge-red'}>{row.status}</span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">{isEn ? 'Created' : 'Создан'}</dt>
                    <dd>{formatDt(row.created_at)}</dd>
                  </div>
                </dl>
                <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{statusHint(row.status, t)}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
                    {t('payVpnPage.refresh')}
                  </button>
                  <Link href="/owner/pets" prefetch={false} className="btn-primary">
                    {t('payVpnPage.openVpnCabinet')}
                  </Link>
                </div>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
