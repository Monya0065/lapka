export interface DangerousProduct {
  id: string;
  name: string;
  category: string;
  severity: 'critical' | 'high' | 'moderate';
  species: string[];
  why: string;
  symptoms: string[];
  safeAlternative: string;
}

export const DANGEROUS_PRODUCTS: DangerousProduct[] = [
  {
    id: 'food_chocolate',
    name: 'Шоколад',
    category: 'сладости',
    severity: 'critical',
    species: ['cat', 'dog'],
    why: 'Содержит теобромин и кофеин, которые токсичны для кошек и собак.',
    symptoms: ['рвота', 'тремор', 'тахикардия', 'судороги'],
    safeAlternative: 'ветеринарные лакомства без какао',
  },
  {
    id: 'food_grapes',
    name: 'Виноград и изюм',
    category: 'фрукты',
    severity: 'critical',
    species: ['dog'],
    why: 'Может вызывать острое поражение почек у собак даже в небольшом количестве.',
    symptoms: ['рвота', 'вялость', 'полиурия', 'обезвоживание'],
    safeAlternative: 'яблоко без семян',
  },
  {
    id: 'food_onion',
    name: 'Лук и чеснок',
    category: 'овощи',
    severity: 'high',
    species: ['cat', 'dog'],
    why: 'Провоцирует гемолитическое повреждение эритроцитов.',
    symptoms: ['слабость', 'бледные слизистые', 'тахикардия'],
    safeAlternative: 'отварная тыква или кабачок',
  },
  {
    id: 'food_xylitol',
    name: 'Ксилит',
    category: 'подсластители',
    severity: 'critical',
    species: ['dog'],
    why: 'Быстро вызывает тяжёлую гипогликемию и поражение печени.',
    symptoms: ['коллапс', 'дрожь', 'дезориентация'],
    safeAlternative: 'безопасные лакомства без сахарозаменителей',
  },
  {
    id: 'food_alcohol',
    name: 'Алкоголь',
    category: 'напитки',
    severity: 'critical',
    species: ['cat', 'dog', 'rabbit', 'ferret'],
    why: 'Вызывает угнетение ЦНС и риски дыхательной недостаточности.',
    symptoms: ['шаткость', 'рвота', 'угнетение сознания'],
    safeAlternative: 'вода, ветеринарный электролит по назначению врача',
  },
  {
    id: 'food_bones',
    name: 'Трубчатые кости',
    category: 'мясо',
    severity: 'high',
    species: ['dog', 'cat'],
    why: 'Опасность перфорации ЖКТ и кишечной непроходимости.',
    symptoms: ['боль в животе', 'рвота', 'запор', 'кровь в стуле'],
    safeAlternative: 'ветеринарные жевательные игрушки',
  },
  {
    id: 'food_milk',
    name: 'Молоко',
    category: 'молочные',
    severity: 'moderate',
    species: ['cat', 'dog'],
    why: 'У взрослых животных часто вызывает диарею и метеоризм.',
    symptoms: ['диарея', 'урчание', 'дискомфорт'],
    safeAlternative: 'вода или специальное безлактозное лакомство',
  },
  {
    id: 'food_raw_fish',
    name: 'Сырая рыба',
    category: 'сырое питание',
    severity: 'moderate',
    species: ['cat', 'dog'],
    why: 'Риск паразитов и дефицитных состояний при систематическом кормлении.',
    symptoms: ['рвота', 'диарея', 'вялость'],
    safeAlternative: 'термически обработанная рыба без костей',
  },
];

export interface CareGuide {
  id: string;
  category: string;
  title: string;
  readingTime: string;
  summary: string;
  checklist: string[];
}

export const CARE_GUIDES: CareGuide[] = [
  {
    id: 'care_walk',
    category: 'прогулки',
    title: 'Как сделать прогулку полезной, а не хаотичной',
    readingTime: '5 мин',
    summary: 'Сочетайте спокойный шаг, короткие задачи на концентрацию и контроль перегрева летом.',
    checklist: ['Вода и паузы', 'Осмотр лап после улицы', 'Контроль перегрева', 'Нагрузка по возрасту'],
  },
  {
    id: 'care_weight',
    category: 'питание',
    title: 'Вес питомца: что отслеживать каждую неделю',
    readingTime: '4 мин',
    summary: 'Фиксируйте вес, аппетит, активность и реакцию на смену корма — это помогает заметить тренд раньше.',
    checklist: ['Вес 1 раз в неделю', 'Отметка аппетита', 'Фото корпуса раз в месяц', 'Заметки о переносимости корма'],
  },
  {
    id: 'care_home',
    category: 'дом',
    title: 'Домашняя среда без скрытых рисков',
    readingTime: '6 мин',
    summary: 'Уберите токсичные растения, бытовую химию и мелкие предметы, которые легко проглотить.',
    checklist: ['Проверьте химию', 'Уберите провода', 'Проверьте растения', 'Зона спокойного отдыха'],
  },
  {
    id: 'care_behavior',
    category: 'поведение',
    title: 'Когда изменения поведения требуют внимания',
    readingTime: '7 мин',
    summary: 'Отказ от общения, прятанье, снижение активности и тревожность часто важнее громких симптомов.',
    checklist: ['Отметьте начало изменений', 'Оцените аппетит', 'Проверьте сон и активность', 'Подготовьте вопросы врачу'],
  },
];

export interface CareFaq {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export const CARE_FAQ: CareFaq[] = [
  {
    id: 'faq_loss_appetite',
    category: 'питание',
    question: 'Что отслеживать, если питомец стал хуже есть?',
    answer:
      'Фиксируйте длительность снижения аппетита, жажду, активность, эпизоды рвоты и любые изменения стула. Эти наблюдения полезно показать врачу на приёме.',
  },
  {
    id: 'faq_new_food',
    category: 'питание',
    question: 'Как безопасно вводить новый корм?',
    answer:
      'Переход лучше отслеживать по дневнику: отмечать день смены, объём порции, переносимость, стул и аппетит. При ухудшении состояния обсудите рацион с врачом.',
  },
  {
    id: 'faq_walk_heat',
    category: 'прогулки',
    question: 'Что важно контролировать на прогулке в жару?',
    answer:
      'Следите за жаждой, перегревом, длительностью прогулки и состоянием лап. Если появляется выраженная вялость или тяжёлое дыхание, нужен осмотр врача.',
  },
  {
    id: 'faq_behavior',
    category: 'поведение',
    question: 'Какие изменения поведения нельзя игнорировать?',
    answer:
      'Резкое снижение активности, прятанье, отказ от контакта, необычная агрессия или постоянная тревожность лучше фиксировать и обсуждать с врачом.',
  },
];

export const VET_DISCUSSION_TOPICS = [
  'Когда впервые начались изменения аппетита или поведения',
  'Что изменилось в рационе за последние 2 недели',
  'Как менялся вес питомца по неделям',
  'Есть ли новые документы, фото или видео симптомов',
  'Были ли похожие эпизоды раньше и как долго они длились',
  'Есть ли факторы дома или на прогулке, которые могли повлиять на состояние',
];

export const MEAL_TYPES = [
  { value: 'breakfast', label: 'Утреннее кормление' },
  { value: 'day', label: 'Дневное кормление' },
  { value: 'evening', label: 'Вечернее кормление' },
  { value: 'snack', label: 'Лакомство' },
];

interface BreedStub {
  breed: string;
  species: string;
  confidence: number;
  note: string;
}

export function analyzeBreedStub(fileName = ''): BreedStub {
  const normalized = String(fileName || '').toLowerCase();
  const variants: BreedStub[] = [
    {
      breed: 'Британская короткошёрстная',
      species: 'Кот',
      confidence: 91,
      note: 'Похожа на короткошёрстную массивную породу со спокойным типом морды.',
    },
    {
      breed: 'Лабрадор ретривер',
      species: 'Собака',
      confidence: 86,
      note: 'Силуэт и пропорции ближе к крупным дружелюбным породам-компаньонам.',
    },
    {
      breed: 'Сибирская кошка',
      species: 'Кот',
      confidence: 82,
      note: 'Плотный шерстный покров и формат корпуса похожи на сибирский тип.',
    },
    {
      breed: 'Джек-рассел-терьер',
      species: 'Собака',
      confidence: 78,
      note: 'Размер и посадка корпуса ближе к активным терьерам.',
    },
  ];

  if (normalized.includes('cat') || normalized.includes('barsik') || normalized.includes('kitten')) {
    return variants[0];
  }
  if (normalized.includes('dog') || normalized.includes('labrador') || normalized.includes('puppy')) {
    return variants[1];
  }

  let hash = 0;
  for (const symbol of normalized) {
    hash = (hash + symbol.charCodeAt(0)) % variants.length;
  }

  return variants[hash] || variants[0];
}

export function severityMeta(level: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    critical: {
      label: 'Критично',
      className: 'badge-red',
    },
    high: {
      label: 'Высокий риск',
      className: 'badge-yellow',
    },
    moderate: {
      label: 'Умеренный риск',
      className: 'pill',
    },
  };
  return map[level] || map.moderate;
}