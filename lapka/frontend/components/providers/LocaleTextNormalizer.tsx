'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const NORMALIZATION_MAP = {
  ru: [
    ['Quick access', 'Быстрый переход'],
    ['GLOBAL SEARCH', 'Быстрый переход'],
    ['Find a page, section or scenario', 'Найти раздел, страницу или сценарий'],
    ['Command palette', 'Командная палитра'],
    ['Owner Cabinet', 'Кабинет владельца'],
    ['Vet Workspace', 'Рабочее место врача'],
    ['Clinic CRM', 'CRM клиники'],
    ['Dashboard', 'Дашборд'],
    ['Pets', 'Питомцы'],
    ['Appointments', 'Записи'],
    ['Medical Records', 'Медкарта'],
    ['Medical records', 'Медкарта'],
    ['Documents', 'Документы'],
    ['Inpatient', 'Стационар'],
    ['AI Triage', 'AI триаж'],
    ['AI Triage', 'AI триаж'],
    ['AI triage', 'AI триаж'],
    ['Pharmacy', 'Аптека'],
    ['Calculators', 'Калькуляторы'],
    ['Disease Library', 'Справочник заболеваний'],
    ['Services', 'Сервисы'],
    ['Insurance', 'Страхование'],
    ['Billing', 'Счета'],
    ['Referrals', 'Рефералы'],
    ['Community', 'Сообщество'],
    ['Lost Pets', 'Потерянные'],
    ['Map Nearby', 'Карта рядом'],
    ['Settings', 'Настройки'],
    ['Profile', 'Профиль'],
    ['Access Requests', 'Запросы доступа'],
    ['Add Pet', 'Добавить питомца'],
    ['Open Profile', 'Открыть профиль'],
    ['Owner demo', 'Демо владельца'],
    ['Vet demo', 'Демо врача'],
    ['Clinic demo', 'Демо клиники'],
    ['Demo helper', 'Демо-помощник'],
    ['Suggested actions to try', 'Что можно проверить прямо сейчас'],
    ['Open pets list', 'Открыть список питомцев'],
    ['Open Barsik profile', 'Открыть карточку Барсика'],
    ['Upload a document', 'Загрузить документ'],
    ['Check inpatient monitoring', 'Проверить стационар'],
    ['Open pharmacy search', 'Открыть аптечный поиск'],
    ['Clinics', 'Клиники'],
    ['Pharmacies', 'Аптеки'],
    ['Parks', 'Площадки'],
    ['Map nearby', 'Карта рядом'],
    ['Place details', 'Детали точки'],
    ['Demo grid map', 'Демо-карта'],
    ['Select a pin to open the drawer', 'Выберите пин, чтобы открыть панель'],
    ['Open owner map', 'Открыть карту владельца'],
    ['Medication Finder', 'Аптека и препараты'],
    ['Where to buy', 'Где купить'],
    ['All about the drug', 'Все о препарате'],
    ['Only Rx', 'Только Rx'],
    ['Shopping list', 'Список покупок'],
    ['Online + nearby offline availability', 'Онлайн и офлайн-доступность рядом'],
    ['Online', 'Онлайн'],
    ['Offline nearby', 'Рядом офлайн'],
    ['No online offers', 'Нет онлайн-предложений'],
    ['Nothing found nearby', 'Поблизости ничего не найдено'],
    ['Go to store', 'Перейти'],
    ['Veterinary Disease Reference', 'Справочник ветеринарных заболеваний'],
    ['Symptom filter', 'Фильтр по симптому'],
    ['Reset symptom filter', 'Сбросить фильтр по симптому'],
    ['Symptoms', 'Симптомы'],
    ['Triage', 'Триаж'],
    ['Details', 'Подробнее'],
    ['Clinical notes', 'Клинические заметки'],
    ['No data in demo catalog.', 'Нет данных в демо-каталоге.'],
    ['No variants', 'Нет вариантов'],
    ['No analogs', 'Нет аналогов'],
    ['Veterinarian', 'Врач'],
    ['Clinic Admin', 'Администратор клиники'],
    ['Logout', 'Выйти'],
    ['Sign in', 'Войти'],
    ['Demo mode', 'Демо-режим'],
    ['For Owners', 'Для владельцев'],
    ['For Vets', 'Для врачей'],
    ['For Clinics', 'Для клиник'],
    ['About', 'О платформе'],
    ['Security', 'Безопасность'],
    ['Pricing', 'Тарифы'],
    ['FAQ', 'Вопросы'],
    ['Home', 'Главная']
  ],
  en: [
    ['Быстрый переход', 'Quick access'],
    ['Найти раздел, страницу или сценарий', 'Find a page, section or scenario'],
    ['Командная палитра', 'Command palette'],
    ['Кабинет владельца', 'Owner Cabinet'],
    ['Рабочее место врача', 'Vet Workspace'],
    ['CRM клиники', 'Clinic CRM'],
    ['Дашборд', 'Dashboard'],
    ['Питомцы', 'Pets'],
    ['Записи', 'Appointments'],
    ['Медкарта', 'Medical Records'],
    ['Документы', 'Documents'],
    ['Стационар', 'Inpatient'],
    ['AI триаж', 'AI Triage'],
    ['Аптека', 'Pharmacy'],
    ['Калькуляторы', 'Calculators'],
    ['Справочник заболеваний', 'Disease Library'],
    ['Сервисы', 'Services'],
    ['Страхование', 'Insurance'],
    ['Счета', 'Billing'],
    ['Рефералы', 'Referrals'],
    ['Сообщество', 'Community'],
    ['Потерянные', 'Lost Pets'],
    ['Карта рядом', 'Map Nearby'],
    ['Настройки', 'Settings'],
    ['Профиль', 'Profile'],
    ['Запросы доступа', 'Access Requests'],
    ['Добавить питомца', 'Add Pet'],
    ['Открыть профиль', 'Open Profile'],
    ['Демо владельца', 'Owner demo'],
    ['Демо врача', 'Vet demo'],
    ['Демо клиники', 'Clinic demo'],
    ['Демо-помощник', 'Demo helper'],
    ['Что можно проверить прямо сейчас', 'Suggested actions to try'],
    ['Открыть список питомцев', 'Open pets list'],
    ['Открыть карточку Барсика', 'Open Barsik profile'],
    ['Загрузить документ', 'Upload a document'],
    ['Проверить стационар', 'Check inpatient monitoring'],
    ['Открыть аптечный поиск', 'Open pharmacy search'],
    ['Клиники', 'Clinics'],
    ['Аптеки', 'Pharmacies'],
    ['Площадки', 'Parks'],
    ['Детали точки', 'Place details'],
    ['Демо-карта', 'Demo grid map'],
    ['Выберите пин, чтобы открыть панель', 'Select a pin to open the drawer'],
    ['Открыть карту владельца', 'Open owner map'],
    ['Аптека и препараты', 'Medication Finder'],
    ['Где купить', 'Where to buy'],
    ['Все о препарате', 'All about the drug'],
    ['Только Rx', 'Only Rx'],
    ['Список покупок', 'Shopping list'],
    ['Онлайн и офлайн-доступность рядом', 'Online + nearby offline availability'],
    ['Онлайн', 'Online'],
    ['Рядом офлайн', 'Offline nearby'],
    ['Нет онлайн-предложений', 'No online offers'],
    ['Поблизости ничего не найдено', 'Nothing found nearby'],
    ['Перейти', 'Go to store'],
    ['Справочник ветеринарных заболеваний', 'Veterinary Disease Reference'],
    ['Фильтр по симптому', 'Symptom filter'],
    ['Сбросить фильтр по симптому', 'Reset symptom filter'],
    ['Симптомы', 'Symptoms'],
    ['Триаж', 'Triage'],
    ['Подробнее', 'Details'],
    ['Клинические заметки', 'Clinical notes'],
    ['Нет данных в демо-каталоге.', 'No data in demo catalog.'],
    ['Нет вариантов', 'No variants'],
    ['Нет аналогов', 'No analogs'],
    ['Врач', 'Veterinarian'],
    ['Администратор клиники', 'Clinic Admin'],
    ['Выйти', 'Logout'],
    ['Войти', 'Sign in'],
    ['Демо-режим', 'Demo mode'],
    ['Для владельцев', 'For Owners'],
    ['Для врачей', 'For Vets'],
    ['Для клиник', 'For Clinics'],
    ['О платформе', 'About'],
    ['Безопасность', 'Security'],
    ['Тарифы', 'Pricing'],
    ['Вопросы', 'FAQ'],
    ['Главная', 'Home']
  ]
};

function applyReplacements(value, replacements) {
  let next = value;
  for (const [from, to] of replacements) {
    if (next.includes(from)) {
      next = next.split(from).join(to);
    }
  }
  return next;
}

function normalizeTree(root, replacements) {
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node = walker.nextNode();

  while (node) {
    textNodes.push(node);
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const parentName = textNode.parentElement?.tagName;
    if (parentName && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parentName)) continue;
    if (!textNode.textContent?.trim()) continue;
    const nextValue = applyReplacements(textNode.textContent, replacements);
    if (nextValue !== textNode.textContent) {
      textNode.textContent = nextValue;
    }
  }

  const attrSelectors = ['[placeholder]', '[title]', '[aria-label]', 'img[alt]'];
  for (const selector of attrSelectors) {
    root.querySelectorAll(selector).forEach((element) => {
      ['placeholder', 'title', 'aria-label', 'alt'].forEach((attr) => {
        const current = element.getAttribute(attr);
        if (!current) return;
        const nextValue = applyReplacements(current, replacements);
        if (nextValue !== current) {
          element.setAttribute(attr, nextValue);
        }
      });
    });
  }
}

export default function LocaleTextNormalizer() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'ru';
    const replacements = [...NORMALIZATION_MAP[lang]].sort((a, b) => b[0].length - a[0].length);

    const run = () => normalizeTree(document.body, replacements);
    run();

    let rafId = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(run);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label', 'alt']
    });

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [i18n.resolvedLanguage]);

  return null;
}
