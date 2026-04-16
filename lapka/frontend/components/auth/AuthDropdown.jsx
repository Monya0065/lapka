'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { loginWithPassword, logoutUser, selectClinic, getStoredSession } from '@/lib/auth';
import { ROLE_PRESETS, ROLE_ROUTES } from '@/lib/constants';

function profileRoute(role) {
  if (role === 'vet') return '/vet/dashboard';
  if (role === 'clinic_admin') return '/clinic/dashboard';
  if (role === 'network_admin') return '/platform/dashboard';
  return '/owner/profile';
}

export default function AuthDropdown({ mode = 'menu', initialRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, i18n } = useTranslation();
  const isEn = i18n.resolvedLanguage === 'en';
  const [isOpen, setIsOpen] = useState(mode === 'card');
  const [selectedRole, setSelectedRole] = useState(initialRole || 'owner');
  const [email, setEmail] = useState(ROLE_PRESETS[initialRole || 'owner']?.email || ROLE_PRESETS.owner.email);
  const [password, setPassword] = useState(ROLE_PRESETS[initialRole || 'owner']?.password || ROLE_PRESETS.owner.password);
  const [clinicId, setClinicId] = useState('');
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState(getStoredSession());

  useEffect(() => {
    setSession(getStoredSession());
    const onAuthChange = () => setSession(getStoredSession());
    window.addEventListener('lapka-auth-change', onAuthChange);
    return () => window.removeEventListener('lapka-auth-change', onAuthChange);
  }, []);

  const roleLabel = useMemo(() => {
    if (!session.role) return null;
    if (session.role === 'vet') return t('roles.vet');
    if (session.role === 'clinic_admin') return t('roles.clinicAdmin');
    if (session.role === 'network_admin') return isEn ? 'Network admin' : 'Суперпользователь';
    return t('roles.owner');
  }, [isEn, session.role, t]);

  const roleOptionLabel = (roleKey) => {
    if (roleKey === 'owner') return t('roles.owner');
    if (roleKey === 'vet') return t('roles.vet');
    if (roleKey === 'clinic_admin') return t('roles.clinicAdmin');
    return isEn ? 'Network admin' : 'Суперпользователь';
  };

  function onRoleChange(nextRole) {
    setSelectedRole(nextRole);
    setEmail(ROLE_PRESETS[nextRole].email);
    setPassword(ROLE_PRESETS[nextRole].password);
    setError('');
  }

  async function onLogin(event) {
    event?.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { user } = await loginWithPassword(email, password, clinicId || undefined);
      const target = ROLE_ROUTES[user.role] || '/';
      setIsOpen(mode === 'card');
      if (pathname !== target) router.push(target);
    } catch (e) {
      setError(e.message || t('auth.defaultError'));
    } finally {
      setIsLoading(false);
    }
  }

  async function onLogout() {
    await logoutUser();
    setIsOpen(false);
    router.push('/login');
  }

  function goToLogin(role) {
    router.push(`/login?role=${role}`);
  }

  const isCard = mode === 'card';
  const avatarLetter = String(session.email || selectedRole || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className={`relative ${isCard ? 'w-full' : ''}`}>
      {isCard ? null : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={session.role ? 'inline-flex h-14 items-center gap-2 rounded-full border border-lapka-200 bg-white px-2.5 pr-3 text-lapka-800 shadow-soft transition hover:border-lapka-300 hover:bg-lapka-50' : 'btn-primary'}
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            title={session.role ? `${roleLabel} · ${session.email}` : t('auth.login')}
          >
            {session.role ? (
              <>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-400 text-base font-black text-white shadow-sm">
                  {avatarLetter}
                </span>
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-lapka-500">
                  <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            ) : t('auth.login')}
          </button>
        </div>
      )}

      {(isOpen || isCard) && (
        <form
          onSubmit={onLogin}
          className={`surface-card z-30 space-y-4 p-5 ${isCard ? '' : 'absolute right-0 mt-3 w-[min(94vw,420px)] shadow-float'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xl font-extrabold tracking-tight text-lapka-900">{t('auth.title')}</h3>
            {!isCard ? (
              <button type="button" className="btn-secondary !px-3 !py-2 text-sm" onClick={() => setIsOpen(false)}>
                {t('auth.close')}
              </button>
            ) : null}
          </div>

          <label className="block">
            <span className="label">{t('auth.role')}</span>
            <select className="input" value={selectedRole} onChange={(e) => onRoleChange(e.target.value)}>
              {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>{roleOptionLabel(key)}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">{t('auth.email')}</span>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          {(selectedRole === 'vet' || selectedRole === 'clinic_admin') && (
            <label className="block">
              <span className="label">{t('auth.clinicId')}</span>
              <input
                className="input"
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
                placeholder="UUID of clinic"
              />
            </label>
          )}

          <label className="block">
            <span className="label">{t('auth.password')}</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={isLoading} type="submit">
              {isLoading ? t('auth.loggingIn') : t('auth.login')}
            </button>
            {switching && (
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  try {
                    setIsLoading(true);
                    await selectClinic(clinicId);
                    setSwitching(false);
                  } catch (e) {
                    setError(e.message || t('auth.defaultError'));
                  } finally {
                    setIsLoading(false);
                  }
                }}
              >
                {t('auth.switch')}
              </button>
            )}
            {session.role ? (
              <>
                <button type="button" className="btn-secondary" onClick={() => router.push(profileRoute(session.role))}>
                  {t('auth.profile')}
                </button>
                <button type="button" className="btn-secondary" onClick={onLogout}>
                  {t('auth.logout')}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-secondary" onClick={() => goToLogin('owner')}>
                  {t('auth.ownerPage')}
                </button>
                <button type="button" className="btn-secondary" onClick={() => goToLogin('vet')}>
                  {t('auth.vetPage')}
                </button>
                <button type="button" className="btn-secondary" onClick={() => goToLogin('clinic_admin')}>
                  {t('auth.adminPage')}
                </button>
                <button type="button" className="btn-secondary" onClick={() => goToLogin('network_admin')}>
                  {isEn ? 'Platform center' : 'Центр платформы'}
                </button>
              </>
            )}
          </div>

          <p className="text-xs text-lapka-600">{t('auth.apiHint')}</p>

          {roleLabel ? (
            <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-xs text-lapka-700">
              {t('auth.currentSession')}: <span className="font-semibold">{roleLabel}</span> ({session.email})
            </div>
          ) : null}
        </form>
      )}
    </div>
  );
}
