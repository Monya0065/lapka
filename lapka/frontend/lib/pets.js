// Repo currently ships SVG assets under `/assets/img/*`.
// Keep all visual fallbacks pointed to existing files to avoid broken images.
const FALLBACK_CAT = '/assets/img/pet-cat.svg';
const FALLBACK_DOG = '/assets/img/pet-barsik.svg';
const FALLBACK_GENERIC = FALLBACK_CAT;

const SPECIES_ALIASES = {
  cat: 'cat',
  feline: 'cat',
  кошка: 'cat',
  кот: 'cat',
  dog: 'dog',
  canine: 'dog',
  собака: 'dog',
  rabbit: 'rabbit',
  кролик: 'rabbit',
  guinea_pig: 'guinea_pig',
  'guinea pig': 'guinea_pig',
  'морская свинка': 'guinea_pig',
  ferret: 'ferret',
  хорек: 'ferret',
  'хорёк': 'ferret',
  parrot: 'parrot',
  попугай: 'parrot',
  bird: 'bird',
  птица: 'bird',
};

const BREED_ALIASES = {
  'british shorthair': 'british_shorthair',
  'британец': 'british_shorthair',
  'британская короткошёрстная': 'british_shorthair',
  siberian: 'siberian',
  'сибирская': 'siberian',
  'scottish fold': 'scottish_fold',
  'шотландская вислоухая': 'scottish_fold',
  labrador: 'labrador',
  лабрадор: 'labrador',
  'european shorthair': 'european_shorthair',
  'европейская короткошёрстная': 'european_shorthair',
  'jack russell terrier': 'jack_russell_terrier',
  'джек-рассел-терьер': 'jack_russell_terrier',
  'maine coon': 'maine_coon',
  'мейн-кун': 'maine_coon',
  corgi: 'corgi',
  корги: 'corgi',
  'golden retriever': 'golden_retriever',
  'золотистый ретривер': 'golden_retriever',
  'jack russell terrier': 'jack_russell_terrier',
  'джек-рассел-терьер': 'jack_russell_terrier',
  'shiba inu': 'shiba_inu',
  'сиба-ину': 'shiba_inu',
  mixed: 'mixed',
  метис: 'mixed',
};

const BREED_VISUALS = {
  british_shorthair: FALLBACK_CAT,
  siberian: FALLBACK_CAT,
  scottish_fold: FALLBACK_CAT,
  labrador: FALLBACK_DOG,
  maine_coon: FALLBACK_CAT,
  corgi: FALLBACK_DOG,
  jack_russell_terrier: FALLBACK_DOG,
  golden_retriever: FALLBACK_DOG,
  shiba_inu: FALLBACK_DOG,
  european_shorthair: FALLBACK_CAT,
  mixed: FALLBACK_GENERIC,
};

const BREED_ILLUSTRATIONS = {
  // If 3D illustrations are not shipped, fall back to the same SVGs.
  british_shorthair: FALLBACK_CAT,
  siberian: FALLBACK_CAT,
  scottish_fold: FALLBACK_CAT,
  labrador: FALLBACK_DOG,
  maine_coon: FALLBACK_CAT,
  corgi: FALLBACK_DOG,
  jack_russell_terrier: FALLBACK_DOG,
  golden_retriever: FALLBACK_DOG,
  shiba_inu: FALLBACK_DOG,
  european_shorthair: FALLBACK_CAT,
  mixed: FALLBACK_GENERIC,
};

const SPECIES_VISUALS = {
  cat: [
    FALLBACK_CAT,
  ],
  dog: [
    FALLBACK_DOG,
  ],
  rabbit: FALLBACK_DOG,
  guinea_pig: FALLBACK_GENERIC,
  ferret: FALLBACK_GENERIC,
  parrot: FALLBACK_GENERIC,
  bird: FALLBACK_GENERIC,
};

const SPECIES_ILLUSTRATIONS = {
  cat: [
    FALLBACK_CAT,
  ],
  dog: [
    FALLBACK_DOG,
  ],
  rabbit: FALLBACK_DOG,
  guinea_pig: FALLBACK_GENERIC,
  ferret: FALLBACK_GENERIC,
  parrot: FALLBACK_GENERIC,
  bird: FALLBACK_GENERIC,
};

const CLINIC_NAME_VISUALS = {
  'ветсеть': '/assets/img/clinics/demo-cover.svg',
  'мвц двасердца': '/assets/img/clinics/moscow-specialty-cover.svg',
  'ветеринарная клиника ветус': '/assets/img/clinics/riga-family-cover.svg',
  'ветеринарный центр пульс': '/assets/img/clinics/helsinki-emergency-cover.svg',
  'ветеринарная клиника вега': '/assets/img/clinics/demo-cover.svg',
  'ветеринарный госпиталь прайд': '/assets/img/clinics/demo-cover.svg',
};

const CLINIC_GALLERY_VISUALS = {
  'ветсеть': [
    '/assets/img/clinics/demo-cover.svg',
    '/assets/img/clinic-ops.svg',
    '/assets/img/card-history.svg',
  ],
  'мвц двасердца': [
    '/assets/img/clinics/moscow-specialty-cover.svg',
    '/assets/img/clinic-ops.svg',
    '/assets/img/card-history.svg',
  ],
  'ветеринарная клиника ветус': [
    '/assets/img/clinics/riga-family-cover.svg',
    '/assets/img/clinic-ops.svg',
    '/assets/img/card-history.svg',
  ],
  'ветеринарный центр пульс': [
    '/assets/img/clinics/helsinki-emergency-cover.svg',
    '/assets/img/clinic-ops.svg',
    '/assets/img/card-history.svg',
  ],
  'ветеринарная клиника вега': [
    '/assets/img/clinics/demo-cover.svg',
    '/assets/img/clinic-ops.svg',
    '/assets/img/card-history.svg',
  ],
  'ветеринарный госпиталь прайд': [
    '/assets/img/clinics/demo-cover.svg',
    '/assets/img/clinic-ops.svg',
    '/assets/img/card-history.svg',
  ],
};

const VET_SPECIALTY_VISUALS = {
  'кардиология': '/assets/img/vets/vet-cardiology.svg',
  'визуальная диагностика': '/assets/img/vets/vet-diagnostics.svg',
  'узи': '/assets/img/vets/vet-diagnostics.svg',
  'терапия': '/assets/img/vets/vet-therapy.svg',
  'неврология': '/assets/img/vets/vet-diagnostics.svg',
  'дерматология': '/assets/img/vets/vet-dermatology.svg',
  'стационар': '/assets/img/vets/vet-intensive.svg',
  'интенсивная терапия': '/assets/img/vets/vet-intensive.svg',
  'хирургия': '/assets/img/vets/vet-surgery.svg',
};

function resolveLanguage(language = 'ru') {
  return String(language || 'ru').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function isTrustedLocalAsset(candidate) {
  return typeof candidate === 'string' && candidate.startsWith('/assets/');
}

export function isLocalAssetUrl(candidate) {
  return isTrustedLocalAsset(candidate);
}

function isUserProvidedImage(candidate) {
  return typeof candidate === 'string' && (candidate.startsWith('data:') || candidate.startsWith('blob:'));
}

function isPlaceholderRemoteImage(candidate) {
  if (typeof candidate !== 'string') return false;
  return [
    'picsum.photos',
    'placehold.co',
    'via.placeholder.com',
    'dummyimage.com',
  ].some((pattern) => candidate.includes(pattern));
}

function hashString(input) {
  const value = String(input || '');
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickSpeciesVisual(speciesKey, seedSource) {
  const visual = SPECIES_VISUALS[speciesKey];
  if (Array.isArray(visual)) {
    return visual[hashString(seedSource) % visual.length];
  }
  return visual || FALLBACK_GENERIC;
}

function pickSpeciesIllustration(speciesKey, seedSource) {
  const visual = SPECIES_ILLUSTRATIONS[speciesKey];
  if (Array.isArray(visual)) {
    return visual[hashString(seedSource) % visual.length];
  }
  return visual || '/assets/illustrations/pets/cat-generic-3d.svg';
}

export function resolvePetPhoto(pet) {
  if (!pet || typeof pet !== 'object') return FALLBACK_GENERIC;

  const candidate = pet.photo_url || pet.photo_ref || pet.photo_data_url || pet.avatar_url || pet.image_url;
  if (typeof candidate === 'string' && candidate.trim()) {
    const normalizedCandidate = candidate.trim();
    if (isUserProvidedImage(normalizedCandidate) || isTrustedLocalAsset(normalizedCandidate)) {
      return normalizedCandidate;
    }
    if (!isPlaceholderRemoteImage(normalizedCandidate)) {
      return normalizedCandidate;
    }
  }

  const breedKey = BREED_ALIASES[normalizeValue(pet.breed)];
  if (breedKey && BREED_VISUALS[breedKey]) return BREED_VISUALS[breedKey];

  const speciesKey = SPECIES_ALIASES[normalizeValue(pet.species)];
  if (speciesKey && SPECIES_VISUALS[speciesKey]) return pickSpeciesVisual(speciesKey, pet.lapka_id || pet.chip_id || pet.name);

  const species = String(pet.species || '').toLowerCase();
  if (species.includes('dog') || species.includes('собак')) return pickSpeciesVisual('dog', pet.lapka_id || pet.chip_id || pet.name);
  if (species.includes('cat') || species.includes('кот')) return pickSpeciesVisual('cat', pet.lapka_id || pet.chip_id || pet.name);
  return FALLBACK_GENERIC;
}

export function resolvePetIllustration(pet) {
  if (!pet || typeof pet !== 'object') return '/assets/illustrations/pets/cat-generic-3d.svg';

  const breedKey = BREED_ALIASES[normalizeValue(pet.breed)];
  if (breedKey && BREED_ILLUSTRATIONS[breedKey]) return BREED_ILLUSTRATIONS[breedKey];

  const speciesKey = SPECIES_ALIASES[normalizeValue(pet.species)];
  if (speciesKey && SPECIES_ILLUSTRATIONS[speciesKey]) {
    return pickSpeciesIllustration(speciesKey, pet.lapka_id || pet.chip_id || pet.name);
  }

  const species = String(pet.species || '').toLowerCase();
  if (species.includes('dog') || species.includes('собак')) return pickSpeciesIllustration('dog', pet.lapka_id || pet.chip_id || pet.name);
  if (species.includes('cat') || species.includes('кот')) return pickSpeciesIllustration('cat', pet.lapka_id || pet.chip_id || pet.name);
  return '/assets/illustrations/pets/cat-generic-3d.svg';
}

export function resolveBreedReferencePhoto(pet) {
  if (!pet || typeof pet !== 'object') return resolvePetPhoto(pet);
  const breedKey = BREED_ALIASES[normalizeValue(pet.breed)];
  if (breedKey && BREED_VISUALS[breedKey]) return BREED_VISUALS[breedKey];
  const speciesKey = SPECIES_ALIASES[normalizeValue(pet.species)];
  if (speciesKey && SPECIES_VISUALS[speciesKey]) return pickSpeciesVisual(speciesKey, pet.lapka_id || pet.chip_id || pet.name);
  return resolvePetPhoto(pet);
}

export function buildPetVisualGallery(pet, language = 'ru') {
  const lang = resolveLanguage(language);
  const photo = resolvePetPhoto(pet);
  const breedPhoto = resolveBreedReferencePhoto(pet);
  const illustration = resolvePetIllustration(pet);
  const items = [
    {
      id: 'photo',
      label: lang === 'ru' ? 'Фото питомца' : 'Pet photo',
      src: photo,
      type: 'photo',
    },
    {
      id: 'breed-photo',
      label: lang === 'ru' ? 'Породное фото' : 'Breed photo',
      src: breedPhoto,
      type: 'photo',
    },
    {
      id: 'illustration',
      label: lang === 'ru' ? '3D-визуал' : '3D visual',
      src: illustration,
      type: 'illustration',
    },
  ];
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.type}:${item.src}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveClinicPhoto(clinic) {
  if (!clinic || typeof clinic !== 'object') return '/assets/photos/clinics/spb-core-cover-photo.jpg';
  const candidate = clinic.photos?.[0] || clinic.photo_url || clinic.logo_url;
  if (typeof candidate === 'string' && candidate.trim()) {
    const normalizedCandidate = candidate.trim();
    if (isUserProvidedImage(normalizedCandidate) || isTrustedLocalAsset(normalizedCandidate)) {
      return normalizedCandidate;
    }
    if (!isPlaceholderRemoteImage(normalizedCandidate)) {
      return normalizedCandidate;
    }
  }
  const mapped = CLINIC_NAME_VISUALS[normalizeValue(clinic.name)];
  if (mapped) return mapped;
  return '/assets/photos/clinics/spb-core-cover-photo.jpg';
}

export function resolveClinicGallery(clinic) {
  if (!clinic || typeof clinic !== 'object') {
    return ['/assets/photos/clinics/spb-core-cover-photo.jpg'];
  }

  const rawPhotos = Array.isArray(clinic.photos)
    ? clinic.photos
    : Array.isArray(clinic.photos_json)
      ? clinic.photos_json
      : [];

  const trustedPhotos = rawPhotos
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim())
    .filter((item) => (
      isUserProvidedImage(item)
      || isTrustedLocalAsset(item)
      || !isPlaceholderRemoteImage(item)
    ));

  if (trustedPhotos.length) {
    return [...new Set(trustedPhotos)];
  }

  const mapped = CLINIC_GALLERY_VISUALS[normalizeValue(clinic.name)];
  if (mapped?.length) return mapped;

  return [resolveClinicPhoto(clinic)];
}

export function buildClinicVisualGallery(clinic, language = 'ru') {
  const lang = resolveLanguage(language);
  const gallery = resolveClinicGallery(clinic);
  const primary = resolveClinicPhoto(clinic);
  const unique = [...new Set([primary, ...gallery])];
  const labels = lang === 'ru'
    ? ['Фасад клиники', 'Интерьер', 'Ресепшн', 'Дополнительное фото']
    : ['Clinic exterior', 'Interior', 'Reception', 'Additional photo'];
  const descriptions = lang === 'ru'
    ? [
        'Главный визуальный ориентир клиники: фасад или основная обложка профиля.',
        'Интерьер помогает понять атмосферу и формат приёма внутри клиники.',
        'Ресепшн и входная зона важны для оценки логистики первого визита.',
        'Дополнительный ракурс показывает клинику без перегруженного каталожного вида.',
      ]
    : [
        'Primary clinic cover used as the main visual anchor.',
        'Interior view helps assess the environment before booking.',
        'Reception view shows the arrival and check-in zone.',
        'Additional angle provides more context around the clinic.',
      ];

  return unique.slice(0, 4).map((src, index) => ({
    id: `clinic-photo-${index + 1}`,
    label: labels[index] || labels[labels.length - 1],
    src,
    description: descriptions[index] || descriptions[descriptions.length - 1],
    alt: clinic?.name ? `${clinic.name} — ${labels[index] || labels[labels.length - 1]}` : labels[index] || labels[labels.length - 1],
  }));
}

export function resolveVetPhoto(vet) {
  if (!vet || typeof vet !== 'object') return '/assets/photos/vets/vet-therapy-photo.jpg';
  const candidate = vet.photo_url || vet.avatar_url || vet.image_url;
  if (typeof candidate === 'string' && candidate.trim()) {
    const normalizedCandidate = candidate.trim();
    if (isUserProvidedImage(normalizedCandidate) || isTrustedLocalAsset(normalizedCandidate)) {
      return normalizedCandidate;
    }
    if (!isPlaceholderRemoteImage(normalizedCandidate)) {
      return normalizedCandidate;
    }
  }
  const specialtyMapped = VET_SPECIALTY_VISUALS[normalizeValue(vet.specialty)];
  if (specialtyMapped) return specialtyMapped;
  return '/assets/photos/vets/vet-therapy-photo.jpg';
}

export function buildVetVisualGallery(vet, language = 'ru') {
  const lang = resolveLanguage(language);
  const portrait = resolveVetPhoto(vet);
  const clinicGallery = resolveClinicGallery(vet?.clinic);
  const labels = lang === 'ru'
    ? ['Портрет врача', 'Клиника', 'Ресепшн']
    : ['Vet portrait', 'Clinic', 'Reception'];
  const descriptions = lang === 'ru'
    ? [
        'Основной портрет врача в профиле и в карточках поиска.',
        'Фото клиники показывает среду, в которой проходит приём.',
        'Ресепшн помогает понять логистику и уровень сервиса перед записью.',
      ]
    : [
        'Primary portrait used across vet profile and search cards.',
        'Clinic photo provides the context of the visit environment.',
        'Reception preview helps assess arrival and service level.',
      ];

  const items = [portrait, ...clinicGallery].slice(0, 3);
  return items.map((src, index) => ({
    id: `vet-photo-${index + 1}`,
    label: labels[index] || labels[labels.length - 1],
    src,
    description: descriptions[index] || descriptions[descriptions.length - 1],
    alt: vet?.full_name ? `${vet.full_name} — ${labels[index] || labels[labels.length - 1]}` : labels[index] || labels[labels.length - 1],
  }));
}

export function localizePetSpecies(species, language = 'ru') {
  const lang = resolveLanguage(language);
  const raw = String(species || '').trim();
  if (!raw) return lang === 'ru' ? 'Не указан' : 'Not specified';

  const normalized = normalizeValue(raw);
  const key = SPECIES_ALIASES[normalized];

  if (!key) return raw;

  const labels = {
    ru: {
      cat: 'Кот',
      dog: 'Собака',
      rabbit: 'Кролик',
      guinea_pig: 'Морская свинка',
      ferret: 'Хорёк',
      parrot: 'Попугай',
      bird: 'Птица',
    },
    en: {
      cat: 'Cat',
      dog: 'Dog',
      rabbit: 'Rabbit',
      guinea_pig: 'Guinea pig',
      ferret: 'Ferret',
      parrot: 'Parrot',
      bird: 'Bird',
    },
  };

  return labels[lang][key] || raw;
}

export function localizePetBreed(breed, language = 'ru') {
  const lang = resolveLanguage(language);
  const raw = String(breed || '').trim();
  if (!raw) return lang === 'ru' ? 'Не указана' : 'Not specified';

  const normalized = normalizeValue(raw);
  const key = BREED_ALIASES[normalized];

  if (!key) return raw;

  const labels = {
    ru: {
      british_shorthair: 'Британская короткошёрстная',
      siberian: 'Сибирская',
      scottish_fold: 'Шотландская вислоухая',
      labrador: 'Лабрадор',
      european_shorthair: 'Европейская короткошёрстная',
      jack_russell_terrier: 'Джек-рассел-терьер',
      maine_coon: 'Мейн-кун',
      corgi: 'Корги',
      golden_retriever: 'Золотистый ретривер',
      mixed: 'Метис',
    },
    en: {
      british_shorthair: 'British Shorthair',
      siberian: 'Siberian',
      scottish_fold: 'Scottish Fold',
      labrador: 'Labrador',
      european_shorthair: 'European Shorthair',
      jack_russell_terrier: 'Jack Russell Terrier',
      maine_coon: 'Maine Coon',
      corgi: 'Corgi',
      golden_retriever: 'Golden Retriever',
      mixed: 'Mixed breed',
    },
  };

  return labels[lang][key] || raw;
}

export function localizeDocumentType(type, language = 'ru') {
  const lang = resolveLanguage(language);
  const raw = String(type || '').trim();
  if (!raw) return lang === 'ru' ? 'Документ' : 'Document';

  const normalized = normalizeValue(raw).replace(/\s+/g, '_');
  const labels = {
    ru: {
      blood_test: 'Общий анализ крови',
      biochemistry: 'Биохимия',
      xray: 'Рентген',
      ultrasound: 'УЗИ',
      discharge: 'Выписка',
      photo: 'Фото',
      lab_result: 'Результат лаборатории',
    },
    en: {
      blood_test: 'Complete blood count',
      biochemistry: 'Biochemistry',
      xray: 'X-ray',
      ultrasound: 'Ultrasound',
      discharge: 'Discharge summary',
      photo: 'Photo',
      lab_result: 'Lab result',
    },
  };

  return labels[lang][normalized] || raw;
}

export function localizeServiceType(type, language = 'ru') {
  const lang = resolveLanguage(language);
  const raw = String(type || '').trim();
  if (!raw) return lang === 'ru' ? 'Приём' : 'Visit';

  const normalized = normalizeValue(raw).replace(/\s+/g, '_');
  const labels = {
    ru: {
      consultation: 'Консультация',
      vaccination: 'Вакцинация',
      ultrasound: 'УЗИ',
      surgery_consult: 'Консультация хирурга',
      telemedicine: 'Телемедицина',
      video_consultation: 'Видеоконсультация',
    },
    en: {
      consultation: 'Consultation',
      vaccination: 'Vaccination',
      ultrasound: 'Ultrasound',
      surgery_consult: 'Surgical consultation',
      telemedicine: 'Telemedicine',
      video_consultation: 'Video consultation',
    },
  };

  return labels[lang][normalized] || raw;
}

export function localizeReminderType(type, language = 'ru') {
  const lang = resolveLanguage(language);
  const raw = String(type || '').trim();
  if (!raw) return lang === 'ru' ? 'Напоминание' : 'Reminder';

  const normalized = normalizeValue(raw).replace(/\s+/g, '_');
  const labels = {
    ru: {
      vaccine: 'Вакцинация',
      checkup: 'Контрольный визит',
      medication: 'Лекарство',
      appointment: 'Запись',
      reminder: 'Напоминание',
    },
    en: {
      vaccine: 'Vaccination',
      checkup: 'Checkup visit',
      medication: 'Medication',
      appointment: 'Appointment',
      reminder: 'Reminder',
    },
  };

  return labels[lang][normalized] || raw;
}

export function localizeVisitType(type, language = 'ru') {
  const lang = resolveLanguage(language);
  const raw = String(type || '').trim();
  if (!raw) return lang === 'ru' ? 'Очный визит' : 'In-clinic visit';

  const normalized = normalizeValue(raw).replace(/\s+/g, '_');
  const labels = {
    ru: {
      clinic_visit: 'Очный визит',
      video_consultation: 'Видеоконсультация',
      telemedicine: 'Телемедицина',
    },
    en: {
      clinic_visit: 'In-clinic visit',
      video_consultation: 'Video consultation',
      telemedicine: 'Telemedicine',
    },
  };

  return labels[lang][normalized] || raw;
}

export function localizePetSex(sex, language = 'ru') {
  const lang = resolveLanguage(language);
  const raw = String(sex || '').trim();
  if (!raw) return lang === 'ru' ? 'Не указан' : 'Not specified';

  const normalized = normalizeValue(raw);
  const labels = {
    ru: {
      male: 'Самец',
      female: 'Самка',
      m: 'Самец',
      f: 'Самка',
      boy: 'Самец',
      girl: 'Самка',
      самец: 'Самец',
      самка: 'Самка',
    },
    en: {
      male: 'Male',
      female: 'Female',
      m: 'Male',
      f: 'Female',
      boy: 'Male',
      girl: 'Female',
      самец: 'Male',
      самка: 'Female',
    },
  };

  return labels[lang][normalized] || raw;
}

export function formatPetAge(birthDate, language = 'ru') {
  const lang = resolveLanguage(language);
  if (!birthDate) return lang === 'ru' ? 'Не указан' : 'Not specified';

  const dt = new Date(birthDate);
  if (Number.isNaN(dt.getTime())) return lang === 'ru' ? 'Не указан' : 'Not specified';

  const now = new Date();
  let years = now.getFullYear() - dt.getFullYear();
  let months = now.getMonth() - dt.getMonth();

  if (now.getDate() < dt.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (lang === 'ru') {
    if (years > 0 && months > 0) return `${years} г ${months} мес`;
    if (years > 0) return `${years} г`;
    if (months > 0) return `${months} мес`;
    return 'Меньше месяца';
  }

  if (years > 0 && months > 0) return `${years} y ${months} mo`;
  if (years > 0) return `${years} y`;
  if (months > 0) return `${months} mo`;
  return 'Less than a month';
}
