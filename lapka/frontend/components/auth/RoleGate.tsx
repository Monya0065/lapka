'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { roleHome, validateStoredSession } from '@/lib/auth';

export default function RoleGate({ allowedRoles = [], children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { i18n } = useTranslation();
  const [status, setStatus] = useState('checking');
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'ru';
  const copy = lang === 'en'
    ? {
        title: 'Checking access',
        subtitle: 'Redirecting to the available page...'
      }
    : {
        title: 'Проверка доступа',
        subtitle: 'Перенаправляем на доступную страницу...'
      };

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      const user = await validateStoredSession();
      if (cancelled) return;

      if (user?.role && allowedRoles.includes(user.role)) {
        setStatus('allowed');
        return;
      }

      setStatus('denied');
      const target = user?.role ? roleHome(user.role) : `/login?next=${encodeURIComponent(pathname || '/')}`;
      router.replace(target);
    }

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [allowedRoles, pathname, router]);

  if (status === 'allowed') return children;

  return (
    <div className="page-wrap py-10">
      <div className="surface-card p-8 text-center">
        <div className="mx-auto mb-3 h-12 w-12 animate-pulse rounded-2xl bg-lapka-gradient" />
        <h2 className="text-2xl font-extrabold tracking-tight text-lapka-900">{copy.title}</h2>
        <p className="mt-2 text-sm text-lapka-600">{copy.subtitle}</p>
      </div>
    </div>
  );
}
