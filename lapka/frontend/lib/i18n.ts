import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ruCommon from '@/locales/ru/common.json';
import enCommon from '@/locales/en/common.json';
import esCommon from '@/locales/es/common.json';

const defaultNS = 'common';

i18n.use(initReactI18next).init({
  resources: {
    ru: { [defaultNS]: ruCommon },
    en: { [defaultNS]: enCommon },
    es: { [defaultNS]: esCommon },
  },
  defaultNS,
  fallbackLng: 'ru',
  lng: 'ru',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;