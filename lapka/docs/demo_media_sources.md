# Demo Media And Clinic Sources

Last updated: 2026-03-12

## What is a real photo vs illustration

- Real local photos used by the app live in:
  - `frontend/public/assets/photos/pets`
  - `frontend/public/assets/photos/clinics`
  - `frontend/public/assets/photos/vets`
- Decorative 3D or icon-style visuals live in:
  - `frontend/public/assets/illustrations/pets`

The app uses:
- `resolvePetPhoto()` for real photo-first rendering
- `resolvePetIllustration()` only for explicit `3D` mode or decorative blocks

## St. Petersburg clinic data used in the demo

The demo marketplace and places layer use real clinic names and public contact data where available.

### Ветеринарная клиника Ветус
- Website: [https://www.vetusklinika.ru](https://www.vetusklinika.ru)
- Seeded address: `Санкт-Петербург, ул. Веденеева, 12, к. 4`
- Seeded branch: `Санкт-Петербург, Выборгское шоссе, 17, к. 4`
- Seeded phones:
  - `+7 (812) 296-67-96`
  - `+7 (812) 920-77-97`

### Ветеринарный центр Пульс
- Website: [https://pulsvet.spb.ru](https://pulsvet.spb.ru)
- Seeded address: `Санкт-Петербург, Планерная улица, 63, корп. 1`
- Seeded branch: `Санкт-Петербург, просп. Ветеранов, 166`
- Seeded phones:
  - `+7 (931) 103-42-24`
  - `+7 (921) 642-24-03`

### МВЦ ДваСердца
- Website: [https://duocor.ru](https://duocor.ru)
- Seeded address: `Санкт-Петербург, ул. Львовская, 10`
- Seeded branch: `Санкт-Петербург, ул. Голландская, 23`
- Seeded phone:
  - `+7 (812) 407-17-19`

### Ветеринарная клиника Вега
- Website: [https://vegavet.spb.ru](https://vegavet.spb.ru)
- Seeded address: `Санкт-Петербург, ул. Пулковская, 11, корп. 1`
- Seeded branch: `Санкт-Петербург, пр. Художников, 26`
- Seeded phones:
  - `+7 (812) 499-77-01`
  - `+7 (812) 499-77-18`

### Ветеринарный госпиталь Прайд
- Website: [https://oncovet.ru](https://oncovet.ru)
- Seeded address: `Санкт-Петербург, ул. Ильюшина, 3, корп. 1`
- Seeded branch: `Санкт-Петербург, ул. Минеральная, 32`
- Seeded phone:
  - `+7 (812) 679-29-78`

### ВетСеть
- Demo uses a real clinic-style SPB entry with local cover photo and public-facing contact card.
- Seeded address: `Санкт-Петербург, ул. Зайцева, д. 3а`
- Seeded hours: `24/7`
- This entry should be treated as a curated demo listing until a stricter official-source pass is completed.

## Pet photo pack

Breed-specific local photo pack currently used:

- `cat-british-photo.jpg`
- `cat-siberian-photo.jpg`
- `cat-scottish-photo.jpg`
- `cat-mainecoon-photo.jpg`
- `dog-labrador-photo.jpg`
- `dog-corgi-photo.jpg`
- `dog-jackrussell-photo.jpg`
- `dog-golden-photo.jpg`
- `dog-shiba-photo.jpg`

Species fallback pack:

- `cat-generic-photo.jpg`
- `rabbit-photo.jpg`
- `guinea-pig-photo.jpg`
- `ferret-photo.jpg`
- `bird-photo.jpg`

## Clinic and vet photo pack

Clinic local covers:

- `spb-core-cover-photo.jpg`
- `vetus-cover-photo.jpg`
- `pulse-cover-photo.jpg`
- `duocor-cover-photo.jpg`
- `vega-cover-photo.jpg`
- `pride-cover-photo.jpg`
- `clinic-interior-photo.jpg`
- `clinic-reception-photo.jpg`

Vet local portraits:

- `vet-cardiology-photo.jpg`
- `vet-dermatology-photo.jpg`
- `vet-diagnostics-photo.jpg`
- `vet-inpatient-photo.jpg`
- `vet-intensive-photo.jpg`
- `vet-neurology-photo.jpg`
- `vet-surgery-photo.jpg`
- `vet-therapy-photo.jpg`
- `vet-ultrasound-photo.jpg`

## Important note

This demo now separates:
- real local photos for photo-first UX
- decorative SVG illustrations for optional 3D/illustration mode

The goal is to avoid mixing decorative assets with real-photo slots in owner, clinic, vet, and marketplace views.
