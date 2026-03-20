import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import PwaController from '@/components/ui/PwaController';
import I18nProvider from '@/components/providers/I18nProvider';
import LocaleTextNormalizer from '@/components/providers/LocaleTextNormalizer';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import ThemeToggle from '@/components/ui/ThemeToggle';

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin', 'cyrillic-ext', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

export const metadata = {
  title: 'Лапка — ветеринарная платформа',
  description: 'Единая платформа для владельцев питомцев, ветеринарных врачей и клиник.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/assets/img/logo-paw.svg',
    apple: '/assets/img/logo-paw.svg',
  },
};

export const viewport = {
  themeColor: '#2f9ce0',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${fontSans.variable} font-sans`}>
        <I18nProvider>
          <ThemeProvider>
            {children}
            <ThemeToggle />
          </ThemeProvider>
          <LocaleTextNormalizer />
          <PwaController />
        </I18nProvider>
      </body>
    </html>
  );
}
