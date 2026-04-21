'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

const NAV_ITEMS = [
  { href: '/owner/pets', icon: '🐾', labelKey: 'nav.pets' },
  { href: '/owner/appointments', icon: '📅', labelKey: 'nav.appointments' },
  { href: '/owner/inbox', icon: '💬', labelKey: 'nav.inbox' },
  { href: '/owner/profile', icon: '👤', labelKey: 'nav.profile' },
];

export default function MobileNav() {
  const { t } = useTranslation();
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-[80] border-t border-lapka-200 bg-white/95 px-2 py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md md:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-4 gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-all ${
                isActive
                  ? 'text-lapka-700 bg-lapka-50'
                  : 'text-lapka-500 hover:bg-lapka-50 hover:text-lapka-700'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}