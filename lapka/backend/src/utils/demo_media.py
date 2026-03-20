from __future__ import annotations


SPECIES_ALIASES = {
    "cat": "cat",
    "feline": "cat",
    "кошка": "cat",
    "кот": "cat",
    "dog": "dog",
    "canine": "dog",
    "собака": "dog",
    "rabbit": "rabbit",
    "кролик": "rabbit",
    "guinea pig": "guinea_pig",
    "guinea_pig": "guinea_pig",
    "морская свинка": "guinea_pig",
    "ferret": "ferret",
    "хорек": "ferret",
    "хорёк": "ferret",
    "bird": "bird",
    "parrot": "bird",
    "попугай": "bird",
    "птица": "bird",
}

BREED_ALIASES = {
    "british shorthair": "british_shorthair",
    "британец": "british_shorthair",
    "британская короткошёрстная": "british_shorthair",
    "siberian": "siberian",
    "сибирская": "siberian",
    "scottish fold": "scottish_fold",
    "шотландская вислоухая": "scottish_fold",
    "labrador": "labrador",
    "лабрадор": "labrador",
    "maine coon": "maine_coon",
    "мейн-кун": "maine_coon",
    "corgi": "corgi",
    "корги": "corgi",
    "jack russell terrier": "jack_russell_terrier",
    "джек-рассел-терьер": "jack_russell_terrier",
    "golden retriever": "golden_retriever",
    "золотистый ретривер": "golden_retriever",
    "shiba inu": "shiba_inu",
    "сиба-ину": "shiba_inu",
}

BREED_VISUALS = {
    "british_shorthair": "/assets/photos/pets/cat-british-photo.jpg",
    "siberian": "/assets/photos/pets/cat-siberian-photo.jpg",
    "scottish_fold": "/assets/photos/pets/cat-scottish-photo.jpg",
    "labrador": "/assets/photos/pets/dog-labrador-photo.jpg",
    "maine_coon": "/assets/photos/pets/cat-mainecoon-photo.jpg",
    "corgi": "/assets/photos/pets/dog-corgi-photo.jpg",
    "jack_russell_terrier": "/assets/photos/pets/dog-jackrussell-photo.jpg",
    "golden_retriever": "/assets/photos/pets/dog-golden-photo.jpg",
    "shiba_inu": "/assets/photos/pets/dog-shiba-photo.jpg",
}

SPECIES_VISUALS = {
    "cat": [
        "/assets/photos/pets/cat-generic-photo.jpg",
        "/assets/photos/pets/cat-british-photo.jpg",
        "/assets/photos/pets/cat-siberian-photo.jpg",
        "/assets/photos/pets/cat-scottish-photo.jpg",
        "/assets/photos/pets/cat-mainecoon-photo.jpg",
    ],
    "dog": [
        "/assets/photos/pets/dog-labrador-photo.jpg",
        "/assets/photos/pets/dog-corgi-photo.jpg",
        "/assets/photos/pets/dog-jackrussell-photo.jpg",
        "/assets/photos/pets/dog-golden-photo.jpg",
        "/assets/photos/pets/dog-shiba-photo.jpg",
        "/assets/photos/pets/dog-labrador-photo.jpg",
    ],
    "rabbit": "/assets/photos/pets/rabbit-photo.jpg",
    "guinea_pig": "/assets/photos/pets/guinea-pig-photo.jpg",
    "ferret": "/assets/photos/pets/ferret-photo.jpg",
    "bird": "/assets/photos/pets/bird-photo.jpg",
}

CLINIC_NAME_VISUALS = {
    "ветсеть": "/assets/photos/clinics/spb-core-cover-photo.jpg",
    "мвц двасердца": "/assets/photos/clinics/duocor-cover-photo.jpg",
    "ветеринарная клиника ветус": "/assets/photos/clinics/vetus-cover-photo.jpg",
    "ветеринарный центр пульс": "/assets/photos/clinics/pulse-cover-photo.jpg",
    "ветеринарная клиника вега": "/assets/photos/clinics/vega-cover-photo.jpg",
    "ветеринарный госпиталь прайд": "/assets/photos/clinics/pride-cover-photo.jpg",
}

CLINIC_GALLERY_VISUALS = {
    "ветсеть": [
        "/assets/photos/clinics/spb-core-cover-photo.jpg",
        "/assets/photos/clinics/clinic-interior-photo.jpg",
        "/assets/photos/clinics/clinic-reception-photo.jpg",
    ],
    "мвц двасердца": [
        "/assets/photos/clinics/duocor-cover-photo.jpg",
        "/assets/photos/clinics/clinic-interior-photo.jpg",
        "/assets/photos/clinics/clinic-reception-photo.jpg",
    ],
    "ветеринарная клиника ветус": [
        "/assets/photos/clinics/vetus-cover-photo.jpg",
        "/assets/photos/clinics/clinic-interior-photo.jpg",
        "/assets/photos/clinics/clinic-reception-photo.jpg",
    ],
    "ветеринарный центр пульс": [
        "/assets/photos/clinics/pulse-cover-photo.jpg",
        "/assets/photos/clinics/clinic-interior-photo.jpg",
        "/assets/photos/clinics/clinic-reception-photo.jpg",
    ],
    "ветеринарная клиника вега": [
        "/assets/photos/clinics/vega-cover-photo.jpg",
        "/assets/photos/clinics/clinic-interior-photo.jpg",
        "/assets/photos/clinics/clinic-reception-photo.jpg",
    ],
    "ветеринарный госпиталь прайд": [
        "/assets/photos/clinics/pride-cover-photo.jpg",
        "/assets/photos/clinics/clinic-interior-photo.jpg",
        "/assets/photos/clinics/clinic-reception-photo.jpg",
    ],
}

VET_SPECIALTY_VISUALS = {
    "кардиология": "/assets/photos/vets/vet-cardiology-photo.jpg",
    "визуальная диагностика": "/assets/photos/vets/vet-diagnostics-photo.jpg",
    "узи": "/assets/photos/vets/vet-ultrasound-photo.jpg",
    "терапия": "/assets/photos/vets/vet-therapy-photo.jpg",
    "неврология": "/assets/photos/vets/vet-neurology-photo.jpg",
    "дерматология": "/assets/photos/vets/vet-dermatology-photo.jpg",
    "стационар": "/assets/photos/vets/vet-inpatient-photo.jpg",
    "интенсивная терапия": "/assets/photos/vets/vet-intensive-photo.jpg",
    "хирургия": "/assets/photos/vets/vet-surgery-photo.jpg",
}

CLINIC_VISUAL = "/assets/photos/clinics/spb-core-cover-photo.jpg"
VET_VISUAL = "/assets/photos/vets/vet-therapy-photo.jpg"


def _normalize(value: str | None) -> str:
    return str(value or "").strip().lower()


def _is_user_provided_photo(photo_url: str | None) -> bool:
    if not photo_url:
        return False
    return photo_url.startswith("data:") or photo_url.startswith("blob:") or photo_url.startswith("/assets/")


def _is_placeholder_remote_photo(photo_url: str | None) -> bool:
    if not photo_url:
        return False
    return any(
        pattern in photo_url
        for pattern in (
            "picsum.photos",
            "placehold.co",
            "via.placeholder.com",
            "dummyimage.com",
        )
    )


def _pick_species_visual(species_key: str, seed_index: int | None = None) -> str:
    visual = SPECIES_VISUALS.get(species_key)
    if isinstance(visual, list):
        index = int(seed_index or 0) % len(visual)
        return visual[index]
    return visual or "/assets/photos/pets/cat-generic-photo.jpg"


def resolve_demo_pet_photo(*, species: str | None, breed: str | None, photo_url: str | None = None, seed_index: int | None = None) -> str:
    if photo_url and _is_user_provided_photo(photo_url):
        return photo_url
    if photo_url and not _is_placeholder_remote_photo(photo_url):
        return photo_url

    breed_key = BREED_ALIASES.get(_normalize(breed))
    if breed_key and breed_key in BREED_VISUALS:
        return BREED_VISUALS[breed_key]

    species_key = SPECIES_ALIASES.get(_normalize(species))
    if species_key and species_key in SPECIES_VISUALS:
        return _pick_species_visual(species_key, seed_index)

    raw_species = _normalize(species)
    if "dog" in raw_species or "собак" in raw_species:
        return _pick_species_visual("dog", seed_index)
    if "cat" in raw_species or "кот" in raw_species:
        return _pick_species_visual("cat", seed_index)
    return _pick_species_visual("cat", seed_index)


def resolve_demo_clinic_photo(*, clinic_name: str | None = None, photos: list[str] | None = None, photo_url: str | None = None, logo_url: str | None = None) -> str:
    for candidate in [*(photos or []), photo_url, logo_url]:
        if candidate and _is_user_provided_photo(candidate):
            return candidate
        if candidate and not _is_placeholder_remote_photo(candidate):
            return candidate
    visual = CLINIC_NAME_VISUALS.get(_normalize(clinic_name))
    if visual:
        return visual
    return CLINIC_VISUAL


def resolve_demo_clinic_gallery(*, clinic_name: str | None = None) -> list[str]:
    gallery = CLINIC_GALLERY_VISUALS.get(_normalize(clinic_name))
    if gallery:
        return list(gallery)
    return [CLINIC_VISUAL, "/assets/photos/clinics/clinic-interior-photo.jpg", "/assets/photos/clinics/clinic-reception-photo.jpg"]


def resolve_demo_vet_photo(*, specialty: str | None = None, photo_url: str | None = None) -> str:
    if photo_url and _is_user_provided_photo(photo_url):
        return photo_url
    if photo_url and not _is_placeholder_remote_photo(photo_url):
        return photo_url
    specialty_visual = VET_SPECIALTY_VISUALS.get(_normalize(specialty))
    if specialty_visual:
        return specialty_visual
    return VET_VISUAL
