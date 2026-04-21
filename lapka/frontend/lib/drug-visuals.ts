interface Drug {
  name: string;
  activeSubstance: string;
  group: string;
  thumbnailUrl: string;
  images: string[];
}

const CURATED_DRUGS: Record<string, Drug> = {
  'препарат 1': {
    name: 'Амоксициллин',
    activeSubstance: 'Амоксициллин',
    group: 'Антибиотик',
    thumbnailUrl: '/assets/img/drugs/packshots/amoxicillin.svg',
    images: ['/assets/img/drugs/packshots/amoxicillin.svg', '/assets/img/drugs/pack-01.svg'],
  },
  амоксициллин: {
    name: 'Амоксициллин',
    activeSubstance: 'Амоксициллин',
    group: 'Антибиотик',
    thumbnailUrl: '/assets/img/drugs/packshots/amoxicillin.svg',
    images: ['/assets/img/drugs/packshots/amoxicillin.svg', '/assets/img/drugs/pack-01.svg'],
  },
  'препарат 2': {
    name: 'Мелоксикам',
    activeSubstance: 'Мелоксикам',
    group: 'НПВС',
    thumbnailUrl: '/assets/img/drugs/packshots/meloxicam.svg',
    images: ['/assets/img/drugs/packshots/meloxicam.svg', '/assets/img/drugs/pack-02.svg'],
  },
  мелоксикам: {
    name: 'Мелоксикам',
    activeSubstance: 'Мелоксикам',
    group: 'НПВС',
    thumbnailUrl: '/assets/img/drugs/packshots/meloxicam.svg',
    images: ['/assets/img/drugs/packshots/meloxicam.svg', '/assets/img/drugs/pack-02.svg'],
  },
  'препарат 3': {
    name: 'Маропитант',
    activeSubstance: 'Маропитант',
    group: 'Противорвотный',
    thumbnailUrl: '/assets/img/drugs/packshots/maropitant.svg',
    images: ['/assets/img/drugs/packshots/maropitant.svg', '/assets/img/drugs/pack-03.svg'],
  },
  маропитант: {
    name: 'Маропитант',
    activeSubstance: 'Маропитант',
    group: 'Противорвотный',
    thumbnailUrl: '/assets/img/drugs/packshots/maropitant.svg',
    images: ['/assets/img/drugs/packshots/maropitant.svg', '/assets/img/drugs/pack-03.svg'],
  },
  'препарат 4': {
    name: 'Преднизолон',
    activeSubstance: 'Преднизолон',
    group: 'Глюкокортикостероид',
    thumbnailUrl: '/assets/img/drugs/packshots/prednisolone.svg',
    images: ['/assets/img/drugs/packshots/prednisolone.svg', '/assets/img/drugs/pack-04.svg'],
  },
  преднизолон: {
    name: 'Преднизолон',
    activeSubstance: 'Преднизолон',
    group: 'Глюкокортикостероид',
    thumbnailUrl: '/assets/img/drugs/packshots/prednisolone.svg',
    images: ['/assets/img/drugs/packshots/prednisolone.svg', '/assets/img/drugs/pack-04.svg'],
  },
  'препарат 5': {
    name: 'Фуросемид',
    activeSubstance: 'Фуросемид',
    group: 'Диуретик',
    thumbnailUrl: '/assets/img/drugs/packshots/furosemide.svg',
    images: ['/assets/img/drugs/packshots/furosemide.svg', '/assets/img/drugs/pack-05.svg'],
  },
  фуросемид: {
    name: 'Фуросемид',
    activeSubstance: 'Фуросемид',
    group: 'Диуретик',
    thumbnailUrl: '/assets/img/drugs/packshots/furosemide.svg',
    images: ['/assets/img/drugs/packshots/furosemide.svg', '/assets/img/drugs/pack-05.svg'],
  },
  'препарат 6': {
    name: 'Омепразол',
    activeSubstance: 'Омепразол',
    group: 'Гастропротектор',
    thumbnailUrl: '/assets/img/drugs/packshots/omeprazole.svg',
    images: ['/assets/img/drugs/packshots/omeprazole.svg', '/assets/img/drugs/pack-06.svg'],
  },
  омепразол: {
    name: 'Омепразол',
    activeSubstance: 'Омепразол',
    group: 'Гастропротектор',
    thumbnailUrl: '/assets/img/drugs/packshots/omeprazole.svg',
    images: ['/assets/img/drugs/packshots/omeprazole.svg', '/assets/img/drugs/pack-06.svg'],
  },
};

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function getDrugPresentation(drug?: Record<string, unknown> | null): Drug {
  if (!drug || typeof drug !== 'object') {
    return {
      name: '',
      activeSubstance: '',
      group: '',
      thumbnailUrl: '/assets/img/drugs/pack-01.svg',
      images: ['/assets/img/drugs/pack-01.svg'],
    };
  }

  const rawName = normalize(drug.name);
  const rawActiveSubstance = normalize(drug.active_substance as string);
  const curated = CURATED_DRUGS[rawName] || CURATED_DRUGS[rawActiveSubstance];

  return {
    name: curated?.name || (drug.name as string) || '',
    activeSubstance: curated?.activeSubstance || (drug.active_substance as string) || '',
    group: curated?.group || (drug.group as string) || '',
    thumbnailUrl: curated?.thumbnailUrl || (drug.thumbnail_url as string) || '/assets/img/drugs/pack-01.svg',
    images: curated?.images || ((drug.images as string[]) || [drug.thumbnail_url as string]) || ['/assets/img/drugs/pack-01.svg'],
  };
}