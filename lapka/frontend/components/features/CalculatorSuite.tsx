'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiRequest } from '@/lib/api';
import { getStoredSession } from '@/lib/auth';

const CATEGORY_META = {
  nutrition: {
    title: 'Питание и метаболизм',
    subtitle: 'Энергетическая потребность и базовые расчёты для владельца и врача.',
  },
  dosing: {
    title: 'Дозировки и объёмы',
    subtitle: 'Только для врача: справочные формулы для расчёта дозы и объёма.',
  },
  fluid: {
    title: 'Инфузии и гидратация',
    subtitle: 'Поддерживающая жидкость, дефицит и темп инфузии.',
  },
  transfusion: {
    title: 'Кровь и компоненты',
    subtitle: 'Расчёты для трансфузии и оценки объёмов.',
  },
  emergency: {
    title: 'Экстренные расчёты',
    subtitle: 'Шок, скорость капельного введения и экстренные формулы.',
  },
  monitoring: {
    title: 'Мониторинг и bedside',
    subtitle: 'Ориентиры по vitals, возрасту и базовой оценке состояния.',
  },
  other: {
    title: 'Дополнительные калькуляторы',
    subtitle: 'Прочие клинические вычисления из API.',
  },
};

const TOOL_REFERENCE_GROUPS = {
  owner: [
    { title: 'Питание и вес', text: 'Дневник кормлений, порций и динамики веса.', href: '/owner/care?tab=nutrition' },
    { title: 'Что можно и нельзя', text: 'Питание, бытовые риски и безопасные привычки дома.', href: '/owner/care?tab=overview' },
    { title: 'Опасные продукты', text: 'Быстрый справочник по рациону и домашней безопасности.', href: '/owner/care?tab=food-safety' },
    { title: 'QR-паспорт питомца', text: 'Публичный жетон для безопасного возврата питомца.', href: '/owner/pets' },
  ],
  clinical: [
    { title: 'Справочник заболеваний', text: 'Патологии, уровни срочности и критические маркеры.', href: '/diseases' },
    { title: 'Клинические протоколы', text: 'Алгоритмы приёма, анестезии и стационара.', href: '/clinical/protocols' },
    { title: 'Справочник препаратов', text: 'Карточки препаратов, формы и предупреждения.', href: '/vet/drugs' },
    { title: 'Работа со стационаром', text: 'Обновления для владельца, фото-отчёты и камеры.', href: '/vet/inpatient' },
  ],
};

const REANIMATION_CHECKLIST = [
  'Проверить проходимость дыхательных путей и оксигенацию.',
  'Подтвердить IV/IO доступ и базовые vitals.',
  'Оценить признаки шока, кровопотери и боли.',
  'Подготовить экстренный чек-лист и протокол команды.',
];

const LOCAL_CALCULATORS = [
  {
    id: 'local_rer',
    name: 'RER',
    description: 'Resting Energy Requirement по весу животного.',
    category: 'nutrition',
    allowed_roles: ['owner', 'vet', 'clinic_admin'],
    inputs: [{ key: 'weight_kg', label: 'Вес, кг', min: 0.1, step: 0.1, default: 5 }],
    compute: ({ weight_kg }) => {
      const rer = 70 * Math.pow(Number(weight_kg || 0), 0.75);
      return {
        result: {
          rer_kcal_day: rer.toFixed(1),
        },
        explanation: 'Справочная базовая энергетическая потребность без поправочных коэффициентов.',
      };
    },
  },
  {
    id: 'local_der',
    name: 'DER',
    description: 'Daily Energy Requirement с activity factor.',
    category: 'nutrition',
    allowed_roles: ['owner', 'vet', 'clinic_admin'],
    inputs: [
      { key: 'weight_kg', label: 'Вес, кг', min: 0.1, step: 0.1, default: 5 },
      { key: 'factor', label: 'Коэффициент', options: ['1.2', '1.4', '1.6', '2.0'], default: '1.2' },
    ],
    compute: ({ weight_kg, factor }) => {
      const rer = 70 * Math.pow(Number(weight_kg || 0), 0.75);
      const der = rer * Number(factor || 1);
      return {
        result: {
          rer_kcal_day: rer.toFixed(1),
          der_kcal_day: der.toFixed(1),
        },
        explanation: 'DER зависит от активности, статуса кастрации, роста и клинического контекста.',
      };
    },
  },
  {
    id: 'local_drug_dose',
    name: 'Расчёт дозы препарата',
    description: 'Формула total mg и volume ml для врачебного сценария.',
    category: 'dosing',
    allowed_roles: ['vet', 'clinic_admin'],
    inputs: [
      { key: 'weight_kg', label: 'Вес, кг', min: 0.1, step: 0.1, default: 5 },
      { key: 'dose_mg_kg', label: 'Доза, мг/кг', min: 0.01, step: 0.01, default: 1 },
      { key: 'concentration_mg_ml', label: 'Концентрация, мг/мл', min: 0.01, step: 0.01, default: 10 },
    ],
    compute: ({ weight_kg, dose_mg_kg, concentration_mg_ml }) => {
      const totalMg = Number(weight_kg || 0) * Number(dose_mg_kg || 0);
      const volumeMl = totalMg / Number(concentration_mg_ml || 1);
      return {
        result: {
          total_mg: totalMg.toFixed(2),
          volume_ml: volumeMl.toFixed(2),
        },
        explanation: 'Чистая формула расчёта. Итоговое назначение и схема всегда подтверждаются врачом.',
        warning: 'Решение принимает ветеринарный врач. Не показывать владельцу как инструкцию к лечению.',
      };
    },
  },
  {
    id: 'local_fluid_therapy',
    name: 'Инфузионная терапия',
    description: 'Maintenance + dehydration deficit + hourly rate.',
    category: 'fluid',
    allowed_roles: ['vet', 'clinic_admin'],
    inputs: [
      { key: 'weight_kg', label: 'Вес, кг', min: 0.1, step: 0.1, default: 5 },
      { key: 'maintenance_ml_kg_day', label: 'Поддержка, мл/кг/сут', min: 10, step: 1, default: 50 },
      { key: 'dehydration_percent', label: 'Дегидратация, %', min: 0, step: 0.5, default: 5 },
      { key: 'duration_hr', label: 'Длительность, ч', min: 1, step: 1, default: 24 },
    ],
    compute: ({ weight_kg, maintenance_ml_kg_day, dehydration_percent, duration_hr }) => {
      const maintenance = Number(weight_kg || 0) * Number(maintenance_ml_kg_day || 0) * (Number(duration_hr || 0) / 24);
      const deficit = Number(weight_kg || 0) * Number(dehydration_percent || 0) * 10;
      const total = maintenance + deficit;
      const rate = total / Number(duration_hr || 1);
      return {
        result: {
          maintenance_ml: maintenance.toFixed(1),
          dehydration_deficit_ml: deficit.toFixed(1),
          total_fluid_ml: total.toFixed(1),
          rate_ml_hr: rate.toFixed(1),
        },
        explanation: 'Расчёт не учитывает ongoing losses и индивидуальные клинические корректировки.',
      };
    },
  },
  {
    id: 'local_dehydration_deficit',
    name: 'Dehydration deficit',
    description: 'Быстрый расчёт дефицита жидкости без maintenance.',
    category: 'fluid',
    allowed_roles: ['vet', 'clinic_admin'],
    inputs: [
      { key: 'weight_kg', label: 'Вес, кг', min: 0.1, step: 0.1, default: 5 },
      { key: 'dehydration_percent', label: 'Дегидратация, %', min: 0, step: 0.5, default: 5 },
    ],
    compute: ({ weight_kg, dehydration_percent }) => {
      const deficit = Number(weight_kg || 0) * Number(dehydration_percent || 0) * 10;
      return {
        result: {
          dehydration_deficit_ml: deficit.toFixed(1),
        },
        explanation: 'Отдельный дефицитный объём. Далее добавляются support и ongoing losses.',
      };
    },
  },
  {
    id: 'local_transfusion',
    name: 'Объём трансфузии',
    description: 'Расчёт объёма transfusion по PCV.',
    category: 'transfusion',
    allowed_roles: ['vet', 'clinic_admin'],
    inputs: [
      { key: 'weight_kg', label: 'Вес, кг', min: 0.1, step: 0.1, default: 5 },
      { key: 'blood_volume', label: 'Кровяной объём, мл/кг', min: 40, step: 1, default: 60 },
      { key: 'desired_pcv', label: 'Желаемый PCV', min: 0.1, step: 0.1, default: 25 },
      { key: 'patient_pcv', label: 'Текущий PCV', min: 0.1, step: 0.1, default: 15 },
      { key: 'donor_pcv', label: 'PCV донора', min: 0.1, step: 0.1, default: 45 },
    ],
    compute: ({ weight_kg, blood_volume, desired_pcv, patient_pcv, donor_pcv }) => {
      const volume = Number(weight_kg || 0) * Number(blood_volume || 0) * ((Number(desired_pcv || 0) - Number(patient_pcv || 0)) / Number(donor_pcv || 1));
      return {
        result: {
          transfusion_volume_ml: volume.toFixed(1),
        },
        explanation: 'Справочный расчёт для оценки объёма. Тактика зависит от пациента и компонента крови.',
      };
    },
  },
  {
    id: 'local_bsa',
    name: 'Площадь поверхности тела',
    description: 'BSA для расчётов, где нужен ориентир по поверхности тела.',
    category: 'monitoring',
    allowed_roles: ['vet', 'clinic_admin'],
    inputs: [{ key: 'weight_kg', label: 'Вес, кг', min: 0.1, step: 0.1, default: 5 }],
    compute: ({ weight_kg }) => {
      const bsa = (10.1 * Math.pow(Number(weight_kg || 0), 2 / 3)) / 100;
      return {
        result: {
          bsa_m2: bsa.toFixed(3),
        },
        explanation: 'Справочный показатель BSA. Используйте только в рамках клинических протоколов.',
      };
    },
  },
  {
    id: 'local_gir',
    name: 'Скорость инфузии глюкозы',
    description: 'GIR для оценки глюкозной нагрузки при инфузии.',
    category: 'monitoring',
    allowed_roles: ['vet', 'clinic_admin'],
    inputs: [
      { key: 'dextrose_percent', label: 'Dextrose %', min: 0.1, step: 0.1, default: 5 },
      { key: 'infusion_rate_ml_hr', label: 'Скорость, мл/ч', min: 0.1, step: 0.1, default: 10 },
      { key: 'weight_kg', label: 'Вес, кг', min: 0.1, step: 0.1, default: 5 },
    ],
    compute: ({ dextrose_percent, infusion_rate_ml_hr, weight_kg }) => {
      const gir = (Number(dextrose_percent || 0) * Number(infusion_rate_ml_hr || 0) * 1000) / (Number(weight_kg || 1) * 60);
      return {
        result: {
          gir_mg_kg_min: gir.toFixed(2),
        },
        explanation: 'GIR помогает быстро оценить нагрузку глюкозой в текущем режиме инфузии.',
      };
    },
  },
  {
    id: 'local_drip_rate',
    name: 'Капли в минуту',
    description: 'Расчёт капель в минуту по объёму, времени и drop factor.',
    category: 'emergency',
    allowed_roles: ['vet', 'clinic_admin'],
    inputs: [
      { key: 'volume_ml', label: 'Объём, мл', min: 1, step: 1, default: 100 },
      { key: 'drop_factor', label: 'Капельный коэффициент', min: 1, step: 1, default: 20 },
      { key: 'time_min', label: 'Время, мин', min: 1, step: 1, default: 60 },
    ],
    compute: ({ volume_ml, drop_factor, time_min }) => {
      const drops = (Number(volume_ml || 0) * Number(drop_factor || 0)) / Number(time_min || 1);
      return {
        result: {
          drops_per_min: drops.toFixed(1),
        },
        explanation: 'Полезно для быстрой bedside-проверки темпа инфузии.',
      };
    },
  },
  {
    id: 'local_shock_dose',
    name: 'Шоковый объём',
    description: 'Справочный ориентир по виду животного.',
    category: 'emergency',
    allowed_roles: ['vet', 'clinic_admin'],
    inputs: [
      { key: 'species', label: 'Вид', options: ['dog', 'cat'], default: 'dog' },
      { key: 'weight_kg', label: 'Вес, кг', min: 0.1, step: 0.1, default: 5 },
    ],
    compute: ({ species, weight_kg }) => {
      const perKg = species === 'cat' ? 60 : 90;
      const total = perKg * Number(weight_kg || 0);
      return {
        result: {
          shock_dose_ml_kg: perKg,
          total_shock_volume_ml: total.toFixed(1),
        },
        explanation: 'Это справочный ориентир, а не автоматическая тактика инфузии.',
      };
    },
  },
  {
    id: 'local_hr_reference',
    name: 'Ориентир ЧСС',
    description: 'Ориентир по ЧСС для bedside-контроля.',
    category: 'monitoring',
    allowed_roles: ['owner', 'vet', 'clinic_admin'],
    inputs: [{ key: 'species', label: 'Вид', options: ['dog', 'cat', 'rabbit'], default: 'dog' }],
    compute: ({ species }) => {
      const ranges = {
        dog: '60–140 уд/мин',
        cat: '140–220 уд/мин',
        rabbit: '180–300 уд/мин',
      };
      return {
        result: {
          reference_range: ranges[species] || ranges.dog,
        },
        explanation: 'Это ориентир. Интерпретируйте ЧСС в контексте возраста, стресса, температуры и боли.',
      };
    },
  },
  {
    id: 'local_rr_reference',
    name: 'Ориентир дыхания',
    description: 'Ориентир по частоте дыхания в покое.',
    category: 'monitoring',
    allowed_roles: ['owner', 'vet', 'clinic_admin'],
    inputs: [{ key: 'species', label: 'Вид', options: ['dog', 'cat', 'rabbit'], default: 'dog' }],
    compute: ({ species }) => {
      const ranges = {
        dog: '10–30 дыханий/мин',
        cat: '16–40 дыханий/мин',
        rabbit: '30–60 дыханий/мин',
      };
      return {
        result: {
          reference_range: ranges[species] || ranges.dog,
        },
        explanation: 'Если есть выраженная одышка, дыхание с открытым ртом или заметное усилие дыхания — это уже срочный сигнал.',
      };
    },
  },
  {
    id: 'local_pet_age',
    name: 'Возраст питомца → human age',
    description: 'Условный домашний пересчёт возраста.',
    category: 'monitoring',
    allowed_roles: ['owner', 'vet', 'clinic_admin'],
    inputs: [
      { key: 'species', label: 'Вид', options: ['dog', 'cat'], default: 'dog' },
      { key: 'age_years', label: 'Возраст, лет', min: 0.1, step: 0.1, default: 4 },
    ],
    compute: ({ species, age_years }) => {
      const age = Number(age_years || 0);
      const humanAge = species === 'cat' ? 24 + Math.max(age - 2, 0) * 4 : 21 + Math.max(age - 2, 0) * 5;
      return {
        result: {
          estimated_human_age: Math.round(humanAge),
        },
        explanation: 'Популярный бытовой ориентир, не клинический показатель.',
      };
    },
  },
  {
    id: 'local_body_condition',
    name: 'Body condition index',
    description: 'Компактный индекс для owner/vet наблюдения за кондицией.',
    category: 'monitoring',
    allowed_roles: ['owner', 'vet', 'clinic_admin'],
    inputs: [
      { key: 'weight_kg', label: 'Вес, кг', min: 0.1, step: 0.1, default: 5 },
      { key: 'body_length_cm', label: 'Длина корпуса, см', min: 5, step: 0.1, default: 45 },
    ],
    compute: ({ weight_kg, body_length_cm }) => {
      const index = Number(weight_kg || 0) / Math.pow(Number(body_length_cm || 1) / 100, 2);
      let interpretation = 'сбалансированная кондиция';
      if (index < 16) interpretation = 'возможна недостаточная кондиция';
      if (index > 26) interpretation = 'возможен избыток массы';
      return {
        result: {
          body_condition_index: index.toFixed(1),
          interpretation,
        },
        explanation: 'Условный индекс для owner/vet наблюдения. Не заменяет BCS по врачу.',
      };
    },
  },
  {
    id: 'local_anesthesia_volume',
    name: 'Анестезия: расчёт объёма',
    description: 'Формульный расчёт объёма по mg/kg и концентрации.',
    category: 'dosing',
    allowed_roles: ['vet', 'clinic_admin'],
    inputs: [
      { key: 'weight_kg', label: 'Вес, кг', min: 0.1, step: 0.1, default: 5 },
      { key: 'dose_mg_kg', label: 'Доза, мг/кг', min: 0.01, step: 0.01, default: 0.2 },
      { key: 'concentration_mg_ml', label: 'Концентрация, мг/мл', min: 0.01, step: 0.01, default: 5 },
    ],
    compute: ({ weight_kg, dose_mg_kg, concentration_mg_ml }) => {
      const totalMg = Number(weight_kg || 0) * Number(dose_mg_kg || 0);
      const volumeMl = totalMg / Number(concentration_mg_ml || 1);
      return {
        result: {
          total_mg: totalMg.toFixed(2),
          volume_ml: volumeMl.toFixed(2),
        },
        explanation: 'Математический расчёт для анестезиологической подготовки. Использовать в рамках клинического протокола.',
        warning: 'Подтверждайте протокол, статус ASA и сопутствующие риски перед финальным решением.',
      };
    },
  },
];

function formatValue(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function formatMetricLabel(key) {
  const map = {
    rer_kcal_day: 'RER, ккал/сут',
    der_kcal_day: 'DER, ккал/сут',
    total_mg: 'Всего, мг',
    volume_ml: 'Объём, мл',
    maintenance_ml: 'Поддержка, мл',
    dehydration_deficit_ml: 'Дефицит, мл',
    total_fluid_ml: 'Итог, мл',
    rate_ml_hr: 'Скорость, мл/ч',
    transfusion_volume_ml: 'Объём трансфузии, мл',
    bsa_m2: 'BSA, м²',
    gir_mg_kg_min: 'GIR, мг/кг/мин',
    drops_per_min: 'Капель в минуту',
    shock_dose_ml_kg: 'Шоковый объём, мл/кг',
    total_shock_volume_ml: 'Общий объём, мл',
    reference_range: 'Ориентир',
    estimated_human_age: 'Возраст в человеческих годах',
    body_condition_index: 'Индекс кондиции',
    interpretation: 'Интерпретация',
  };
  return map[key] || key.replaceAll('_', ' ');
}

function resolveCategoryMeta(category) {
  return CATEGORY_META[category] || {
    title: category || 'Прочее',
    subtitle: 'Справочные и вычислительные инструменты.',
  };
}

function normalizeInputs(calc) {
  const defaults = {};
  (calc.inputs || []).forEach((input) => {
    defaults[input.key] = String(input.default ?? input.options?.[0] ?? '');
  });
  return defaults;
}

export default function CalculatorSuite({ embedded = false, title = 'Клинические калькуляторы', preferredTool = '' }) {
  const [apiCalculators, setApiCalculators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCalc, setActiveCalc] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [running, setRunning] = useState(false);

  const session = getStoredSession();
  const currentRole = session.role || 'owner';
  const calculators = useMemo(() => {
    const merged = [...LOCAL_CALCULATORS, ...apiCalculators];
    return currentRole === 'owner'
      ? merged.filter((calc) => Array.isArray(calc.allowed_roles) && calc.allowed_roles.includes('owner'))
      : merged;
  }, [apiCalculators, currentRole]);

  const grouped = useMemo(() => {
    return calculators.reduce((acc, item) => {
      const category = item.category || 'other';
      acc[category] = acc[category] || [];
      acc[category].push(item);
      return acc;
    }, {});
  }, [calculators]);

  const referenceCards = currentRole === 'owner' ? TOOL_REFERENCE_GROUPS.owner : TOOL_REFERENCE_GROUPS.clinical;

  function openCalculator(calc) {
    setActiveCalc(calc);
    setResult(null);
    setSubmitError('');
    setFormValues(normalizeInputs(calc));
  }

  async function loadCalculators() {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest('/api/v1/calculators');
      const rows = Array.isArray(payload?.items) ? payload.items : [];
      setApiCalculators(rows);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить калькуляторы');
      setApiCalculators([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCalculators();
  }, []);

  useEffect(() => {
    if (!preferredTool || !calculators.length || activeCalc) return;
    const lower = String(preferredTool).toLowerCase();
    const match = calculators.find((item) => {
      const id = String(item.id || '').toLowerCase();
      const name = String(item.name || '').toLowerCase();
      return id === lower || id.includes(lower) || name.includes(lower);
    });
    if (match) {
      openCalculator(match);
    }
  }, [activeCalc, calculators, preferredTool]);

  async function runCalculator(event) {
    event.preventDefault();
    if (!activeCalc) return;
    setRunning(true);
    setSubmitError('');
    setResult(null);
    try {
      const numericInputs = {};
      Object.entries(formValues).forEach(([key, value]) => {
        const parsed = Number(String(value).replace(',', '.'));
        numericInputs[key] = Number.isFinite(parsed) && String(value).trim() !== '' ? parsed : value;
      });

      if (typeof activeCalc.compute === 'function') {
        const localResult = activeCalc.compute(numericInputs);
        setResult(localResult);
      } else {
        const payload = await apiRequest('/api/v1/calculators/run', {
          method: 'POST',
          body: {
            calculator_id: activeCalc.id,
            inputs: numericInputs,
          },
        });
        setResult(payload);
      }
    } catch (requestError) {
      setSubmitError(requestError.message || 'Не удалось выполнить расчёт');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      {!embedded ? (
        <header className="page-header">
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">
              Единый центр безопасных и клинических расчётов: формулы, API-калькуляторы, справочники и отдельный экстренный блок.
            </p>
          </div>
        </header>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <Card title="Каталог инструментов" subtitle="Быстрые переходы по ключевым справочникам и полезным рабочим сценариям">
          <div className="grid gap-3 md:grid-cols-2">
            {referenceCards.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-2xl border border-lapka-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-card">
                <p className="text-lg font-black text-lapka-900">{item.title}</p>
                <p className="mt-2 text-sm text-lapka-700">{item.text}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Экстренный блок" subtitle="Под рукой в критическом сценарии">
          <div className="space-y-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Эти расчёты и напоминания — только опора для команды. Они не заменяют клиническое решение и не создают автоматическое назначение.
            </div>
            <ul className="space-y-2">
              {REANIMATION_CHECKLIST.map((item) => (
                <li key={item} className="rounded-2xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </section>

      {error ? <ErrorBanner message={error} onRetry={loadCalculators} /> : null}

      {loading ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </section>
      ) : calculators.length === 0 ? (
        <EmptyState title="Калькуляторы недоступны" text="Попробуйте обновить страницу или войти под ролью врача." />
      ) : (
        <section className="space-y-4">
          {Object.entries(grouped).map(([category, rows]) => {
            const meta = resolveCategoryMeta(category);
            return (
              <Card key={category} title={meta.title} subtitle={meta.subtitle}>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {rows.map((calc) => (
                    <article
                      key={calc.id}
                      className="rounded-2xl border border-lapka-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-card"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-lg font-extrabold text-lapka-900">{calc.name}</p>
                        <span className="pill text-[11px]">{calc.compute ? 'локально' : 'api'}</span>
                      </div>
                      <p className="mt-2 text-sm text-lapka-600">{calc.description}</p>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-lapka-500">{calc.allowed_roles?.join(' / ') || 'все роли'}</span>
                        <button type="button" className="btn-primary" onClick={() => openCalculator(calc)}>
                          Открыть расчёт
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {activeCalc ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-lapka-900/45 p-4 backdrop-blur-sm">
          <div className="surface-card w-full max-w-3xl p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-lapka-900">{activeCalc.name}</h2>
                <p className="text-sm text-lapka-600">{activeCalc.description}</p>
              </div>
              <button className="btn-secondary" type="button" onClick={() => setActiveCalc(null)}>
                Закрыть
              </button>
            </div>

            <form className="space-y-4" onSubmit={runCalculator}>
              <div className="grid gap-3 sm:grid-cols-2">
                {(activeCalc.inputs || []).map((input) => (
                  <label className="block" key={input.key}>
                    <span className="label">{input.label}</span>
                    {input.options ? (
                      <select
                        className="input"
                        value={formValues[input.key] ?? ''}
                        onChange={(event) =>
                          setFormValues((prev) => ({
                            ...prev,
                            [input.key]: event.target.value,
                          }))
                        }
                      >
                        {input.options.map((option) => (
                          <option value={option} key={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="input"
                        type="number"
                        step={input.step || 'any'}
                        min={input.min}
                        max={input.max}
                        value={formValues[input.key] ?? ''}
                        onChange={(event) =>
                          setFormValues((prev) => ({
                            ...prev,
                            [input.key]: event.target.value,
                          }))
                        }
                      />
                    )}
                  </label>
                ))}
              </div>

              {submitError ? <ErrorBanner message={submitError} /> : null}

              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" type="submit" disabled={running}>
                  {running ? 'Расчёт...' : 'Рассчитать'}
                </button>
                <button className="btn-secondary" type="button" onClick={() => setResult(null)}>
                  Очистить результат
                </button>
              </div>

              {result ? (
                <div className="space-y-3 rounded-2xl border border-lapka-200 bg-lapka-50 p-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(result.result || {}).map(([key, value]) => (
                      <div key={key} className="rounded-xl border border-lapka-200 bg-white px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-lapka-500">{formatMetricLabel(key)}</p>
                        <p className="mt-1 text-base font-semibold text-lapka-900">{formatValue(value)}</p>
                      </div>
                    ))}
                  </div>
                  {result.explanation ? (
                    <p className="text-sm text-lapka-700">
                      <span className="font-semibold text-lapka-900">Пояснение: </span>
                      {result.explanation}
                    </p>
                  ) : null}
                  {result.warning ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {result.warning}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
