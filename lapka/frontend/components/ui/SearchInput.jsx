'use client';

import { useTranslation } from 'react-i18next';
import Input from '@/components/ui/Input';

export default function SearchInput({ label, placeholder, ...props }) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'ru';

  return (
    <Input
      label={label || (lang === 'en' ? 'Search' : 'Поиск')}
      placeholder={placeholder || (lang === 'en' ? 'Search...' : 'Поиск...')}
      {...props}
    />
  );
}
