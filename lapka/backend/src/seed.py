from __future__ import annotations

import asyncio
import hashlib
import json
import random
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select, text

from src.db.session import AsyncSessionLocal
from src.models import (
    AIBudget,
    AIClinicOverride,
    AILimit,
    AIModel,
    AIPolicy,
    AIProvider,
    AIPrompt,
    AIPromptVersion,
    AIRolePolicy,
    AIRoute,
    AITenantOverride,
    AIUsageLog,
    Appointment,
    AppointmentStatus,
    AppointmentType,
    AuditEvent,
    Camera,
    ClinicService,
    ClinicServiceCategory,
    Clinic,
    ClinicInvite,
    ClinicInviteStatus,
    ClinicLocation,
    ClinicResource,
    ClinicalProtocol,
    ConsentGrant,
    ConsentRequest,
    ConsentRequestStatus,
    ConsentScope,
    Disease,
    Document,
    Drug,
    DrugAnalog,
    DrugImage,
    DrugVariant,
    DrugWarning,
    DoctorSchedule,
    InpatientObservation,
    InpatientEvent,
    InpatientEventType,
    InpatientPhotoReport,
    InpatientPlan,
    InpatientPublicStatus,
    InpatientStatus,
    InpatientStay,
    InsuranceClaim,
    InsuranceClaimStatus,
    InsurancePolicy,
    InsurancePolicyStatus,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    LabOrder,
    LabOrderStatus,
    LabProvider,
    LabResult,
    LostPetReport,
    LostPetSighting,
    LostPetStatus,
    MasterPet,
    Membership,
    MembershipStatus,
    Notification,
    NotificationType,
    OnlineOffer,
    OnlineStore,
    OwnerShoppingListItem,
    Pharmacy,
    PharmacyInventory,
    PharmacyLocation,
    PharmacyType,
    Place,
    PlaceType,
    PetOwnerLink,
    PetQrToken,
    PriceSnapshot,
    Prescription,
    PublicLink,
    PetPassport,
    Payment,
    PaymentStatus,
    Reminder,
    ReminderType,
    Referral,
    ReferralStatus,
    RatingsSummary,
    Review,
    ReviewModerationStatus,
    ReviewTargetType,
    RoleEnum,
    Service,
    Symptom,
    Substitution,
    Template,
    User,
    VetProfile,
    VaccineEntry,
    Visit,
    VisitStatus,
)
from src.security.passwords import hash_password
from src.services.catalog import get_diseases as get_catalog_diseases
from src.services.catalog import get_symptoms as get_catalog_symptoms
from src.services.catalog import get_drugs as get_catalog_drugs
from src.services.marketplace import recalculate_ratings_summary
from src.utils.demo_media import resolve_demo_clinic_gallery, resolve_demo_clinic_photo, resolve_demo_pet_photo, resolve_demo_vet_photo

DEMO_IDS = {
    "clinic": uuid.UUID("11111111-1111-1111-1111-111111111111"),
    "owner_user": uuid.UUID("22222222-2222-2222-2222-222222222222"),
    "vet_user": uuid.UUID("33333333-3333-3333-3333-333333333333"),
    "admin_user": uuid.UUID("44444444-4444-4444-4444-444444444444"),
    "platform_user": uuid.UUID("45454545-4545-4545-4545-454545454545"),
    "barsik_pet": uuid.UUID("55555555-5555-5555-5555-555555555555"),
    "barsik_visit": uuid.UUID("66666666-6666-6666-6666-666666666666"),
    "barsik_stay": uuid.UUID("77777777-7777-7777-7777-777777777777"),
    "max_pet": uuid.UUID("88888888-8888-8888-8888-888888888888"),
    "bella_pet": uuid.UUID("99999999-9999-9999-9999-999999999999"),
    "appt_barsik": uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
    "appt_video_barsik": uuid.UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
    "appt_checkup_max": uuid.UUID("ffffffff-ffff-ffff-ffff-ffffffffffff"),
    "appt_type_clinic": uuid.UUID("12121212-1212-1212-1212-121212121212"),
    "appt_type_video": uuid.UUID("13131313-1313-1313-1313-131313131313"),
    "appt_type_vaccine": uuid.UUID("14141414-1414-1414-1414-141414141414"),
    "template_main": uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
    "review_main": uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
    "public_doc_link": uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd"),
}

PLACES_SEED = [
    ("ВетСеть", PlaceType.clinic, "Санкт-Петербург", 59.8794, 30.2616, "ул. Зайцева, д. 3а", "24/7"),
    ("Ветеринарная клиника Ветус", PlaceType.clinic, "Санкт-Петербург", 60.0208, 30.3813, "ул. Веденеева, 12, к. 4", "24/7"),
    ("Ветеринарный центр Пульс", PlaceType.emergency_clinic, "Санкт-Петербург", 60.0214, 30.2074, "Планерная улица, 63, корп. 1", "круглосуточно"),
    ("МВЦ ДваСердца", PlaceType.emergency_clinic, "Санкт-Петербург", 59.9688, 30.4036, "ул. Львовская, 10", "круглосуточно"),
    ("Ветеринарная клиника Вега", PlaceType.clinic, "Санкт-Петербург", 59.8509, 30.3487, "ул. Пулковская, 11, корп. 1", "24/7"),
    ("Ветеринарный госпиталь Прайд", PlaceType.emergency_clinic, "Санкт-Петербург", 60.0084, 30.2578, "ул. Ильюшина, 3, корп. 1", "круглосуточно"),
    ("ВетАптека Питомец+", PlaceType.pharmacy, "Санкт-Петербург", 59.9315, 30.3482, "Литейный проспект, 61", "09:00-22:00"),
    ("Аптека Хвост и Лапы", PlaceType.pharmacy, "Санкт-Петербург", 59.9385, 30.3158, "Большой проспект П.С., 29", "10:00-22:00"),
    ("Таврический сад", PlaceType.park, "Санкт-Петербург", 59.9488, 30.3812, "Таврическая улица, 2", "06:00-23:00"),
    ("Приморский парк Победы", PlaceType.park, "Санкт-Петербург", 59.9709, 30.2454, "Крестовский проспект, 23", "круглосуточно"),
    ("Pet Store Невский", PlaceType.pet_store, "Санкт-Петербург", 59.9357, 30.3255, "Невский проспект, 114", "10:00-22:00"),
    ("Pet Store Петроградка", PlaceType.pet_store, "Санкт-Петербург", 59.9651, 30.3084, "Каменноостровский проспект, 42", "10:00-22:00"),
]

NETWORK_CLINIC_SPECS = [
    {
        "slug": "vetus",
        "name": "Ветеринарная клиника Ветус",
        "address": "Санкт-Петербург, ул. Веденеева, 12, к. 4",
        "description": "Круглосуточная петербургская клиника с несколькими филиалами, диагностикой и стационарным контуром.",
        "city": "Санкт-Петербург",
        "latitude": 60.0208,
        "longitude": 30.3813,
        "hours": "24/7",
        "phone": "+7 (812) 296-67-96",
        "website": "https://www.vetusklinika.ru",
        "emergency_available": True,
        "price_level": "medium",
        "logo_url": "/assets/photos/clinics/vetus-cover-photo.jpg",
        "photos_json": [
            "/assets/photos/clinics/vetus-cover-photo.jpg",
            "/assets/photos/clinics/clinic-interior-photo.jpg",
            "/assets/photos/clinics/clinic-reception-photo.jpg",
        ],
        "branch": {
            "address": "Санкт-Петербург, Выборгское шоссе, 17, к. 4",
            "city": "Санкт-Петербург",
            "latitude": 60.0478,
            "longitude": 30.3141,
            "hours": "24/7",
            "phone": "+7 (812) 920-77-97",
        },
        "admin": {"name": "Мария Белова", "email": "admin.vetus@lapka.local", "phone": "+78122966796"},
        "vets": [
            {"name": "Дмитрий Фадеев", "email": "vet.vetus.1@lapka.local", "phone": "+79100001001", "specialty": "Кардиология", "experience": 9},
            {"name": "Нина Романова", "email": "vet.vetus.2@lapka.local", "phone": "+79100001002", "specialty": "Визуальная диагностика", "experience": 7},
        ],
    },
    {
        "slug": "pulse",
        "name": "Ветеринарный центр Пульс",
        "address": "Санкт-Петербург, Планерная улица, 63, корп. 1",
        "description": "Клиника Санкт-Петербурга с круглосуточным форматом, хирургией, стационаром и owner-facing обновлениями.",
        "city": "Санкт-Петербург",
        "latitude": 60.0214,
        "longitude": 30.2074,
        "hours": "круглосуточно",
        "phone": "+7 (931) 103-42-24",
        "website": "https://pulsvet.spb.ru",
        "emergency_available": True,
        "price_level": "medium",
        "logo_url": "/assets/photos/clinics/pulse-cover-photo.jpg",
        "photos_json": [
            "/assets/photos/clinics/pulse-cover-photo.jpg",
            "/assets/photos/clinics/clinic-interior-photo.jpg",
            "/assets/photos/clinics/clinic-reception-photo.jpg",
        ],
        "branch": {
            "address": "Санкт-Петербург, просп. Ветеранов, 166",
            "city": "Санкт-Петербург",
            "latitude": 59.8341,
            "longitude": 30.1261,
            "hours": "10:00-21:00",
            "phone": "+7 (921) 642-24-03",
        },
        "admin": {"name": "Анна Козлова", "email": "admin.pulse@lapka.local", "phone": "+79311034224"},
        "vets": [
            {"name": "Карина Власова", "email": "vet.pulse.1@lapka.local", "phone": "+79100002001", "specialty": "Терапия", "experience": 8},
            {"name": "Илья Морозов", "email": "vet.pulse.2@lapka.local", "phone": "+79100002002", "specialty": "Дерматология", "experience": 6},
        ],
    },
    {
        "slug": "duocor",
        "name": "МВЦ ДваСердца",
        "address": "Санкт-Петербург, ул. Львовская, 10",
        "description": "Круглосуточный многопрофильный ветеринарный центр с интенсивной терапией, хирургией и стационаром.",
        "city": "Санкт-Петербург",
        "latitude": 59.9688,
        "longitude": 30.4036,
        "hours": "24/7",
        "phone": "+7 (812) 407-17-19",
        "website": "https://duocor.ru",
        "emergency_available": True,
        "price_level": "high",
        "logo_url": "/assets/photos/clinics/duocor-cover-photo.jpg",
        "photos_json": [
            "/assets/photos/clinics/duocor-cover-photo.jpg",
            "/assets/photos/clinics/clinic-interior-photo.jpg",
            "/assets/photos/clinics/clinic-reception-photo.jpg",
        ],
        "branch": {
            "address": "Санкт-Петербург, ул. Голландская, 23",
            "city": "Санкт-Петербург",
            "latitude": 59.9568,
            "longitude": 30.4171,
            "hours": "24/7",
            "phone": "+7 (812) 407-17-19",
        },
        "admin": {"name": "Елена Дмитриева", "email": "admin.duocor@lapka.local", "phone": "+78124071719"},
        "vets": [
            {"name": "Олег Савельев", "email": "vet.duocor.1@lapka.local", "phone": "+79100003001", "specialty": "Интенсивная терапия", "experience": 11},
            {"name": "Ева Орлова", "email": "vet.duocor.2@lapka.local", "phone": "+79100003002", "specialty": "Хирургия", "experience": 10},
        ],
    },
    {
        "slug": "vega",
        "name": "Ветеринарная клиника Вега",
        "address": "Санкт-Петербург, ул. Пулковская, 11, корп. 1",
        "description": "Многопрофильная ветеринарная клиника Санкт-Петербурга с круглосуточным приёмом, диагностикой и сетью филиалов.",
        "city": "Санкт-Петербург",
        "latitude": 59.8509,
        "longitude": 30.3487,
        "hours": "24/7",
        "phone": "+7 (812) 499-77-01",
        "website": "https://vegavet.spb.ru",
        "emergency_available": True,
        "price_level": "medium",
        "logo_url": "/assets/photos/clinics/vega-cover-photo.jpg",
        "photos_json": [
            "/assets/photos/clinics/vega-cover-photo.jpg",
            "/assets/photos/clinics/clinic-interior-photo.jpg",
            "/assets/photos/clinics/clinic-reception-photo.jpg",
        ],
        "branch": {
            "address": "Санкт-Петербург, пр. Художников, 26",
            "city": "Санкт-Петербург",
            "latitude": 60.0417,
            "longitude": 30.3452,
            "hours": "24/7",
            "phone": "+7 (812) 499-77-18",
        },
        "admin": {"name": "Светлана Жукова", "email": "admin.vega@lapka.local", "phone": "+78124997701"},
        "vets": [
            {"name": "Максим Беляев", "email": "vet.vega.1@lapka.local", "phone": "+79100004001", "specialty": "Терапия", "experience": 9},
            {"name": "Алина Ершова", "email": "vet.vega.2@lapka.local", "phone": "+79100004002", "specialty": "УЗИ/визуальная диагностика", "experience": 8},
        ],
    },
    {
        "slug": "pride",
        "name": "Ветеринарный госпиталь Прайд",
        "address": "Санкт-Петербург, ул. Ильюшина, 3, корп. 1",
        "description": "Круглосуточный ветеринарный госпиталь Санкт-Петербурга с онкологией, стационаром, хирургией и экстренным приёмом.",
        "city": "Санкт-Петербург",
        "latitude": 60.0084,
        "longitude": 30.2578,
        "hours": "круглосуточно",
        "phone": "+7 (812) 679-29-78",
        "website": "https://oncovet.ru",
        "emergency_available": True,
        "price_level": "high",
        "logo_url": "/assets/photos/clinics/pride-cover-photo.jpg",
        "photos_json": [
            "/assets/photos/clinics/pride-cover-photo.jpg",
            "/assets/photos/clinics/clinic-interior-photo.jpg",
            "/assets/photos/clinics/clinic-reception-photo.jpg",
        ],
        "branch": {
            "address": "Санкт-Петербург, ул. Минеральная, 32",
            "city": "Санкт-Петербург",
            "latitude": 59.9728,
            "longitude": 30.3565,
            "hours": "круглосуточно",
            "phone": "+7 (812) 679-29-78",
        },
        "admin": {"name": "Татьяна Голубева", "email": "admin.pride@lapka.local", "phone": "+78126792978"},
        "vets": [
            {"name": "Роман Клименко", "email": "vet.pride.1@lapka.local", "phone": "+79100005001", "specialty": "Онкология", "experience": 10},
            {"name": "Дарья Астахова", "email": "vet.pride.2@lapka.local", "phone": "+79100005002", "specialty": "Хирургия", "experience": 9},
        ],
    },
]

CURATED_MARKET_DRUGS = {
    1: {
        "name": "Амоксициллин",
        "active_substance": "Амоксициллин",
        "group": "антибиотики",
        "forms": ["таблетки", "суспензия", "инъекция"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/amoxicillin.svg",
    },
    2: {
        "name": "Мелоксикам",
        "active_substance": "Мелоксикам",
        "group": "НПВС",
        "forms": ["таблетки", "суспензия", "инъекция"],
        "species": ["собаки", "кошки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/meloxicam.svg",
    },
    3: {
        "name": "Маропитант",
        "active_substance": "Маропитант",
        "group": "противорвотные",
        "forms": ["таблетки", "инъекция"],
        "species": ["собаки", "кошки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/maropitant.svg",
    },
    4: {
        "name": "Преднизолон",
        "active_substance": "Преднизолон",
        "group": "гормоны",
        "forms": ["таблетки", "инъекция"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/prednisolone.svg",
    },
    5: {
        "name": "Фуросемид",
        "active_substance": "Фуросемид",
        "group": "диуретики",
        "forms": ["таблетки", "инъекция"],
        "species": ["собаки", "кошки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/furosemide.svg",
    },
    6: {
        "name": "Омепразол",
        "active_substance": "Омепразол",
        "group": "гастропротекторы",
        "forms": ["капсулы", "суспензия"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/omeprazole.svg",
    },
    7: {
        "name": "Габапентин",
        "active_substance": "Габапентин",
        "group": "противосудорожные",
        "forms": ["капсулы", "раствор"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/gabapentin.svg",
    },
    8: {
        "name": "Доксициклин",
        "active_substance": "Доксициклин",
        "group": "антибиотики",
        "forms": ["таблетки", "суспензия"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/doxycycline.svg",
    },
    9: {
        "name": "Сукральфат",
        "active_substance": "Сукральфат",
        "group": "гастропротекторы",
        "forms": ["суспензия", "таблетки"],
        "species": ["кошки", "собаки"],
        "prescription_required": False,
        "thumbnail": "/assets/img/drugs/packshots/sucralfate.svg",
    },
    10: {
        "name": "Леветирацетам",
        "active_substance": "Леветирацетам",
        "group": "противосудорожные",
        "forms": ["таблетки", "раствор"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/levetiracetam.svg",
    },
    11: {
        "name": "Клопидогрел",
        "active_substance": "Клопидогрел",
        "group": "кардиологические",
        "forms": ["таблетки"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/clopidogrel.svg",
    },
    12: {
        "name": "Адеметионин",
        "active_substance": "Адеметионин",
        "group": "гепатопротекторы",
        "forms": ["таблетки", "инъекция"],
        "species": ["кошки", "собаки"],
        "prescription_required": False,
        "thumbnail": "/assets/img/drugs/packshots/ademetionine.svg",
    },
    13: {
        "name": "Пимобендан",
        "active_substance": "Пимобендан",
        "group": "кардиологические",
        "forms": ["таблетки"],
        "species": ["собаки", "кошки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/pimobendan.svg",
    },
    14: {
        "name": "Энрофлоксацин",
        "active_substance": "Энрофлоксацин",
        "group": "антибиотики",
        "forms": ["таблетки", "суспензия"],
        "species": ["собаки", "кошки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/enrofloxacin.svg",
    },
    15: {
        "name": "Клиндамицин",
        "active_substance": "Клиндамицин",
        "group": "антибиотики",
        "forms": ["капсулы", "суспензия"],
        "species": ["собаки", "кошки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/clindamycin.svg",
    },
    16: {
        "name": "Миртазапин",
        "active_substance": "Миртазапин",
        "group": "нейромодуляторы",
        "forms": ["таблетки"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/mirtazapine.svg",
    },
    17: {
        "name": "Лактулоза",
        "active_substance": "Лактулоза",
        "group": "гастропротекторы",
        "forms": ["раствор", "суспензия"],
        "species": ["кошки", "собаки"],
        "prescription_required": False,
        "thumbnail": "/assets/img/drugs/packshots/lactulose.svg",
    },
    18: {
        "name": "Беназеприл",
        "active_substance": "Беназеприл",
        "group": "кардиологические",
        "forms": ["таблетки"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/benazepril.svg",
    },
    19: {
        "name": "Карпрофен",
        "active_substance": "Карпрофен",
        "group": "НПВС",
        "forms": ["таблетки", "инъекция"],
        "species": ["собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/carprofen.svg",
    },
    20: {
        "name": "Метимазол",
        "active_substance": "Метимазол",
        "group": "эндокринологические",
        "forms": ["таблетки"],
        "species": ["кошки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/methimazole.svg",
    },
    21: {
        "name": "Инсулин гларгин",
        "active_substance": "Инсулин гларгин",
        "group": "эндокринологические",
        "forms": ["раствор"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/insulin-glargine.svg",
    },
    22: {
        "name": "Цефовецин",
        "active_substance": "Цефовецин",
        "group": "антибиотики",
        "forms": ["инъекция"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/cefovecin.svg",
    },
    23: {
        "name": "Урсодезоксихолевая кислота",
        "active_substance": "Урсодезоксихолевая кислота",
        "group": "гепатопротекторы",
        "forms": ["капсулы", "суспензия"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/ursodeoxycholic-acid.svg",
    },
    24: {
        "name": "Дорзоламид",
        "active_substance": "Дорзоламид",
        "group": "офтальмологические",
        "forms": ["капли"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/dorzolamide.svg",
    },
    25: {
        "name": "Тразодон",
        "active_substance": "Тразодон",
        "group": "нейромодуляторы",
        "forms": ["таблетки"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/trazodone.svg",
    },
    26: {
        "name": "Фенобарбитал",
        "active_substance": "Фенобарбитал",
        "group": "противосудорожные",
        "forms": ["таблетки", "раствор"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/phenobarbital.svg",
    },
    27: {
        "name": "Метронидазол",
        "active_substance": "Метронидазол",
        "group": "антибиотики",
        "forms": ["таблетки", "суспензия"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/metronidazole.svg",
    },
    28: {
        "name": "Силденафил",
        "active_substance": "Силденафил",
        "group": "кардиологические",
        "forms": ["таблетки"],
        "species": ["собаки", "кошки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/sildenafil.svg",
    },
    29: {
        "name": "Тобрамицин",
        "active_substance": "Тобрамицин",
        "group": "офтальмологические",
        "forms": ["капли"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/tobramycin.svg",
    },
    30: {
        "name": "Атенолол",
        "active_substance": "Атенолол",
        "group": "кардиологические",
        "forms": ["таблетки"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/atenolol.svg",
    },
    31: {
        "name": "Спиронолактон",
        "active_substance": "Спиронолактон",
        "group": "диуретики",
        "forms": ["таблетки"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/spironolactone.svg",
    },
    32: {
        "name": "Циклоспорин",
        "active_substance": "Циклоспорин",
        "group": "дерматология",
        "forms": ["капсулы", "раствор"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/cyclosporine.svg",
    },
    33: {
        "name": "Оклацитиниб",
        "active_substance": "Оклацитиниб",
        "group": "дерматология",
        "forms": ["таблетки"],
        "species": ["собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/oclacitinib.svg",
    },
    34: {
        "name": "Селамектин",
        "active_substance": "Селамектин",
        "group": "антипаразитарные",
        "forms": ["капли"],
        "species": ["кошки", "собаки"],
        "prescription_required": False,
        "thumbnail": "/assets/img/drugs/packshots/selamectin.svg",
    },
    35: {
        "name": "Флуконазол",
        "active_substance": "Флуконазол",
        "group": "противогрибковые",
        "forms": ["капсулы", "раствор"],
        "species": ["кошки", "собаки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/fluconazole.svg",
    },
    36: {
        "name": "Левотироксин",
        "active_substance": "Левотироксин",
        "group": "эндокринологические",
        "forms": ["таблетки"],
        "species": ["собаки", "кошки"],
        "prescription_required": True,
        "thumbnail": "/assets/img/drugs/packshots/levothyroxine.svg",
    },
}

CLINIC_MARKET_SEED = [
    ("ВетСеть", "ул. Зайцева, д. 3а", 59.8794, 30.2616, True, "medium"),
    ("Ветеринарная клиника Ветус", "ул. Веденеева, 12, к. 4", 60.0208, 30.3813, True, "medium"),
    ("Ветеринарная клиника Ветус", "ул. Есенина, 30, лит. А", 60.0518, 30.3337, True, "medium"),
    ("Ветеринарная клиника Ветус", "Выборгское шоссе, 17, к. 4", 60.0478, 30.3141, True, "medium"),
    ("Ветеринарный центр Пульс", "Планерная улица, 63, корп. 1", 60.0214, 30.2074, True, "medium"),
    ("Ветеринарный центр Пульс", "просп. Ветеранов, 166", 59.8341, 30.1261, False, "medium"),
    ("МВЦ ДваСердца", "ул. Львовская, 10", 59.9688, 30.4036, True, "high"),
    ("МВЦ ДваСердца", "ул. Голландская, 23", 59.9568, 30.4171, True, "high"),
    ("Ветеринарная клиника Вега", "ул. Пулковская, 11, корп. 1", 59.8509, 30.3487, True, "medium"),
    ("Ветеринарная клиника Вега", "пр. Художников, 26", 60.0417, 30.3452, True, "medium"),
    ("Ветеринарный госпиталь Прайд", "ул. Ильюшина, 3, корп. 1", 60.0084, 30.2578, True, "high"),
    ("Ветеринарный госпиталь Прайд", "ул. Минеральная, 32", 59.9728, 30.3565, True, "high"),
]

VET_SPECIALTIES = [
    "Терапия",
    "Хирургия",
    "Дерматология",
    "Кардиология",
    "Неврология",
    "Офтальмология",
    "Анестезиология",
    "Стационар",
    "УЗИ/визуальная диагностика",
    "Ортопедия",
]

VET_LANGUAGES = [
    ["русский"],
    ["русский", "английский"],
    ["русский", "испанский"],
    ["русский", "немецкий"],
]

REVIEW_TITLES = [
    "Очень внимательный приём",
    "Быстро и спокойно",
    "Понравился подход",
    "Чёткая коммуникация",
    "Комфортная клиника",
    "Всё по расписанию",
    "Хороший сервис",
    "Спасибо за поддержку",
]

REVIEW_TEXTS = [
    "Врач подробно объяснил план наблюдения и ответил на все вопросы.",
    "Запись прошла без задержек, персонал вежливый и внимательный.",
    "Удобный формат, после визита всё осталось в цифровой карте.",
    "Клиника чистая, понятная навигация и комфортная зона ожидания.",
    "Хорошая обратная связь после приёма и понятные комментарии в протоколе.",
    "Питомец чувствовал себя спокойно, визит прошёл мягко.",
    "Отличная организация процесса записи и приема.",
    "Понравилось, что есть напоминания и понятный календарь.",
]

SYMPTOM_CATEGORY_MAP = {
    "дыхание": "respiratory",
    "неврология": "neurology",
    "жкт": "gastrointestinal",
    "мочевыделительная": "urinary",
    "мочеиспускание": "urinary",
    "кожа/шерсть": "dermatology",
    "кожа": "dermatology",
    "глаза": "ophthalmology",
    "отравления": "toxicology",
    "травмы": "trauma",
    "общее состояние": "general",
    "общие симптомы": "general",
    "поведение": "general",
    "уши": "general",
    "репродуктивная система": "general",
}

DISEASE_CATEGORY_MAP = {
    "инфекционные": "infectious",
    "паразитарные": "infectious",
    "неврологические": "neurology",
    "кардиологические": "cardiology",
    "гастроэнтерология": "gastroenterology",
    "дерматология": "dermatology",
    "ортопедия": "trauma",
    "онкология": "infectious",
    "эндокринология": "endocrine",
    "токсикология": "toxicology",
    "офтальмология": "ophthalmology",
    "отология": "dermatology",
    "респираторные": "respiratory",
    "дыхание": "respiratory",
    "мочевыделительная": "urinary",
}

DISEASE_SPECIES_MAP = {
    "кошки": "cat",
    "кошка": "cat",
    "cats": "cat",
    "cat": "cat",
    "собаки": "dog",
    "собака": "dog",
    "dogs": "dog",
    "dog": "dog",
    "кролики": "rabbit",
    "кролик": "rabbit",
    "rabbit": "rabbit",
    "хорьки": "ferret",
    "хорек": "ferret",
    "ferret": "ferret",
    "морские свинки": "guinea_pig",
    "guinea pig": "guinea_pig",
    "guinea_pig": "guinea_pig",
    "птицы": "bird",
    "bird": "bird",
}

SYMPTOM_REQUIRED_EXAMPLES = [
    ("seed_symptom_vomiting", "vomiting", "cat,dog", "gastrointestinal", 3, False, "Single or repeated vomiting event."),
    ("seed_symptom_diarrhea", "diarrhea", "cat,dog", "gastrointestinal", 3, False, "Loose stool episode."),
    ("seed_symptom_seizures", "seizures", "cat,dog", "neurology", 5, True, "Convulsive episode requiring urgent assessment."),
    ("seed_symptom_loss_of_appetite", "loss_of_appetite", "cat,dog", "general", 2, False, "Reduced or absent appetite."),
    ("seed_symptom_lethargy", "lethargy", "cat,dog", "general", 3, False, "Low energy and reduced activity."),
    ("seed_symptom_difficulty_breathing", "difficulty_breathing", "cat,dog", "respiratory", 5, True, "Breathing effort is visibly increased."),
    ("seed_symptom_bloody_stool", "bloody_stool", "cat,dog", "gastrointestinal", 4, True, "Visible blood in stool."),
    ("seed_symptom_skin_lesions", "skin_lesions", "cat,dog", "dermatology", 3, False, "Visible lesions on skin."),
    ("seed_symptom_itching", "itching", "cat,dog", "dermatology", 2, False, "Persistent scratching or licking."),
    ("seed_symptom_limping", "limping", "cat,dog", "trauma", 3, False, "Altered gait or reduced limb loading."),
    ("seed_symptom_collapse", "collapse", "cat,dog", "cardiology", 5, True, "Acute collapse episode."),
    ("seed_symptom_excessive_thirst", "excessive_thirst", "cat,dog", "urinary", 3, False, "Notable increase in water intake."),
    ("seed_symptom_frequent_urination", "frequent_urination", "cat,dog", "urinary", 3, False, "Increased urination frequency."),
    ("seed_symptom_eye_discharge", "eye_discharge", "cat,dog", "ophthalmology", 2, False, "Ocular discharge observed."),
    ("seed_symptom_abdominal_pain", "abdominal_pain", "cat,dog", "gastrointestinal", 4, True, "Signs of painful abdomen."),
    ("seed_symptom_paralysis", "paralysis", "cat,dog", "neurology", 5, True, "Loss of voluntary limb movement."),
    ("seed_symptom_fever", "fever", "cat,dog", "general", 3, False, "Elevated body temperature."),
    ("seed_symptom_weight_loss", "weight_loss", "cat,dog", "general", 3, False, "Unintentional body weight decline."),
    ("seed_symptom_swelling", "swelling", "cat,dog", "trauma", 3, False, "Localized swelling or edema."),
    ("seed_symptom_pale_gums", "pale_gums", "cat,dog", "cardiology", 4, True, "Pale mucous membranes."),
]

DISEASE_REQUIRED_EXAMPLES = [
    ("feline_panleukopenia", "Feline panleukopenia", "cat", "infectious", ["seed_symptom_vomiting", "seed_symptom_lethargy", "seed_symptom_fever"], "Viral infectious disease with acute systemic impact.", "RED", "uncommon"),
    ("canine_parvovirus", "Canine parvovirus", "dog", "infectious", ["seed_symptom_vomiting", "seed_symptom_diarrhea", "seed_symptom_lethargy"], "Acute viral gastroenteric disease in dogs.", "RED", "uncommon"),
    ("dermatitis", "Dermatitis", "cat,dog", "dermatology", ["seed_symptom_itching", "seed_symptom_skin_lesions"], "Inflammatory skin condition with irritation.", "YELLOW", "common"),
    ("otitis", "Otitis", "cat,dog", "dermatology", ["symp_07_001", "symp_07_002"], "Inflammatory disease of the ear canal.", "YELLOW", "common"),
    ("diabetes_mellitus", "Diabetes mellitus", "cat,dog", "endocrine", ["seed_symptom_excessive_thirst", "seed_symptom_frequent_urination", "seed_symptom_weight_loss"], "Endocrine metabolic disease with glucose dysregulation.", "YELLOW", "common"),
    ("hyperthyroidism", "Hyperthyroidism", "cat", "endocrine", ["seed_symptom_weight_loss", "seed_symptom_excessive_thirst"], "Endocrine disease linked to excessive thyroid hormone production.", "YELLOW", "common"),
    ("kidney_disease", "Kidney disease", "cat,dog", "urinary", ["seed_symptom_excessive_thirst", "seed_symptom_frequent_urination", "seed_symptom_lethargy"], "Renal condition requiring clinical monitoring.", "YELLOW", "common"),
    ("pancreatitis", "Pancreatitis", "cat,dog", "gastroenterology", ["seed_symptom_vomiting", "seed_symptom_abdominal_pain", "seed_symptom_loss_of_appetite"], "Inflammatory disease of the pancreas.", "RED", "uncommon"),
    ("pneumonia", "Pneumonia", "cat,dog", "respiratory", ["seed_symptom_difficulty_breathing", "symp_01_001", "seed_symptom_fever"], "Lower respiratory inflammatory process.", "RED", "uncommon"),
    ("fracture", "Fracture", "cat,dog", "trauma", ["seed_symptom_limping", "seed_symptom_swelling", "seed_symptom_abdominal_pain"], "Bone trauma with structural disruption.", "RED", "common"),
    ("anemia", "Anemia", "cat,dog", "cardiology", ["seed_symptom_lethargy", "seed_symptom_pale_gums"], "Reduced oxygen-carrying capacity of blood.", "RED", "common"),
    ("conjunctivitis", "Conjunctivitis", "cat,dog", "ophthalmology", ["seed_symptom_eye_discharge"], "Conjunctival inflammation with discharge.", "YELLOW", "common"),
    ("cystitis", "Cystitis", "cat,dog", "urinary", ["seed_symptom_frequent_urination", "symp_04_001"], "Lower urinary tract inflammatory syndrome.", "YELLOW", "common"),
    ("rabies", "Rabies", "cat,dog", "infectious", ["symp_08_001", "seed_symptom_paralysis", "seed_symptom_seizures"], "Severe zoonotic viral disease.", "RED", "rare"),
    ("leptospirosis", "Leptospirosis", "dog", "infectious", ["seed_symptom_fever", "seed_symptom_lethargy", "seed_symptom_vomiting"], "Bacterial infectious disease with systemic impact.", "RED", "uncommon"),
    ("heartworm", "Heartworm disease", "dog", "cardiology", ["seed_symptom_difficulty_breathing", "symp_01_003", "seed_symptom_lethargy"], "Cardiopulmonary parasitic disease.", "RED", "uncommon"),
]

CLINICAL_PROTOCOL_REQUIRED_EXAMPLES = [
    (
        "vomiting_dog_protocol",
        "Протокол рвоты у собаки",
        "dog",
        "gastroenterology",
        "Структурированный первичный протокол для случаев рвоты у собак.",
        [
            "Собрать краткий анамнез: длительность, кратность, связь с кормлением.",
            "Оценить общее состояние, гидратацию и наличие боли.",
            "Проверить red flags: кровь, выраженная слабость, повторная рвота.",
            "Зафиксировать первичный диагностический план и контрольную точку.",
        ],
        False,
    ),
    (
        "vomiting_cat_protocol",
        "Протокол рвоты у кошки",
        "cat",
        "gastroenterology",
        "Структурированный протокол осмотра кошки с жалобой на рвоту.",
        [
            "Уточнить аппетит, питьевой режим и изменения поведения.",
            "Оценить массу тела, гидратацию и признаки абдоминального дискомфорта.",
            "Проверить red flags: частая рвота, кровь, вялость, обезвоживание.",
            "Согласовать с владельцем план наблюдения и повторного контроля.",
        ],
        False,
    ),
    (
        "seizure_management",
        "Судорожный эпизод: первичный алгоритм",
        "cat,dog",
        "emergency",
        "Экстренный чек-лист для первичной стабилизации и документирования судорог.",
        [
            "Зафиксировать длительность эпизода и неврологический статус после приступа.",
            "Оценить дыхание, слизистые и риски повторного эпизода.",
            "Отметить red flags и urgency-маркер визита.",
            "Подготовить план срочного наблюдения и коммуникации с владельцем.",
        ],
        True,
    ),
    (
        "trauma_initial_exam",
        "Травма: первичный осмотр",
        "cat,dog",
        "trauma",
        "Стандарт первичного осмотра пациента при травме.",
        [
            "Провести быстрый ABC-скрининг и зафиксировать витальные показатели.",
            "Оценить болевой синдром и подозрение на переломы/внутренние повреждения.",
            "Проверить наличие кровотечения и неврологических нарушений.",
            "Сформировать последовательность диагностических действий.",
        ],
        True,
    ),
    (
        "dehydration_assessment",
        "Оценка дегидратации",
        "cat,dog",
        "diagnostics",
        "Чек-лист оценки гидратационного статуса без назначения терапии.",
        [
            "Оценить эластичность кожи, слизистые и наполнение капилляров.",
            "Сопоставить клинические признаки с анамнезом потери жидкости.",
            "Зафиксировать степень риска и необходимость наблюдения в клинике.",
            "Добавить рекомендации по динамическому контролю состояния.",
        ],
        False,
    ),
    (
        "anesthesia_precheck",
        "Преданестезиологический чек-лист",
        "cat,dog",
        "anesthesia",
        "Структура предоперационной проверки перед анестезиологическим пособием.",
        [
            "Подтвердить идентификацию пациента и согласие владельца.",
            "Оценить кардио-респираторный риск и сопутствующие факторы.",
            "Проверить полноту обследований и лабораторных данных.",
            "Задокументировать план мониторинга во время вмешательства.",
        ],
        True,
    ),
    (
        "post_surgery_monitoring",
        "Послеоперационный мониторинг",
        "cat,dog",
        "surgery",
        "Регламент наблюдения пациента после хирургического вмешательства.",
        [
            "Проверять витальные показатели и поведенческую реакцию в динамике.",
            "Оценивать состояние операционной области и общий комфорт пациента.",
            "Фиксировать изменения в статусе и время каждого контроля.",
            "Сформировать owner-safe сводку по текущему состоянию.",
        ],
        False,
    ),
    (
        "poisoning_response",
        "Подозрение на отравление: первичный ответ",
        "cat,dog",
        "toxicology",
        "Экстренный протокол документирования и маршрутизации при подозрении на токсикологический случай.",
        [
            "Собрать информацию о возможном веществе и времени контакта.",
            "Оценить текущее состояние: дыхание, сознание, неврологические признаки.",
            "Зафиксировать red flags и urgency RED при критических признаках.",
            "Подготовить быстрый план диагностической верификации в клинике.",
        ],
        True,
    ),
]


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def _get_or_create_user(
    session,
    *,
    id_key: str,
    email: str,
    full_name: str,
    role: RoleEnum,
    phone: str,
):
    user = await session.scalar(select(User).where(User.email == email))
    if user:
        return user
    user = User(
        id=DEMO_IDS[id_key],
        email=email,
        full_name=full_name,
        role=role,
        phone=phone,
        password_hash=hash_password("demo12345"),
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def _get_or_create_pet(
    session,
    *,
    pet_id: uuid.UUID,
    name: str,
    species: str,
    breed: str,
    chip_id: str,
):
    pet = await session.scalar(select(MasterPet).where(MasterPet.id == pet_id))
    if pet:
        return pet
    pet = MasterPet(id=pet_id, name=name, species=species, breed=breed, chip_id=chip_id)
    session.add(pet)
    await session.flush()
    return pet


def _demo_uuid(name: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"lapka-demo-{name}")


async def _upsert_clinic_location(
    session,
    *,
    clinic: Clinic,
    address: str,
    city: str,
    latitude: float,
    longitude: float,
    hours: str,
    phone: str,
) -> None:
    location = await session.scalar(
        select(ClinicLocation).where(ClinicLocation.clinic_id == clinic.id, ClinicLocation.is_primary.is_(True))
    )
    if location:
        location.address = address
        location.city = city
        location.latitude = latitude
        location.longitude = longitude
        location.hours = hours
        location.phone = phone
        return
    session.add(
        ClinicLocation(
            id=_demo_uuid(f"clinic-location-{clinic.id}"),
            clinic_id=clinic.id,
            address=address,
            city=city,
            latitude=latitude,
            longitude=longitude,
            hours=hours,
            phone=phone,
            is_primary=True,
        )
    )


async def _upsert_by_id(session, model, entity_id, values: dict):
    row = await session.scalar(select(model).where(model.id == entity_id))
    if row:
        for key, value in values.items():
            setattr(row, key, value)
        return row
    row = model(id=entity_id, **values)
    session.add(row)
    await session.flush()
    return row


def _safe_list(value) -> list[str]:
    if not value:
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _price_text(base: int, offset: int) -> str:
    return f"от {base + offset} ₽"


def _normalize_symptom_category(raw_category: str) -> str:
    normalized = str(raw_category or "").strip().lower()
    return SYMPTOM_CATEGORY_MAP.get(normalized, "general")


def _normalize_disease_category(raw_category: str) -> str:
    normalized = str(raw_category or "").strip().lower()
    return DISEASE_CATEGORY_MAP.get(normalized, "infectious")


def _normalize_disease_species(raw_species: list[str]) -> str:
    normalized: list[str] = []
    for item in raw_species:
        raw = str(item or "").strip().lower()
        if not raw:
            continue
        mapped = DISEASE_SPECIES_MAP.get(raw, raw)
        if mapped not in normalized:
            normalized.append(mapped)
    if not normalized:
        return "cat,dog"
    return ",".join(normalized)


def _derive_symptom_severity(name: str, emergency_flag: bool) -> int:
    if emergency_flag:
        return 5
    lowered = name.lower()
    if any(word in lowered for word in ("pain", "боль", "bleeding", "кров", "dyspnea", "одыш", "breath")):
        return 4
    if any(word in lowered for word in ("vomit", "рвот", "diarr", "диар", "letharg", "вял", "fever", "лихорад")):
        return 3
    return 2


def _derive_disease_emergency_level(category: str, name: str, risk_flags: list[str]) -> str:
    category_normalized = str(category or "").lower()
    name_lower = str(name or "").lower()
    risk_blob = " ".join(risk_flags).lower()

    red_keywords = ("acute", "critical", "severe", "shock", "крит", "остр", "шок", "дых", "кров")
    if category_normalized in {"trauma", "toxicology"}:
        return "RED"
    if any(keyword in name_lower for keyword in red_keywords):
        return "RED"
    if any(keyword in risk_blob for keyword in red_keywords):
        return "RED"
    if category_normalized in {"cardiology", "neurology", "infectious", "respiratory"}:
        return "YELLOW"
    return "GREEN"


def _derive_disease_prevalence(index: int) -> str:
    if index % 11 == 0:
        return "rare"
    if index % 3 == 0:
        return "uncommon"
    return "common"


async def _seed_symptom_library(session) -> int:
    created_ids: set[str] = set()
    target_count = 320

    for symptom_id, name, species, category, severity, emergency_flag, description in SYMPTOM_REQUIRED_EXAMPLES:
        await _upsert_by_id(
            session,
            Symptom,
            symptom_id,
            {
                "name": name,
                "species": species,
                "category": category,
                "severity": max(1, min(int(severity), 5)),
                "emergency_flag": bool(emergency_flag),
                "description": description,
            },
        )
        created_ids.add(symptom_id)

    catalog_rows = get_catalog_symptoms()
    for row in catalog_rows:
        if len(created_ids) >= target_count:
            break

        raw_id = str(row.get("id") or "").strip()
        if not raw_id:
            raw_id = f"symptom_{len(created_ids) + 1:04d}"
        symptom_id = raw_id if raw_id not in created_ids else f"seed_{raw_id}_{len(created_ids)}"

        name = str(row.get("name") or "").strip()
        if not name:
            continue

        emergency_flag = bool(row.get("red_flag", False))
        category = _normalize_symptom_category(str(row.get("category") or ""))
        severity = _derive_symptom_severity(name, emergency_flag)
        description = str(row.get("description") or "Reference symptom entry for clinical triage.")

        await _upsert_by_id(
            session,
            Symptom,
            symptom_id,
            {
                "name": name,
                "species": "cat,dog",
                "category": category,
                "severity": severity,
                "emergency_flag": emergency_flag,
                "description": description,
            },
        )
        created_ids.add(symptom_id)

    return len(created_ids)


async def _seed_disease_library(session) -> int:
    created_ids: set[str] = set()
    target_count = 240

    for disease_id, name, species, category, symptoms, description, emergency_level, prevalence in DISEASE_REQUIRED_EXAMPLES:
        await _upsert_by_id(
            session,
            Disease,
            disease_id,
            {
                "name": name,
                "species": species,
                "category": category,
                "symptoms_json": symptoms,
                "description": description,
                "emergency_level": emergency_level,
                "prevalence": prevalence,
            },
        )
        created_ids.add(disease_id)

    catalog_rows = get_catalog_diseases()
    for index, row in enumerate(catalog_rows):
        if len(created_ids) >= target_count:
            break

        raw_id = str(row.get("id") or "").strip() or f"disease_{index + 1:04d}"
        disease_id = raw_id if raw_id not in created_ids else f"seed_{raw_id}_{index + 1}"
        name = str(row.get("name") or "").strip()
        if not name:
            continue

        category = _normalize_disease_category(str(row.get("category") or ""))
        species = _normalize_disease_species(list(row.get("species", [])))
        symptoms = [str(item).strip() for item in row.get("typical_symptoms", []) if str(item).strip()][:12]
        risk_flags = [str(item).strip() for item in row.get("risk_flags", []) if str(item).strip()]
        description = str(row.get("summary") or row.get("description") or "Reference disease profile.")
        emergency_level = _derive_disease_emergency_level(category, name, risk_flags)
        prevalence = _derive_disease_prevalence(index)

        await _upsert_by_id(
            session,
            Disease,
            disease_id,
            {
                "name": name,
                "species": species,
                "category": category,
                "symptoms_json": symptoms,
                "description": description,
                "emergency_level": emergency_level,
                "prevalence": prevalence,
            },
        )
        created_ids.add(disease_id)

    return len(created_ids)


async def _seed_clinical_protocols(session) -> int:
    created_ids: set[str] = set()

    for protocol_id, name, species, category, description, steps, emergency_flag in CLINICAL_PROTOCOL_REQUIRED_EXAMPLES:
        await _upsert_by_id(
            session,
            ClinicalProtocol,
            protocol_id,
            {
                "name": name,
                "species": species,
                "category": category,
                "description": description,
                "steps_json": steps,
                "emergency_flag": bool(emergency_flag),
            },
        )
        created_ids.add(protocol_id)

    return len(created_ids)


async def _seed_pharmacy_marketplace(
    session,
    *,
    rng: random.Random,
    owner_id: uuid.UUID,
    clinic_ids: list[uuid.UUID],
) -> None:
    demo_city = "Санкт-Петербург"
    catalog = get_catalog_drugs()[:100]
    if not catalog:
        return

    drugs: list[Drug] = []
    variant_map: dict[uuid.UUID, list[DrugVariant]] = {}

    for idx, raw in enumerate(catalog):
        curated = CURATED_MARKET_DRUGS.get(idx + 1, {})
        drug_id = _demo_uuid(f"market-drug-{idx + 1}")
        forms = _safe_list(curated.get("forms")) or _safe_list(raw.get("forms")) or ["таблетки"]
        species = _safe_list(curated.get("species")) or _safe_list(raw.get("species")) or ["кошки", "собаки"]
        contraindications = _safe_list(raw.get("contraindications"))
        side_effects = _safe_list(raw.get("side_effects"))
        interactions = _safe_list(raw.get("interactions"))
        warnings = _safe_list(raw.get("warnings"))
        tags = _safe_list(curated.get("tags")) or _safe_list(raw.get("tags")) or ["справочник", "ветеринария"]
        clinical_notes = _safe_list(raw.get("monitoring_notes"))
        concentration_examples = _safe_list(raw.get("concentration_examples"))

        prescription_required = (
            curated.get("prescription_required")
            if curated.get("prescription_required") is not None
            else (idx % 2 == 0) or (idx % 5 == 0)
        )  # 60% true for 100 rows
        controlled_flag = bool(raw.get("controlled_flag", False)) or ("анестет" in str(raw.get("group", "")).lower())
        popularity_rank = idx + 1 if idx < 36 else None

        drug = await _upsert_by_id(
            session,
            Drug,
            drug_id,
            {
                "external_id": str(raw.get("id") or f"seed_drug_{idx + 1}"),
                "name": str(curated.get("name") or raw.get("name") or f"Препарат {idx + 1}"),
                "active_substance": str(curated.get("active_substance") or raw.get("name") or f"ДВ {idx + 1}"),
                "group_name": str(curated.get("group") or raw.get("group") or "ветеринарный препарат"),
                "species_json": species,
                "forms_json": forms,
                "prescription_required": prescription_required,
                "controlled_flag": controlled_flag,
                "indications_summary": str(
                    raw.get("indications_summary")
                    or "Справочная информация по применению. Решение принимает ветеринарный врач."
                ),
                "contraindications_json": contraindications,
                "side_effects_json": side_effects,
                "interactions_json": interactions,
                "warnings_json": warnings,
                "storage_notes": str(raw.get("storage_notes") or "Хранить согласно инструкции производителя."),
                "tags_json": tags,
                "clinical_notes_json": clinical_notes,
                "popularity_rank": popularity_rank,
            },
        )
        drugs.append(drug)

        await session.execute(delete(DrugImage).where(DrugImage.drug_id == drug.id))
        primary_visual = str(curated.get("thumbnail") or f"/assets/img/drugs/pack-{(idx % 12) + 1:02d}.svg")
        secondary_visual = f"/assets/img/drugs/pack-{(idx % 12) + 1:02d}.svg"
        tertiary_visual = f"/assets/img/drugs/pack-{((idx + 5) % 12) + 1:02d}.svg"
        if primary_visual == secondary_visual:
            secondary_visual = f"/assets/img/drugs/pack-{((idx + 3) % 12) + 1:02d}.svg"
        if tertiary_visual in {primary_visual, secondary_visual}:
            tertiary_visual = f"/assets/img/drugs/pack-{((idx + 7) % 12) + 1:02d}.svg"
        images = [primary_visual, secondary_visual, tertiary_visual]
        image_types = ["packshot", "box", "instruction"]
        for image_idx, image_url in enumerate(images):
            await _upsert_by_id(
                session,
                DrugImage,
                _demo_uuid(f"market-drug-{idx + 1}-image-{image_idx + 1}"),
                {
                    "drug_id": drug.id,
                    "url": image_url,
                    "image_type": image_types[image_idx % len(image_types)],
                    "sort_order": image_idx,
                },
            )

        variant_rows: list[DrugVariant] = []
        for form_idx in range(min(2, len(forms))):
            variant_id = _demo_uuid(f"market-drug-{idx + 1}-variant-{form_idx + 1}")
            variant = await _upsert_by_id(
                session,
                DrugVariant,
                variant_id,
                {
                    "drug_id": drug.id,
                    "form": forms[form_idx],
                    "strength_text": concentration_examples[form_idx] if form_idx < len(concentration_examples) else "по инструкции",
                    "pack_size_text": f"{10 + ((idx + form_idx) % 5) * 5} ед.",
                    "sku_text": f"SKU-{idx + 1:03d}-{form_idx + 1}",
                },
            )
            variant_rows.append(variant)
        variant_map[drug.id] = variant_rows

        for warning_idx, warning_text in enumerate(warnings[:2]):
            await _upsert_by_id(
                session,
                DrugWarning,
                _demo_uuid(f"market-drug-{idx + 1}-warning-{warning_idx + 1}"),
                {
                    "drug_id": drug.id,
                    "warning_text": warning_text,
                    "severity": "medium" if warning_idx == 0 else "low",
                },
            )

    await session.flush()

    for idx, drug in enumerate(drugs):
        analog_indexes = [((idx + 1) % len(drugs)), ((idx + 7) % len(drugs)), ((idx + 13) % len(drugs))]
        analog_indexes = [item for item in analog_indexes if item != idx]
        for rel_idx, analog_idx in enumerate(analog_indexes[:3]):
            analog = drugs[analog_idx]
            await _upsert_by_id(
                session,
                DrugAnalog,
                _demo_uuid(f"market-drug-analog-{idx + 1}-{analog_idx + 1}"),
                {
                    "drug_id": drug.id,
                    "analog_drug_id": analog.id,
                    "relation_type": "active_substance" if rel_idx == 0 else "class",
                },
            )
            await _upsert_by_id(
                session,
                Substitution,
                _demo_uuid(f"market-substitution-{idx + 1}-{analog_idx + 1}"),
                {
                    "drug_id": drug.id,
                    "substitute_drug_id": analog.id,
                    "reason": "аналог по действующему веществу/классу",
                },
            )

    # Online stores + offers (20 stores, 300 offers).
    for store_idx in range(20):
        store_id = _demo_uuid(f"market-online-store-{store_idx + 1}")
        store_name = f"VetShop Online {store_idx + 1}"
        store = await _upsert_by_id(
            session,
            OnlineStore,
            store_id,
            {
                "name": store_name,
                "website": f"https://shop{store_idx + 1:02d}.lapka-demo.local",
                "phone": f"+7 (800) 500-{store_idx + 1:02d}-{(store_idx * 3 + 11) % 100:02d}",
                "rating": round(4.1 + ((store_idx % 8) * 0.1), 1),
            },
        )
        for offer_idx in range(15):
            drug = drugs[(store_idx * 7 + offer_idx * 3) % len(drugs)]
            variants = variant_map.get(drug.id, [])
            variant = variants[offer_idx % len(variants)] if variants else None
            offer_id = _demo_uuid(f"market-online-offer-{store_idx + 1}-{offer_idx + 1}")
            price_base = 380 + ((offer_idx * 23 + store_idx * 17) % 2100)
            offer = await _upsert_by_id(
                session,
                OnlineOffer,
                offer_id,
                {
                    "online_store_id": store.id,
                    "drug_id": drug.id,
                    "variant_id": variant.id if variant else None,
                    "price_text": _price_text(price_base, 0),
                    "delivery_text": "Курьер 1-2 дня" if offer_idx % 3 else "Доставка в день заказа",
                    "url": f"{store.website}/product/{drug.id}",
                    "updated_at": datetime.now(timezone.utc) - timedelta(hours=(offer_idx + store_idx) % 72),
                },
            )
            await _upsert_by_id(
                session,
                PriceSnapshot,
                _demo_uuid(f"market-price-online-{store_idx + 1}-{offer_idx + 1}"),
                {
                    "drug_id": drug.id,
                    "source_type": "online",
                    "source_id": store.id,
                    "city": demo_city,
                    "price_text": offer.price_text,
                    "captured_at": offer.updated_at,
                },
            )

    # Offline pharmacies (30 pharmacies, 3-5 locations each).
    for pharmacy_idx in range(30):
        pharmacy_id = _demo_uuid(f"market-offline-pharmacy-{pharmacy_idx + 1}")
        pharmacy = await _upsert_by_id(
            session,
            Pharmacy,
            pharmacy_id,
            {
                "name": f"ВетАптека {pharmacy_idx + 1}",
                "pharmacy_type": PharmacyType.both if pharmacy_idx % 5 == 0 else PharmacyType.offline,
                "website": f"https://offline{pharmacy_idx + 1:02d}.lapka-demo.local",
                "phone": f"+7 (495) 7{pharmacy_idx + 1:02d}-{(pharmacy_idx * 7 + 31) % 100:02d}",
                "rating": round(4.0 + ((pharmacy_idx % 10) * 0.08), 2),
            },
        )
        location_count = 3 + (pharmacy_idx % 3)
        for loc_idx in range(location_count):
            location_id = _demo_uuid(f"market-offline-pharmacy-{pharmacy_idx + 1}-loc-{loc_idx + 1}")
            latitude = 55.70 + ((pharmacy_idx * 0.006 + loc_idx * 0.004) % 0.22)
            longitude = 37.48 + ((pharmacy_idx * 0.007 + loc_idx * 0.003) % 0.24)
            location = await _upsert_by_id(
                session,
                PharmacyLocation,
                location_id,
                {
                    # Link demo pharmacies to clinic контуры, so `clinic_admin` can view scoped inventory.
                    "clinic_id": clinic_ids[(pharmacy_idx + loc_idx) % max(1, len(clinic_ids))] if clinic_ids else None,
                    "pharmacy_id": pharmacy.id,
                    "city": demo_city,
                    "address": f"{demo_city}, ул. Аптечная, {10 + pharmacy_idx * 2 + loc_idx}",
                    "latitude": round(latitude, 6),
                    "longitude": round(longitude, 6),
                    "hours": "08:00-22:00" if (loc_idx + pharmacy_idx) % 4 else "круглосуточно",
                },
            )
            for inv_idx in range(6):
                drug = drugs[(pharmacy_idx * 5 + loc_idx * 7 + inv_idx * 11) % len(drugs)]
                variants = variant_map.get(drug.id, [])
                variant = variants[inv_idx % len(variants)] if variants else None
                inventory_id = _demo_uuid(f"market-inventory-{pharmacy_idx + 1}-{loc_idx + 1}-{inv_idx + 1}")
                price_base = 320 + ((pharmacy_idx * 17 + loc_idx * 11 + inv_idx * 13) % 1900)
                updated_at = datetime.now(timezone.utc) - timedelta(hours=(pharmacy_idx + inv_idx + loc_idx) % 48)
                # Demo expiration window: some items expiring within ~7..120 days.
                expires_at = datetime.now(timezone.utc) + timedelta(days=7 + ((pharmacy_idx + inv_idx * 2 + loc_idx) % 114))
                inventory = await _upsert_by_id(
                    session,
                    PharmacyInventory,
                    inventory_id,
                    {
                        "pharmacy_location_id": location.id,
                        "drug_id": drug.id,
                        "variant_id": variant.id if variant else None,
                        "in_stock": (pharmacy_idx + loc_idx + inv_idx) % 6 != 0,
                        "expires_at": expires_at,
                        "price_text": _price_text(price_base, 0),
                        "updated_at": updated_at,
                    },
                )
                await _upsert_by_id(
                    session,
                    PriceSnapshot,
                    _demo_uuid(f"market-price-offline-{pharmacy_idx + 1}-{loc_idx + 1}-{inv_idx + 1}"),
                    {
                        "drug_id": drug.id,
                        "source_type": "offline",
                        "source_id": location.id,
                        "city": demo_city,
                        "price_text": inventory.price_text,
                        "captured_at": inventory.updated_at,
                    },
                )

    # Seed a small owner shopping list.
    for item_idx in range(3):
        drug = drugs[item_idx]
        variants = variant_map.get(drug.id, [])
        variant = variants[0] if variants else None
        await _upsert_by_id(
            session,
            OwnerShoppingListItem,
            _demo_uuid(f"market-owner-shopping-{item_idx + 1}"),
            {
                "owner_user_id": owner_id,
                "drug_id": drug.id,
                "variant_id": variant.id if variant else None,
                "quantity": item_idx + 1,
                "notes": "Согласовать с ветеринарным врачом перед покупкой.",
            },
        )


async def _seed_ai_control_plane(
    session,
    *,
    now: datetime,
    platform_user_id: uuid.UUID,
    owner_user_id: uuid.UUID,
    vet_user_id: uuid.UUID,
    default_clinic_id: uuid.UUID,
    clinic_ids: list[uuid.UUID],
) -> dict[str, int]:
    provider_specs = [
        {
            "slug": "openai",
            "name": "OpenAI",
            "provider_type": "remote",
            "status": "active",
            "routing_summary": "Сценарии владельца, объяснение документов и быстрые безопасные ответы.",
            "capabilities_json": ["json", "reasoning", "text"],
            "default_model_key": "gpt-5-mini",
            "fallback_model_key": "gpt-5",
            "is_local": False,
            "models": [
                ("gpt-5-mini", "GPT-5 Mini", True, False, 200000, True, False, False),
                ("gpt-5", "GPT-5", False, True, 400000, True, False, False),
            ],
        },
        {
            "slug": "anthropic",
            "name": "Anthropic",
            "provider_type": "remote",
            "status": "active",
            "routing_summary": "Структурирование заметок врача и сложные внутренние сценарии клиники.",
            "capabilities_json": ["json", "long-context", "text"],
            "default_model_key": "claude-3.7-sonnet",
            "fallback_model_key": "claude-3.5-haiku",
            "is_local": False,
            "models": [
                ("claude-3.7-sonnet", "Claude 3.7 Sonnet", True, False, 200000, True, False, False),
                ("claude-3.5-haiku", "Claude 3.5 Haiku", False, True, 200000, True, False, False),
            ],
        },
        {
            "slug": "gemini",
            "name": "Google Gemini",
            "provider_type": "remote",
            "status": "standby",
            "routing_summary": "Поиск по базе знаний и резерв для explain/search сценариев.",
            "capabilities_json": ["json", "vision", "text"],
            "default_model_key": "gemini-2.5-flash",
            "fallback_model_key": "gemini-2.0-flash",
            "is_local": False,
            "models": [
                ("gemini-2.5-flash", "Gemini 2.5 Flash", True, False, 1000000, True, True, False),
                ("gemini-2.0-flash", "Gemini 2.0 Flash", False, True, 1000000, True, True, False),
            ],
        },
        {
            "slug": "local",
            "name": "Локальный резерв",
            "provider_type": "local",
            "status": "active",
            "routing_summary": "Резервный контур для чувствительных кейсов и работы при ограничениях внешних провайдеров.",
            "capabilities_json": ["local", "safe-mode"],
            "default_model_key": "llama-3.3-70b-instruct",
            "fallback_model_key": "phi-4-mini",
            "is_local": True,
            "models": [
                ("llama-3.3-70b-instruct", "Llama 3.3 70B Instruct", True, False, 128000, True, False, False),
                ("phi-4-mini", "Phi 4 Mini", False, True, 64000, True, False, False),
            ],
        },
    ]

    policy_specs = [
        ("owner-safe-mode", "Безопасный режим владельца", "Без рекомендаций по лечению и дозировкам, только срочность и безопасные шаги.", "owner"),
        ("document-explain-safe", "Объяснение без рекомендаций по лечению", "Простое объяснение документов, вопросы к врачу и безопасный контекст.", None),
        ("vet-internal-only", "Только внутренний контур врача", "Поддержка врача без owner-facing рекомендаций по терапии.", "vet"),
        ("lab-explain-vet-safe", "Разбор лаборатории для врача", "Подсветка наблюдений и вопросов к врачу без owner-facing терапии.", "vet"),
        ("grounded-knowledge-only", "Только на основе проверенной базы знаний", "Справочные ответы только на основе верифицированных знаний и шаблонов.", "vet"),
    ]

    route_specs = [
        ("owner-triage", "owner-triage", "Срочность владельца", "owner", "openai", "gpt-5-mini", "anthropic", "claude-3.5-haiku", "owner-safe-mode"),
        ("doc-explain", "doc-explain", "Объяснение документов", None, "openai", "gpt-5-mini", "gemini", "gemini-2.5-flash", "document-explain-safe"),
        ("vet-notes", "vet-notes", "Структурирование заметок врача", "vet", "anthropic", "claude-3.7-sonnet", "openai", "gpt-5-mini", "vet-internal-only"),
        ("note-structure", "note-structure", "Структурирование клинических заметок", "vet", "anthropic", "claude-3.7-sonnet", "openai", "gpt-5-mini", "vet-internal-only"),
        ("visit-structure", "visit-structure", "Структурирование визита по расшифровке", "vet", "anthropic", "claude-3.7-sonnet", "openai", "gpt-5-mini", "vet-internal-only"),
        ("audio-transcribe", "audio-transcribe", "Транскрибация аудио визита", "vet", "openai", "gpt-5-mini", "anthropic", "claude-3.7-sonnet", "vet-internal-only"),
        ("lab-explain", "lab-explain", "Объяснение лабораторного текста для врача", "vet", "gemini", "gemini-2.5-flash", "openai", "gpt-5-mini", "lab-explain-vet-safe"),
        ("protocol-completeness", "protocol-completeness", "Проверка полноты протокола", "vet", "openai", "gpt-5-mini", "anthropic", "claude-3.7-sonnet", "vet-internal-only"),
        ("knowledge-search", "knowledge-search", "Поиск по знаниям и справочникам", "vet", "gemini", "gemini-2.5-flash", "openai", "gpt-5-mini", "grounded-knowledge-only"),
    ]

    prompt_specs = [
        ("prompt-owner-triage", "Owner triage", "owner-triage", 1, "Owner triage v1", "Возвращай только безопасную оценку срочности, причины, вопросы и безопасные шаги.", {"response_format": "triage_json"}),
        ("prompt-doc-explain", "Document explain", "doc-explain", 1, "Document explain v1", "Объясняй документ простым языком, не давай лечения.", {"response_format": "doc_explain_json"}),
        ("prompt-vet-notes", "Vet note structuring", "vet-notes", 1, "Vet notes v1", "Структурируй жалобы, анамнез, осмотр, план и контроль.", {"response_format": "vet_notes_json"}),
        ("prompt-note-structure", "Clinical note structuring", "note-structure", 1, "Clinical note structure v1", "Структурируй клинические заметки врача в разделы жалоб, анамнеза, осмотра, плана и контроля.", {"response_format": "vet_notes_json"}),
        ("prompt-visit-structure", "Visit structure from transcript", "visit-structure", 1, "Visit structure v1", "Собирай из расшифровки визита структурированный протокол без owner-facing терапии.", {"response_format": "visit_structured_json"}),
        ("prompt-audio-transcribe", "Audio transcription", "audio-transcribe", 1, "Audio transcription v1", "Транскрибируй аудио приёма и сохраняй внутренний клинический контекст без owner-facing советов.", {"response_format": "transcript_json"}),
        ("prompt-lab-explain", "Lab explain for vet", "lab-explain", 1, "Lab explain v1", "Выделяй значимые наблюдения в лабораторном тексте и вопросы к врачу без лечения для владельца.", {"response_format": "lab_explain_json"}),
        ("prompt-protocol-completeness", "Protocol completeness", "protocol-completeness", 1, "Protocol completeness v1", "Проверяй полноту протокола и возвращай отсутствующие разделы и замечания.", {"response_format": "protocol_completeness_json"}),
        ("prompt-knowledge-search", "Knowledge retrieval", "knowledge-search", 1, "Knowledge search v1", "Отвечай только на основе верифицированной базы знаний и шаблонов.", {"response_format": "grounded_json"}),
    ]

    for idx, provider_spec in enumerate(provider_specs, start=1):
        provider = AIProvider(
            id=_demo_uuid(f"ai-provider-{provider_spec['slug']}"),
            slug=provider_spec["slug"],
            name=provider_spec["name"],
            provider_type=provider_spec["provider_type"],
            status=provider_spec["status"],
            routing_summary=provider_spec["routing_summary"],
            capabilities_json=provider_spec["capabilities_json"],
            default_model_key=provider_spec["default_model_key"],
            fallback_model_key=provider_spec["fallback_model_key"],
            is_local=provider_spec["is_local"],
            created_at=now - timedelta(days=30 - idx),
            updated_at=now - timedelta(days=1),
        )
        session.add(provider)
        await session.flush()
        for model_index, model_spec in enumerate(provider_spec["models"], start=1):
            model_key, display_name, is_default, is_fallback, context_window, supports_json_mode, supports_vision, supports_audio = model_spec
            session.add(
                AIModel(
                    id=_demo_uuid(f"ai-model-{provider.slug}-{model_index}"),
                    provider_id=provider.id,
                    model_key=model_key,
                    display_name=display_name,
                    status="active",
                    context_window=context_window,
                    supports_json_mode=supports_json_mode,
                    supports_vision=supports_vision,
                    supports_audio=supports_audio,
                    is_default=is_default,
                    is_fallback=is_fallback,
                    metadata_json={"seed": True},
                    created_at=now - timedelta(days=29 - idx),
                    updated_at=now - timedelta(days=1),
                )
            )

    for index, (slug, name, description, role_scope) in enumerate(policy_specs, start=1):
        session.add(
            AIPolicy(
                id=_demo_uuid(f"ai-policy-{slug}"),
                slug=slug,
                name=name,
                description=description,
                role_scope=role_scope,
                guardrails_json={"seed": True},
                created_at=now - timedelta(days=25 - index),
                updated_at=now - timedelta(days=1),
            )
        )

    for index, (slug, scenario_key, scenario_name, role_scope, primary_provider_slug, primary_model_key, fallback_provider_slug, fallback_model_key, policy_slug) in enumerate(route_specs, start=1):
        session.add(
            AIRoute(
                id=_demo_uuid(f"ai-route-{slug}"),
                slug=slug,
                scenario_key=scenario_key,
                scenario_name=scenario_name,
                role_scope=role_scope,
                primary_provider_slug=primary_provider_slug,
                primary_model_key=primary_model_key,
                fallback_provider_slug=fallback_provider_slug,
                fallback_model_key=fallback_model_key,
                policy_slug=policy_slug,
                enabled=True,
                metadata_json={"seed": True},
                created_at=now - timedelta(days=22 - index),
                updated_at=now - timedelta(days=1),
            )
        )

    await session.flush()

    for index, (slug, name, route_slug, version_number, title, system_prompt, template_json) in enumerate(prompt_specs, start=1):
        prompt = AIPrompt(
            id=_demo_uuid(slug),
            slug=slug,
            name=name,
            route_slug=route_slug,
            created_at=now - timedelta(days=18 - index),
            updated_at=now - timedelta(days=1),
        )
        session.add(prompt)
        await session.flush()
        session.add(
            AIPromptVersion(
                id=_demo_uuid(f"{slug}-version-{version_number}"),
                prompt_id=prompt.id,
                version_number=version_number,
                title=title,
                system_prompt=system_prompt,
                template_json=template_json,
                is_active=True,
                created_at=now - timedelta(days=15 - index),
            )
        )

    session.add(
        AILimit(
            id=_demo_uuid("ai-limit-platform"),
            scope_type="platform",
            scope_key=None,
            max_owner_requests_per_hour=1600,
            max_vet_requests_per_hour=900,
            prompt_audit=True,
            pii_redaction=True,
            fallback_mode="strict",
            created_at=now - timedelta(days=20),
            updated_at=now - timedelta(days=1),
        )
    )
    session.add(
        AIBudget(
            id=_demo_uuid("ai-budget-platform"),
            scope_type="platform",
            scope_key=None,
            monthly_budget=4800,
            hard_limit=6200,
            currency="USD",
            current_spend=1246.8,
            created_at=now - timedelta(days=20),
            updated_at=now - timedelta(days=1),
        )
    )

    for index, clinic_id in enumerate(clinic_ids[:3], start=1):
        session.add(
            AIClinicOverride(
                id=_demo_uuid(f"ai-clinic-override-{index}"),
                clinic_id=clinic_id,
                route_slug="doc-explain" if index == 1 else ("owner-triage" if index == 2 else "knowledge-search"),
                provider_slug="openai" if index != 3 else "gemini",
                model_key="gpt-5-mini" if index != 3 else "gemini-2.5-flash",
                mode_label="Контур клиники" if index == 1 else ("Бережный owner-контур" if index == 2 else "Поиск по базе знаний"),
                enabled=True,
                metadata_json={"target_label": f"Клиника {index}", "seed": True},
                created_at=now - timedelta(days=12 - index),
                updated_at=now - timedelta(days=1),
            )
        )

    session.add(
        AITenantOverride(
            id=_demo_uuid("ai-tenant-override-private-cases"),
            tenant_key="private-cases",
            route_slug=None,
            provider_slug="local",
            model_key="llama-3.3-70b-instruct",
            mode_label="Локальный резерв для чувствительных кейсов",
            enabled=True,
            metadata_json={"target_label": "Стационар / приватные кейсы", "seed": True},
            created_at=now - timedelta(days=10),
            updated_at=now - timedelta(days=1),
        )
    )
    session.add(
        AIRolePolicy(
            id=_demo_uuid("ai-role-policy-vet"),
            role="vet",
            policy_slug="vet-internal-only",
            route_slug="vet-notes",
            provider_slug="anthropic",
            mode_label="Ассистент врача",
            enabled=True,
            metadata_json={"target_label": "Ветеринарный врач", "seed": True},
            created_at=now - timedelta(days=9),
            updated_at=now - timedelta(days=1),
        )
    )
    session.add(
        AIRolePolicy(
            id=_demo_uuid("ai-role-policy-vet-runtime"),
            role="vet",
            policy_slug="vet-internal-only",
            route_slug="note-structure",
            provider_slug="anthropic",
            mode_label="Клинические заметки",
            enabled=True,
            metadata_json={"target_label": "Ветеринарный врач", "seed": True},
            created_at=now - timedelta(days=9),
            updated_at=now - timedelta(days=1),
        )
    )
    session.add(
        AIRolePolicy(
            id=_demo_uuid("ai-role-policy-vet-labs"),
            role="vet",
            policy_slug="lab-explain-vet-safe",
            route_slug="lab-explain",
            provider_slug="gemini",
            mode_label="Лабораторный разбор",
            enabled=True,
            metadata_json={"target_label": "Ветеринарный врач", "seed": True},
            created_at=now - timedelta(days=9),
            updated_at=now - timedelta(days=1),
        )
    )
    session.add(
        AIRolePolicy(
            id=_demo_uuid("ai-role-policy-vet-visit-structure"),
            role="vet",
            policy_slug="vet-internal-only",
            route_slug="visit-structure",
            provider_slug="anthropic",
            mode_label="Визит по расшифровке",
            enabled=True,
            metadata_json={"target_label": "Ветеринарный врач", "seed": True},
            created_at=now - timedelta(days=9),
            updated_at=now - timedelta(days=1),
        )
    )
    session.add(
        AIRolePolicy(
            id=_demo_uuid("ai-role-policy-vet-transcribe"),
            role="vet",
            policy_slug="vet-internal-only",
            route_slug="audio-transcribe",
            provider_slug="openai",
            mode_label="Транскрибация визита",
            enabled=True,
            metadata_json={"target_label": "Ветеринарный врач", "seed": True},
            created_at=now - timedelta(days=9),
            updated_at=now - timedelta(days=1),
        )
    )
    session.add(
        AIRolePolicy(
            id=_demo_uuid("ai-role-policy-vet-protocol"),
            role="vet",
            policy_slug="vet-internal-only",
            route_slug="protocol-completeness",
            provider_slug="openai",
            mode_label="Проверка полноты протокола",
            enabled=True,
            metadata_json={"target_label": "Ветеринарный врач", "seed": True},
            created_at=now - timedelta(days=9),
            updated_at=now - timedelta(days=1),
        )
    )
    session.add(
        AIRolePolicy(
            id=_demo_uuid("ai-role-policy-owner"),
            role="owner",
            policy_slug="owner-safe-mode",
            route_slug="owner-triage",
            provider_slug="openai",
            mode_label="Безопасный режим владельца",
            enabled=True,
            metadata_json={"target_label": "Владелец", "seed": True},
            created_at=now - timedelta(days=9),
            updated_at=now - timedelta(days=1),
        )
    )

    usage_specs = [
        ("owner-triage", "openai", "gpt-5-mini", "owner", owner_user_id, default_clinic_id, 1820, 11.4, "ok"),
        ("doc-explain", "openai", "gpt-5-mini", "owner", owner_user_id, default_clinic_id, 640, 7.2, "ok"),
        ("vet-notes", "anthropic", "claude-3.7-sonnet", "vet", vet_user_id, default_clinic_id, 910, 18.1, "ok"),
        ("note-structure", "anthropic", "claude-3.7-sonnet", "vet", vet_user_id, default_clinic_id, 260, 6.1, "ok"),
        ("visit-structure", "anthropic", "claude-3.7-sonnet", "vet", vet_user_id, default_clinic_id, 118, 3.4, "ok"),
        ("audio-transcribe", "openai", "gpt-5-mini", "vet", vet_user_id, default_clinic_id, 204, 4.6, "ok"),
        ("lab-explain", "gemini", "gemini-2.5-flash", "vet", vet_user_id, default_clinic_id, 166, 2.9, "ok"),
        ("protocol-completeness", "openai", "gpt-5-mini", "vet", vet_user_id, default_clinic_id, 147, 2.2, "ok"),
        ("knowledge-search", "gemini", "gemini-2.5-flash", "vet", vet_user_id, default_clinic_id, 420, 4.8, "ok"),
        ("doc-explain", "openai", "gpt-5-mini", "owner", owner_user_id, default_clinic_id, 36, 0.6, "warning"),
    ]
    for index, (route_slug, provider_slug, model_key, role_scope, actor_user_id, clinic_id, request_count, estimated_cost, status_value) in enumerate(usage_specs, start=1):
        session.add(
            AIUsageLog(
                id=_demo_uuid(f"ai-usage-{index}"),
                actor_user_id=actor_user_id,
                clinic_id=clinic_id,
                route_slug=route_slug,
                provider_slug=provider_slug,
                model_key=model_key,
                role_scope=role_scope,
                request_count=request_count,
                estimated_cost=estimated_cost,
                status=status_value,
                latency_ms=450 + index * 120,
                metadata_json={"seed": True},
                created_at=now - timedelta(days=index * 3),
            )
        )

    return {
        "providers": len(provider_specs),
        "models": sum(len(provider["models"]) for provider in provider_specs),
        "routes": len(route_specs),
        "policies": len(policy_specs),
        "prompts": len(prompt_specs),
        "clinic_overrides": min(3, len(clinic_ids)),
        "role_policies": 2,
        "usage_logs": len(usage_specs),
    }

def _seed_uuid(kind: str, index: int) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"lapka-seed-{kind}-{index}")


def _seed_lapka_id(index: int) -> str:
    return f"LPK-{index:06d}-{str(_seed_uuid('lapka-id', index)).replace('-', '')[:6].upper()}"


async def _seed_vpn_mvp_demo(session, *, owner_user_id: uuid.UUID) -> None:
    """VPN MVP demo rows (requires Alembic ``040_vpn_mvp``). Idempotent."""
    await session.execute(
        text(
            """
            INSERT INTO vpn_subscriptions (user_id, status, plan_code, updated_at)
            VALUES (:uid, 'active', 'vpn_default', NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                status = 'active',
                plan_code = EXCLUDED.plan_code,
                updated_at = NOW()
            """
        ),
        {"uid": owner_user_id},
    )
    await session.execute(
        text(
            """
            INSERT INTO vpn_checkouts (
                checkout_id, user_id, provider, plan_code, amount_rub, status, created_at
            )
            VALUES (
                'lapka_seed_vpn_checkout_1',
                :uid,
                'yookassa',
                'vpn_default',
                299,
                'captured',
                NOW() - INTERVAL '2 hours'
            )
            ON CONFLICT (checkout_id) DO NOTHING
            """
        ),
        {"uid": owner_user_id},
    )
    await session.execute(
        text(
            """
            INSERT INTO vpn_webhook_events (provider, event_id, checkout_id, status, amount_rub, created_at)
            VALUES (
                'yookassa',
                'lapka_seed_vpn_evt_1',
                'lapka_seed_vpn_checkout_1',
                'captured',
                299,
                NOW() - INTERVAL '2 hours'
            )
            ON CONFLICT (provider, event_id) DO NOTHING
            """
        ),
    )


async def seed() -> None:
    seed_value = 2026
    rng = random.Random(seed_value)
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    storage_dir = Path("storage")
    storage_dir.mkdir(parents=True, exist_ok=True)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                """
                TRUNCATE TABLE
                  lab_results,
                  lab_orders,
                  lab_providers,
                  insurance_claims,
                  insurance_policies,
                  payments,
                  invoice_items,
                  invoices,
                  clinic_services,
                  availability_queries,
                  owner_shopping_list_items,
                  substitutions,
                  price_snapshots,
                  online_offers,
                  online_stores,
                  pharmacy_inventory,
                  pharmacy_locations,
                  pharmacies,
                  drug_warnings,
                  drug_analogs,
                  drug_variants,
                  drug_images,
                  drugs,
                  symptoms,
                  diseases,
                  clinical_protocols,
                  ratings_summary,
                  reviews,
                  templates,
                  reminders,
                  notifications,
                  ai_usage_logs,
                  ai_role_policies,
                  ai_clinic_overrides,
                  ai_tenant_overrides,
                  ai_budgets,
                  ai_limits,
                  ai_prompt_versions,
                  ai_prompts,
                  ai_routes,
                  ai_policies,
                  ai_models,
                  ai_providers,
                  appointments,
                  doctor_schedules,
                  appointment_types,
                  services,
                  public_links,
                  camera_access_logs,
                  camera_access_tokens,
                  cameras,
                  inpatient_events,
                  inpatient_photo_reports,
                  inpatient_observations,
                  inpatient_plans,
                  inpatient_stays,
                  vaccine_entries,
                  documents,
                  prescriptions,
                  visits,
                  clinic_invites,
                  referrals,
                  lost_pet_sightings,
                  lost_pet_reports,
                  pet_passports,
                  pet_qr_tokens,
                  consent_requests,
                  consent_grants,
                  pet_owner_links,
                  master_pets,
                  clinic_resources,
                  clinic_locations,
                  memberships,
                  audit_events,
                  sessions,
                  places,
                  vet_profiles,
                  clinics,
                  vpn_webhook_events,
                  vpn_device_links,
                  vpn_profiles,
                  vpn_telegram_links,
                  vpn_checkouts,
                  vpn_subscriptions,
                  users
                RESTART IDENTITY CASCADE
                """
            )
        )

        clinic = Clinic(
            id=DEMO_IDS["clinic"],
            name="ВетСеть",
            address="Санкт-Петербург, ул. Зайцева, д. 3а",
            description="Сеть ветеринарных клиник Санкт-Петербурга с круглосуточным приёмом, диагностикой, стационаром и цифровой картой питомца.",
            logo_url=resolve_demo_clinic_photo(clinic_name="ВетСеть"),
            photos_json=resolve_demo_clinic_gallery(clinic_name="ВетСеть"),
            city="Санкт-Петербург",
            latitude=59.8794,
            longitude=30.2616,
            hours="24/7",
            phone="+7 (812) 612-11-10",
            website="https://www.vetseti.ru",
            emergency_available=True,
            price_level="medium",
        )
        session.add(clinic)
        all_clinic_locations: list[tuple[str, ClinicLocation]] = []
        primary_demo_location = ClinicLocation(
            id=_seed_uuid("clinic-location", 1),
            clinic_id=clinic.id,
            address=clinic.address,
            city=clinic.city,
            latitude=clinic.latitude,
            longitude=clinic.longitude,
            hours=clinic.hours,
            phone=clinic.phone,
            is_primary=True,
        )
        session.add(primary_demo_location)
        all_clinic_locations.append(("vetset-primary", primary_demo_location))

        extra_clinics: list[Clinic] = []
        all_clinics: list[Clinic] = [clinic]
        for spec in NETWORK_CLINIC_SPECS:
            extra_clinic = Clinic(
                id=_demo_uuid(f"clinic-{spec['slug']}"),
                name=spec["name"],
                address=spec["address"],
                description=spec["description"],
                logo_url=spec["logo_url"],
                photos_json=spec["photos_json"],
                city=spec["city"],
                latitude=spec["latitude"],
                longitude=spec["longitude"],
                hours=spec["hours"],
                phone=spec["phone"],
                website=spec["website"],
                emergency_available=spec["emergency_available"],
                price_level=spec["price_level"],
            )
            session.add(extra_clinic)
            primary_location = ClinicLocation(
                id=_demo_uuid(f"clinic-location-{spec['slug']}-primary"),
                clinic_id=extra_clinic.id,
                address=spec["address"],
                city=spec["city"],
                latitude=spec["latitude"],
                longitude=spec["longitude"],
                hours=spec["hours"],
                phone=spec["phone"],
                is_primary=True,
            )
            session.add(primary_location)
            all_clinic_locations.append((f"{spec['slug']}-primary", primary_location))
            branch = spec["branch"]
            branch_location = ClinicLocation(
                id=_demo_uuid(f"clinic-location-{spec['slug']}-branch"),
                clinic_id=extra_clinic.id,
                address=branch["address"],
                city=branch["city"],
                latitude=branch["latitude"],
                longitude=branch["longitude"],
                hours=branch["hours"],
                phone=branch["phone"],
                is_primary=False,
            )
            session.add(branch_location)
            all_clinic_locations.append((f"{spec['slug']}-branch", branch_location))
            extra_clinics.append(extra_clinic)
            all_clinics.append(extra_clinic)

        for idx, (name, place_type, city, latitude, longitude, address, hours) in enumerate(PLACES_SEED, start=1):
            session.add(
                Place(
                    id=_seed_uuid("place", idx),
                    name=name,
                    place_type=place_type,
                    city=city,
                    latitude=latitude,
                    longitude=longitude,
                    address=address,
                    hours=hours,
                )
            )
        await session.flush()
        resource_specs = [
            ("Кабинет 1", "room", 1),
            ("Кабинет 2", "room", 1),
            ("Диагностика", "diagnostics", 1),
            ("Процедурная", "procedure", 1),
            ("Телемедицина", "telemedicine", 1),
        ]
        location_resources_map: dict[uuid.UUID, list[ClinicResource]] = {}
        for location_slug, location in all_clinic_locations:
            for resource_index, (resource_name, resource_type, capacity) in enumerate(resource_specs, start=1):
                code_suffix = resource_name.lower().replace(" ", "-")
                resource = ClinicResource(
                    id=_demo_uuid(f"clinic-resource-{location_slug}-{resource_index}"),
                    clinic_id=location.clinic_id,
                    clinic_location_id=location.id,
                    name=resource_name,
                    code=f"{location_slug}-{code_suffix}",
                    resource_type=resource_type,
                    capacity=capacity,
                    is_active=True,
                )
                location_resources_map.setdefault(location.id, []).append(resource)
                session.add(resource)
        seeded_symptoms_count = await _seed_symptom_library(session)
        seeded_diseases_count = await _seed_disease_library(session)
        seeded_protocols_count = await _seed_clinical_protocols(session)
        await session.flush()

        owner_names = [
            "Александр Иванов",
            "Мария Петрова",
            "Ольга Сидорова",
            "Ирина Кузнецова",
            "Дмитрий Васильев",
            "Сергей Морозов",
            "Анна Попова",
            "Елена Смирнова",
            "Павел Николаев",
            "Татьяна Лебедева",
        ]
        last_names = [
            "Иванов",
            "Петров",
            "Сидоров",
            "Смирнов",
            "Кузнецов",
            "Попов",
            "Орлов",
            "Крылов",
            "Соколов",
            "Новиков",
            "Фролов",
            "Егоров",
        ]
        specialties = [
            "Терапия",
            "Хирургия",
            "Дерматология",
            "Кардиология",
            "Неврология",
            "Офтальмология",
            "Анестезиология",
            "Стационар",
            "УЗИ",
            "Ортопедия",
            "Реабилитация",
            "Экзотические животные",
        ]

        owner_users: list[User] = []
        vet_users: list[User] = []
        extra_clinic_admins: list[User] = []
        extra_vet_users: list[User] = []
        clinic_vet_map: dict[uuid.UUID, list[User]] = {}

        owner_main = User(
            id=DEMO_IDS["owner_user"],
            email="owner@lapka.local",
            full_name="Александра Иванова",
            role=RoleEnum.owner,
            phone="+70000000001",
            password_hash=hash_password("demo12345"),
            is_active=True,
        )
        vet_main = User(
            id=DEMO_IDS["vet_user"],
            email="vet@lapka.local",
            full_name="Елена Воронова",
            role=RoleEnum.vet,
            phone="+70000000002",
            password_hash=hash_password("demo12345"),
            is_active=True,
        )
        admin_main = User(
            id=DEMO_IDS["admin_user"],
            email="admin@lapka.local",
            full_name="Ирина Клименко",
            role=RoleEnum.clinic_admin,
            phone="+70000000003",
            password_hash=hash_password("demo12345"),
            is_active=True,
        )
        platform_main = User(
            id=DEMO_IDS["platform_user"],
            email="platform@lapka.local",
            full_name="Платформа Лапка",
            role=RoleEnum.network_admin,
            phone="+70000000004",
            password_hash=hash_password("demo12345"),
            is_active=True,
        )
        session.add_all([owner_main, vet_main, admin_main, platform_main])
        owner_users.append(owner_main)
        vet_users.append(vet_main)

        for idx in range(2, 61):
            first = owner_names[idx % len(owner_names)].split()[0]
            last = last_names[idx % len(last_names)]
            user = User(
                id=_seed_uuid("owner-user", idx),
                email=f"owner{idx:02d}@lapka.local",
                full_name=f"{first} {last}",
                role=RoleEnum.owner,
                phone=f"+7900{idx:07d}",
                password_hash=hash_password("demo12345"),
                is_active=True,
            )
            session.add(user)
            owner_users.append(user)

        for idx in range(2, 13):
            first = owner_names[idx % len(owner_names)].split()[0]
            last = last_names[(idx * 2) % len(last_names)]
            vet = User(
                id=_seed_uuid("vet-user", idx),
                email=f"vet{idx:02d}@lapka.local",
                full_name=f"{first} {last}",
                role=RoleEnum.vet,
                phone=f"+7910{idx:07d}",
                password_hash=hash_password("demo12345"),
                is_active=True,
            )
            session.add(vet)
            vet_users.append(vet)

        for clinic_index, spec in enumerate(NETWORK_CLINIC_SPECS, start=1):
            admin = User(
                id=_seed_uuid("extra-admin-user", clinic_index),
                email=spec["admin"]["email"],
                full_name=spec["admin"]["name"],
                role=RoleEnum.clinic_admin,
                phone=spec["admin"]["phone"],
                password_hash=hash_password("demo12345"),
                is_active=True,
            )
            session.add(admin)
            extra_clinic_admins.append(admin)

            for vet_offset, vet_spec in enumerate(spec["vets"], start=1):
                vet = User(
                    id=_demo_uuid(f"extra-vet-user-{spec['slug']}-{vet_offset}"),
                    email=vet_spec["email"],
                    full_name=vet_spec["name"],
                    role=RoleEnum.vet,
                    phone=vet_spec["phone"],
                    password_hash=hash_password("demo12345"),
                    is_active=True,
                )
                session.add(vet)
                extra_vet_users.append(vet)
        await session.flush()

        clinic_vet_map[clinic.id] = list(vet_users)
        for extra_clinic, spec in zip(extra_clinics, NETWORK_CLINIC_SPECS):
            clinic_vet_map[extra_clinic.id] = [
                row for row in extra_vet_users if row.email in {vet_spec["email"] for vet_spec in spec["vets"]}
            ]

        session.add(
            Membership(
                id=_seed_uuid("membership-admin", 1),
                user_id=admin_main.id,
                clinic_id=clinic.id,
                role_in_clinic=RoleEnum.clinic_admin,
                status=MembershipStatus.active,
            )
        )
        session.add(
            Membership(
                id=_seed_uuid("membership-platform", 1),
                user_id=platform_main.id,
                clinic_id=clinic.id,
                role_in_clinic=RoleEnum.clinic_admin,
                status=MembershipStatus.active,
            )
        )
        for idx, vet in enumerate(vet_users, start=1):
            session.add(
                Membership(
                    id=_seed_uuid("membership-vet", idx),
                    user_id=vet.id,
                    clinic_id=clinic.id,
                    role_in_clinic=RoleEnum.vet,
                    status=MembershipStatus.active,
                )
            )
            session.add(
                VetProfile(
                    id=_seed_uuid("vet-profile", idx),
                    vet_id=vet.id,
                    clinic_id=clinic.id,
                    specialty=specialties[(idx - 1) % len(specialties)],
                    experience_years=3 + (idx % 14),
                    photo_url=resolve_demo_vet_photo(specialty=specialties[(idx - 1) % len(specialties)]),
                    languages_json=["русский", "английский"] if idx % 3 == 0 else ["русский"],
                    bio="Работает по структурированным клиническим протоколам и безопасной коммуникации с владельцем.",
                    working_hours="Пн-Пт 09:00-17:00",
                )
            )

        for clinic_index, (extra_clinic, spec, admin_user) in enumerate(zip(extra_clinics, NETWORK_CLINIC_SPECS, extra_clinic_admins), start=1):
            session.add(
                Membership(
                    id=_demo_uuid(f"membership-admin-{spec['slug']}"),
                    user_id=admin_user.id,
                    clinic_id=extra_clinic.id,
                    role_in_clinic=RoleEnum.clinic_admin,
                    status=MembershipStatus.active,
                )
            )
            for vet_offset, vet in enumerate(clinic_vet_map[extra_clinic.id], start=1):
                vet_spec = spec["vets"][vet_offset - 1]
                session.add(
                    Membership(
                        id=_demo_uuid(f"membership-vet-{spec['slug']}-{vet_offset}"),
                        user_id=vet.id,
                        clinic_id=extra_clinic.id,
                        role_in_clinic=RoleEnum.vet,
                        status=MembershipStatus.active,
                    )
                )
                session.add(
                    VetProfile(
                        id=_demo_uuid(f"vet-profile-{spec['slug']}-{vet_offset}"),
                        vet_id=vet.id,
                        clinic_id=extra_clinic.id,
                        specialty=vet_spec["specialty"],
                        experience_years=vet_spec["experience"],
                        photo_url=resolve_demo_vet_photo(specialty=vet_spec["specialty"]),
                        languages_json=["русский", "английский"],
                        bio=f"{vet_spec['specialty']} с упором на структурированные протоколы, owner-facing коммуникацию и сетевой стандарт клиники.",
                        working_hours="Пн-Сб 09:00-19:00",
                    )
                )
        await session.flush()

        ai_control_plane_counts = await _seed_ai_control_plane(
            session,
            now=now,
            platform_user_id=platform_main.id,
            owner_user_id=owner_main.id,
            vet_user_id=vet_main.id,
            default_clinic_id=clinic.id,
            clinic_ids=[row.id for row in all_clinics],
        )
        await session.flush()

        cat_names = ["Барсик", "Муся", "Снежок", "Луна", "Тоша", "Сима", "Персик", "Нюша", "Тимоша", "Ася"]
        dog_names = ["Рекс", "Макс", "Джек", "Лайма", "Бэлла", "Чарли", "Ричи", "Боня", "Грей", "Марта"]
        other_names = ["Плюша", "Киви", "Пиксель", "Фисташка", "Роки", "Чип", "Спарк", "Буся", "Тучка", "Листик"]
        cat_breeds = ["British Shorthair", "Maine Coon", "Scottish Fold", "Siberian", "European Shorthair"]
        dog_breeds = ["Labrador", "Jack Russell Terrier", "Corgi", "Shiba Inu", "Mixed"]
        other_breeds = {
            "rabbit": ["Карликовый кролик", "Львиноголовый"],
            "guinea_pig": ["Американская", "Рекс"],
            "ferret": ["Домашний хорёк"],
            "parrot": ["Волнистый попугай", "Корелла"],
        }

        pet_assignments: list[User] = [owner_main, owner_main, owner_main] + owner_users[1:]
        owner_pet_count = {owner.id: 0 for owner in owner_users}
        for assigned_owner in pet_assignments:
            owner_pet_count[assigned_owner.id] += 1
        while len(pet_assignments) < 100:
            candidates = [row for row in owner_users if owner_pet_count[row.id] < 4]
            chosen_owner = rng.choice(candidates)
            pet_assignments.append(chosen_owner)
            owner_pet_count[chosen_owner.id] += 1
        rng.shuffle(pet_assignments[1:])

        species_pool = (
            ["cat"] * 45
            + ["dog"] * 45
            + ["rabbit", "guinea_pig", "ferret", "parrot", "rabbit", "guinea_pig", "ferret", "parrot", "rabbit", "parrot"]
        )
        species_pool[0] = "cat"
        pets: list[MasterPet] = []
        pet_owner_map: dict[uuid.UUID, User] = {}
        pet_allergy_map: dict[uuid.UUID, list[str]] = {}

        allergy_pool = ["курица", "говядина", "пыльца", "пылевой клещ", "некоторые шампуни", "блохи"]
        color_pool = {
            "cat": ["рыжий", "серый", "чёрный", "белый", "трёхцветный", "дымчатый"],
            "dog": ["палевый", "чёрно-белый", "коричневый", "рыжий", "серый"],
            "rabbit": ["белый", "серый", "чёрно-белый"],
            "guinea_pig": ["рыже-белый", "чёрно-белый", "коричневый"],
            "ferret": ["соболиный", "серебристый", "пастельный"],
            "parrot": ["зелёный", "голубой", "жёлтый"],
        }
        species_counter: dict[str, int] = {"cat": 0, "dog": 0, "rabbit": 0, "guinea_pig": 0, "ferret": 0, "parrot": 0}

        for idx in range(100):
            species = species_pool[idx]
            species_counter[species] += 1
            counter = species_counter[species]

            if idx == 0:
                pet_id = DEMO_IDS["barsik_pet"]
                name = "Барсик"
                breed = "British Shorthair"
                chip_id = "BARSIK-CHIP-001"
                passport_id = "RU-BARSIK-2026"
            else:
                pet_id = _seed_uuid("pet", idx + 1)
                if species == "cat":
                    name = f"{cat_names[counter % len(cat_names)]} {counter}"
                    breed = cat_breeds[counter % len(cat_breeds)]
                elif species == "dog":
                    name = f"{dog_names[counter % len(dog_names)]} {counter}"
                    breed = dog_breeds[counter % len(dog_breeds)]
                else:
                    name = f"{other_names[counter % len(other_names)]} {counter}"
                    breed = other_breeds[species][counter % len(other_breeds[species])]
                chip_id = f"LPK-CHIP-{idx + 1:05d}"
                passport_id = f"LPK-PP-{idx + 1:05d}"

            photo_url = resolve_demo_pet_photo(species=species, breed=breed, seed_index=idx + 1)
            color = color_pool[species][(idx + counter) % len(color_pool[species])]

            pet = MasterPet(
                id=pet_id,
                lapka_id=_seed_lapka_id(idx + 1),
                name=name,
                species=species,
                breed=breed,
                color=color,
                sex=("male" if idx % 2 == 0 else "female"),
                birth_date=(now - timedelta(days=365 * (1 + (idx % 12)))).date(),
                chip_id=chip_id,
                passport_id=passport_id,
                photo_url=photo_url,
            )
            session.add(pet)
            await session.flush()
            pets.append(pet)

            owner_user = pet_assignments[idx]
            pet_owner_map[pet.id] = owner_user
            session.add(
                PetOwnerLink(
                    id=_seed_uuid("pet-owner-link", idx + 1),
                    pet_id=pet.id,
                    owner_user_id=owner_user.id,
                )
            )

            allergy_count = rng.randint(0, 2)
            allergies = rng.sample(allergy_pool, k=allergy_count) if allergy_count else []
            pet_allergy_map[pet.id] = allergies

            qr_token = f"QR-{pet.lapka_id}"
            session.add(
                PetQrToken(
                    id=_seed_uuid("pet-qr-token", idx + 1),
                    token_hash=_hash_token(qr_token),
                    pet_id=pet.id,
                    created_by_user_id=owner_user.id,
                    expires_at=(now + timedelta(days=365)),
                )
            )
        await session.flush()

        token_alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
        for idx, pet in enumerate(pets, start=1):
            owner = pet_owner_map[pet.id]
            passport_token = "pp_" + "".join(token_alphabet[rng.randrange(len(token_alphabet))] for _ in range(56))
            session.add(
                PetPassport(
                    id=_seed_uuid("pet-passport", idx),
                    pet_id=pet.id,
                    public_token=passport_token,
                    emergency_contact_phone=owner.phone,
                    allow_unmasked_phone=(idx % 7 == 0),
                    allergies_summary=", ".join(pet_allergy_map[pet.id]) if pet_allergy_map[pet.id] else None,
                    include_microchip=True,
                )
            )
        await session.flush()

        full_record_pets = pets[:70]
        basic_record_pets = pets[70:90]
        no_consent_pets = pets[90:100]
        inpatient_pets = full_record_pets[:8]

        consent_rows = []
        for idx, pet in enumerate(full_record_pets, start=1):
            consent_rows.append(
                ConsentGrant(
                    id=_seed_uuid("consent-full", idx),
                    pet_id=pet.id,
                    owner_user_id=pet_owner_map[pet.id].id,
                    clinic_id=clinic.id,
                    scope_level=ConsentScope.full_record,
                )
            )
        for idx, pet in enumerate(basic_record_pets, start=1):
            consent_rows.append(
                ConsentGrant(
                    id=_seed_uuid("consent-basic", idx),
                    pet_id=pet.id,
                    owner_user_id=pet_owner_map[pet.id].id,
                    clinic_id=clinic.id,
                    scope_level=ConsentScope.basic_medical,
                )
            )
        camera_scope_blocked_pet_ids = {pet.id for pet in inpatient_pets[-2:]}
        for idx, pet in enumerate(inpatient_pets, start=1):
            consent_rows.append(
                ConsentGrant(
                    id=_seed_uuid("consent-inpatient", idx),
                    pet_id=pet.id,
                    owner_user_id=pet_owner_map[pet.id].id,
                    clinic_id=clinic.id,
                    scope_level=ConsentScope.inpatient_view,
                )
            )
            if pet.id not in camera_scope_blocked_pet_ids:
                consent_rows.append(
                    ConsentGrant(
                        id=_seed_uuid("consent-camera", idx),
                        pet_id=pet.id,
                        owner_user_id=pet_owner_map[pet.id].id,
                        clinic_id=clinic.id,
                        scope_level=ConsentScope.camera_view,
                    )
                )
        session.add_all(consent_rows)
        await session.flush()

        consent_request_seed_pets = no_consent_pets[:3]
        for idx, pet in enumerate(consent_request_seed_pets, start=1):
            requester = vet_users[idx % len(vet_users)]
            session.add(
                ConsentRequest(
                    id=_seed_uuid("consent-request", idx),
                    pet_id=pet.id,
                    clinic_id=clinic.id,
                    requested_by_user_id=requester.id,
                    requested_scope=ConsentScope.basic_medical,
                    message="Запрос доступа к медкарте для продолжения приёма.",
                    status=ConsentRequestStatus.pending,
                )
            )
        await session.flush()

        complaints = [
            "Снижение аппетита",
            "Периодическая рвота",
            "Кашель после активности",
            "Зуд кожи",
            "Лёгкая хромота",
            "Частое мочеиспускание",
            "Вялость",
            "Слезотечение",
            "Частое чихание",
            "Плановый контроль",
        ]
        exam_templates = [
            "Состояние стабильное, температура без выраженных отклонений, слизистые розовые.",
            "Умеренная болезненность при пальпации, дыхание ровное, гидратация сохранена.",
            "Мягкая вялость, частота дыхания в пределах наблюдения, экстренных признаков нет.",
            "Кожные покровы без острых поражений, локальное раздражение.",
            "Состояние средней тяжести, требуется динамическое наблюдение.",
        ]
        diagnosis_names = [
            "Гастрит",
            "Дерматит",
            "Отит наружный",
            "Цистит",
            "Конъюнктивит",
            "Бронхит",
            "Панкреатит (под вопросом)",
            "Аллергическая реакция",
            "Лёгкая травма мягких тканей",
            "Профилактический осмотр",
        ]
        doc_types = ["blood_test", "biochemistry", "xray", "ultrasound", "discharge", "photo_injury"]
        vaccines_pool = [
            "Комплексная вакцина",
            "Бешенство",
            "Лептоспироз",
            "Калицивироз",
            "Панлейкопения",
            "Парагрипп",
        ]

        visits: list[Visit] = []
        visit_ids_by_vet: dict[uuid.UUID, list[uuid.UUID]] = {vet.id: [] for vet in vet_users}
        barsik_latest_visit_id: uuid.UUID | None = None

        for pet_idx, pet in enumerate(pets):
            visit_count = rng.randint(2, 8)
            is_recent_pet = pet_idx < 30
            random_dates: set[datetime] = set()
            target_random_count = visit_count - 1 if is_recent_pet else visit_count

            while len(random_dates) < max(target_random_count, 1):
                days_ago = rng.randint(90, 1050)
                hour = 9 + rng.randint(0, 8)
                minute = 30 if rng.randint(0, 1) else 0
                random_dates.add((now - timedelta(days=days_ago)).replace(hour=hour, minute=minute))

            if is_recent_pet:
                days_ago = rng.randint(1, 30)
                random_dates.add((now - timedelta(days=days_ago)).replace(hour=10 + (pet_idx % 6), minute=0))

            visit_dates = sorted(list(random_dates))[:visit_count]
            for visit_pos, visit_date in enumerate(visit_dates, start=1):
                vet = vet_users[(pet_idx + visit_pos) % len(vet_users)]
                complaint = complaints[(pet_idx + visit_pos) % len(complaints)]
                exam_text = exam_templates[(pet_idx + visit_pos) % len(exam_templates)]
                allergy_note = ", ".join(pet_allergy_map[pet.id]) if pet_allergy_map[pet.id] else "аллергии не отмечены"
                diag_count = 1 + ((pet_idx + visit_pos) % 3)
                diag_selected = diagnosis_names[(pet_idx + visit_pos) % len(diagnosis_names):]
                diag_selected = (diag_selected + diagnosis_names)[:diag_count]
                plan_note = (
                    f"Оценка состояния: {', '.join(diag_selected)}. "
                    f"Аллергический статус: {allergy_note}. "
                    "План диагностики и наблюдения фиксируется врачом, без автоназначений."
                )

                visit_id = _seed_uuid("visit", pet_idx * 10 + visit_pos)
                if pet.id == DEMO_IDS["barsik_pet"] and visit_pos == len(visit_dates):
                    visit_id = DEMO_IDS["barsik_visit"]
                    barsik_latest_visit_id = visit_id
                    visit_vet_id = DEMO_IDS["vet_user"]
                else:
                    visit_vet_id = vet.id

                visit = Visit(
                    id=visit_id,
                    pet_id=pet.id,
                    clinic_id=clinic.id,
                    vet_id=visit_vet_id,
                    status=VisitStatus.completed,
                    complaints=complaint,
                    anamnesis="Собран базовый анамнез владельца, включая питание, активность и перенесённые реакции.",
                    physical_exam=exam_text,
                    diagnostics="ОАК/биохимия по показаниям, визуальная диагностика при необходимости.",
                    assessment_note=f"Клиническая оценка врача: {', '.join(diag_selected)}.",
                    follow_up_note="Контрольный визит по клинической динамике и наблюдению владельца.",
                    owner_summary=(
                        f"Визит завершён: {complaint}. "
                        "Проведён осмотр и сформирован план наблюдения. "
                        "При ухудшении состояния свяжитесь с клиникой."
                    ),
                    attachments_json=[],
                    chief_complaint=complaint,
                    exam_findings=exam_text,
                    plan_note=plan_note,
                    finalized_flag=True,
                    started_at=visit_date - timedelta(minutes=15),
                    finalized_at=visit_date + timedelta(minutes=45),
                    locked_at=visit_date + timedelta(minutes=45),
                    created_at=visit_date,
                    updated_at=visit_date + timedelta(minutes=45),
                )
                session.add(visit)
                await session.flush()
                visits.append(visit)
                visit_ids_by_vet[vet.id].append(visit.id)

                if (pet_idx + visit_pos) % 2 == 0:
                    session.add(
                        Prescription(
                            id=_seed_uuid("prescription", pet_idx * 10 + visit_pos),
                            visit_id=visit.id,
                            drug_name=f"Препарат {((pet_idx + visit_pos) % 35) + 1}",
                            instruction_note="Информация в демо-режиме. Решение и схема определяются ветеринарным врачом.",
                            prescription_required=((pet_idx + visit_pos) % 3 == 0),
                        )
                    )

                documents_count = rng.randint(0, 3)
                for doc_idx in range(documents_count):
                    doc_type = doc_types[(pet_idx + visit_pos + doc_idx) % len(doc_types)]
                    file_ext = "pdf" if doc_type in {"blood_test", "biochemistry", "discharge"} else "jpg"
                    session.add(
                        Document(
                            id=_seed_uuid("document", pet_idx * 100 + visit_pos * 10 + doc_idx),
                            pet_id=pet.id,
                            clinic_id=clinic.id,
                            uploaded_by=vet.id,
                            doc_type=doc_type,
                            file_ref=f"storage/documents/{pet.id}-{visit.id}-{doc_idx + 1}.{file_ext}",
                            created_at=visit_date + timedelta(minutes=doc_idx + 5),
                        )
                    )

            vaccine_count = rng.randint(0, 6)
            for vaccine_idx in range(vaccine_count):
                administered_at = (now - timedelta(days=rng.randint(30, 950))).replace(hour=11, minute=0)
                next_due = administered_at + timedelta(days=365)
                vet = vet_users[(pet_idx + vaccine_idx) % len(vet_users)]
                session.add(
                    VaccineEntry(
                        id=_seed_uuid("vaccine", pet_idx * 10 + vaccine_idx),
                        pet_id=pet.id,
                        clinic_id=clinic.id,
                        vaccine_name=vaccines_pool[(pet_idx + vaccine_idx) % len(vaccines_pool)],
                        administered_at=administered_at,
                        next_due_date=next_due,
                        created_by=vet.id,
                    )
                )
        await session.flush()

        if barsik_latest_visit_id is None:
            barsik_latest_visit_id = DEMO_IDS["barsik_visit"]

        session.add(
            Prescription(
                id=_seed_uuid("barsik-prescription", 1),
                visit_id=barsik_latest_visit_id,
                drug_name="Демо препарат",
                instruction_note="План назначения подтверждается ветеринарным врачом. Без схем для владельца.",
                prescription_required=True,
            )
        )
        for idx, (doc_type, ext) in enumerate(
            [("blood_test", "pdf"), ("biochemistry", "pdf"), ("xray", "jpg"), ("ultrasound", "pdf")],
            start=1,
        ):
            session.add(
                Document(
                    id=_seed_uuid("barsik-document-fixed", idx),
                    pet_id=DEMO_IDS["barsik_pet"],
                    clinic_id=clinic.id,
                    uploaded_by=vet_main.id,
                    doc_type=doc_type,
                    file_ref=f"storage/documents/barsik-{doc_type}.{ext}",
                    created_at=now - timedelta(days=idx + 2),
                )
            )

        upcoming_barsik_vaccine = now + timedelta(days=7)
        session.add(
            Reminder(
                id=_seed_uuid("reminder-barsik-vaccine", 1),
                pet_id=DEMO_IDS["barsik_pet"],
                owner_user_id=owner_main.id,
                reminder_type=ReminderType.vaccine,
                title="Вакцинация Барсика",
                due_at=upcoming_barsik_vaccine,
                notes="Плановая вакцинация, напоминание владельцу.",
                is_done=False,
            )
        )

        lost_reports: list[LostPetReport] = []
        lost_seed_pet_ids = [pets[4].id, pets[9].id, pets[15].id, pets[22].id, pets[31].id]
        lost_cities = ["Санкт-Петербург", "Санкт-Петербург", "Кудрово", "Мурино", "Пушкин"]
        for idx, pet_id in enumerate(lost_seed_pet_ids, start=1):
            owner = pet_owner_map[pet_id]
            pet = next((row for row in pets if row.id == pet_id), None)
            if not pet:
                continue
            report = LostPetReport(
                id=_seed_uuid("lost-pet-report", idx),
                pet_id=pet.id,
                owner_id=owner.id,
                city=lost_cities[idx - 1],
                last_seen_location=f"Район {idx}, ориентир: парк/двор",
                last_seen_time=now - timedelta(hours=idx * 7),
                description=f"{pet.name}: заметен ошейник, откликается на имя. Помогите вернуть домой.",
                photo_url=pet.photo_url,
                status=LostPetStatus.active if idx < 5 else LostPetStatus.found,
            )
            session.add(report)
            lost_reports.append(report)

        await session.flush()

        for idx, report in enumerate(lost_reports[:2], start=1):
            sighting = LostPetSighting(
                id=_seed_uuid("lost-pet-sighting", idx),
                report_id=report.id,
                reporter_name=f"Очевидец {idx}",
                reporter_contact=f"+7900123{idx:04d}",
                location_note=f"{report.city}, возле дома {20 + idx}",
                message="Похожего питомца видели рядом, возможно двигается к парку.",
                created_at=now - timedelta(hours=idx),
            )
            session.add(sighting)
            session.add(
                Notification(
                    id=_seed_uuid("notification-lost-pet", idx),
                    user_id=report.owner_id,
                    pet_id=report.pet_id,
                    notification_type=NotificationType.inpatient_update,
                    channel="in_app",
                    title="Потерян питомец",
                    body="Ваш питомец был помечен как потерян; проверьте приложение.",
                )
            )

        for idx in range(10):
            inviter = owner_users[idx % len(owner_users)]
            referral_code = f"LPK-REF-{idx + 1:03d}-{str(_seed_uuid('ref-code', idx + 1)).split('-')[0].upper()}"
            session.add(
                Referral(
                    id=_seed_uuid("referral", idx + 1),
                    inviter_user_id=inviter.id,
                    invited_email=f"friend{idx + 1:02d}@lapka-demo.local",
                    referral_code=referral_code,
                    status=ReferralStatus.registered if idx % 4 == 0 else ReferralStatus.sent,
                    registered_at=(now - timedelta(days=idx + 1)) if idx % 4 == 0 else None,
                    created_at=now - timedelta(days=idx),
                )
            )

        clinic_invite_rows = [
            ("VetFamily", "hello@vetfamily.demo", "Просим подключить клинику к Лапке для единой карты."),
            ("AnimalCare Район", "contact@animalcare.demo", "Хотим видеть историю питомца между визитами."),
            ("Доктор Хвост", "info@doctorhvost.demo", "Готовы протестировать платформу с филиалом."),
        ]
        for idx, (clinic_name, clinic_email, message) in enumerate(clinic_invite_rows, start=1):
            session.add(
                ClinicInvite(
                    id=_seed_uuid("clinic-invite", idx),
                    inviter_user_id=owner_users[idx].id,
                    clinic_name=clinic_name,
                    clinic_email=clinic_email,
                    message=message,
                    status=ClinicInviteStatus.pending,
                    created_at=now - timedelta(days=idx),
                )
            )

        inpatient_stays: list[InpatientStay] = []
        inpatient_event_total = 0
        event_templates = [
            ("Обновление статуса", "Пациент стабилен, команда продолжает мониторинг."),
            ("Контроль витальных показателей", "Проверены базовые показатели, экстренных сигналов нет."),
            ("Обновление для владельца", "Добавлена свежая заметка о динамике состояния."),
            ("Плановая процедура", "Выполнен запланированный этап наблюдения."),
            ("Контроль активности", "Питомец реагирует на контакт, поведение отмечено в карте."),
            ("Обновление дневного плана", "План на ближайшие часы уточнён дежурным врачом."),
            ("Диагностический этап", "Подготовлен безопасный комментарий по текущему обследованию."),
        ]
        for idx, pet in enumerate(inpatient_pets, start=1):
            vet = vet_users[idx % len(vet_users)]
            stay_id = DEMO_IDS["barsik_stay"] if pet.id == DEMO_IDS["barsik_pet"] else _seed_uuid("stay", idx)
            public_status = [InpatientPublicStatus.stable, InpatientPublicStatus.monitoring, InpatientPublicStatus.needs_attention][
                idx % 3
            ]
            stay = InpatientStay(
                id=stay_id,
                pet_id=pet.id,
                clinic_id=clinic.id,
                attending_vet_id=vet.id,
                ward=f"{chr(64 + ((idx - 1) % 4) + 1)}",
                bed=f"{((idx - 1) % 4) + 1}-{idx}",
                status=InpatientStatus.active,
                public_status_label=public_status,
                owner_visible_summary=(
                    "Команда стационара наблюдает состояние питомца, обновления публикуются по SLA."
                    if public_status != InpatientPublicStatus.needs_attention
                    else "Требуется усиленный мониторинг. Команда клиники регулярно публикует безопасные обновления."
                ),
                admitted_at=now - timedelta(days=idx % 5 + 1),
                created_at=now - timedelta(days=idx % 5 + 1),
            )
            session.add(stay)
            await session.flush()
            inpatient_stays.append(stay)

            daily_tasks = [
                "Контроль жизненных показателей",
                "Плановый фото-отчёт для владельца",
                "Оценка аппетита и активности",
                "Актуализация owner-visible статуса",
            ]
            for task_idx, task in enumerate(daily_tasks, start=1):
                session.add(
                    InpatientPlan(
                        id=_seed_uuid("stay-plan", idx * 10 + task_idx),
                        stay_id=stay.id,
                        plan_date=now.replace(hour=8, minute=0),
                        task_text=task,
                        created_by=vet.id,
                    )
                )

            for obs_idx in range(4):
                observed_at = now - timedelta(hours=obs_idx * 4 + 1)
                session.add(
                    InpatientObservation(
                        id=_seed_uuid("stay-observation", idx * 10 + obs_idx),
                        stay_id=stay.id,
                        observed_at=observed_at,
                        temperature_c=str(round(38.1 + (obs_idx * 0.2), 1)),
                        appetite=["снижен", "умеренный", "хороший", "хороший"][obs_idx % 4],
                        activity=["спокойный", "активный", "сонливость", "умеренная активность"][obs_idx % 4],
                        note="Наблюдение без экстренных признаков, данные переданы лечащему врачу.",
                        created_by=vet.id,
                    )
                )

            photo_count = rng.randint(2, 6)
            for photo_idx in range(photo_count):
                session.add(
                    InpatientPhotoReport(
                        id=_seed_uuid("stay-photo", idx * 10 + photo_idx),
                        stay_id=stay.id,
                        taken_at=now - timedelta(hours=photo_idx * 3 + 1),
                        caption=f"Фото-отчёт #{photo_idx + 1}: визуальный контроль без тревожных признаков",
                        file_ref=f"https://picsum.photos/seed/lapka-inpatient-{idx}-{photo_idx}/960/640",
                        created_by=vet.id,
                    )
                )

            # 10-25 событий за последние 3 дня для owner/vet/admin timeline.
            event_count = rng.randint(10, 25)
            inpatient_event_total += event_count
            for event_idx in range(event_count):
                title, description = event_templates[(event_idx + idx) % len(event_templates)]
                event_time = now - timedelta(hours=rng.randint(1, 72), minutes=rng.randint(0, 59))
                event_type = [
                    InpatientEventType.status_update,
                    InpatientEventType.note,
                    InpatientEventType.vitals_check,
                    InpatientEventType.feeding,
                    InpatientEventType.procedure,
                ][(event_idx + idx) % 5]
                session.add(
                    InpatientEvent(
                        id=_seed_uuid("stay-event", idx * 100 + event_idx),
                        stay_id=stay.id,
                        created_by_user_id=vet.id,
                        event_type=event_type,
                        owner_visible=True,
                        title=title,
                        description_safe=description,
                        created_at=event_time,
                    )
                )

            camera_count = 2 if pet.id == DEMO_IDS["barsik_pet"] else 1 + (idx % 2)
            for camera_idx in range(camera_count):
                session.add(
                    Camera(
                        id=_seed_uuid("stay-camera", idx * 10 + camera_idx),
                        stay_id=stay.id,
                        camera_name=f"Палата {stay.ward}-{stay.bed} камера {camera_idx + 1}",
                        stream_ref_stub=f"https://stream.demo.lapka.local/{stay.id}/cam{camera_idx + 1}",
                        is_active=True,
                    )
                )
        await session.flush()

        services_seed = [
            ("Консультация", 30, 2500),
            ("Вакцинация", 25, 1800),
            ("УЗИ", 40, 3200),
            ("Хирургическая консультация", 45, 3800),
            ("Телемедицина", 30, 2200),
        ]
        service_map: dict[str, Service] = {}
        for idx, (name, duration, price) in enumerate(services_seed, start=1):
            service = Service(
                id=_seed_uuid("service", idx),
                clinic_id=clinic.id,
                name=name,
                duration_min=duration,
                price=price,
                is_active=True,
            )
            service_map[name] = service
            session.add(service)

        appt_type_map: dict[str, AppointmentType] = {}
        appt_types = [
            ("consultation", "Консультация", 30, False),
            ("vaccination", "Вакцинация", 25, False),
            ("ultrasound", "УЗИ", 40, False),
            ("surgery_consult", "Хирургическая консультация", 45, False),
            ("video_consultation", "Телемедицина", 30, True),
        ]
        for idx, (code, name, duration, telemedicine) in enumerate(appt_types, start=1):
            forced_id = None
            if code == "consultation":
                forced_id = DEMO_IDS["appt_type_clinic"]
            elif code == "video_consultation":
                forced_id = DEMO_IDS["appt_type_video"]
            elif code == "vaccination":
                forced_id = DEMO_IDS["appt_type_vaccine"]
            row = AppointmentType(
                id=forced_id or _seed_uuid("appointment-type", idx),
                clinic_id=clinic.id,
                code=code,
                name=name,
                default_duration_minutes=duration,
                is_telemedicine=telemedicine,
                is_active=True,
            )
            appt_type_map[code] = row
            session.add(row)

        for clinic_index, extra_clinic in enumerate(extra_clinics, start=1):
            for idx, (name, duration, price) in enumerate(services_seed, start=1):
                session.add(
                    Service(
                        id=_demo_uuid(f"service-{extra_clinic.id}-{idx}"),
                        clinic_id=extra_clinic.id,
                        name=name,
                        duration_min=duration,
                        price=price + (clinic_index * 200),
                        is_active=True,
                    )
                )
            for idx, (code, name, duration, telemedicine) in enumerate(appt_types, start=1):
                session.add(
                    AppointmentType(
                        id=_demo_uuid(f"appointment-type-{extra_clinic.id}-{code}"),
                        clinic_id=extra_clinic.id,
                        code=code,
                        name=name,
                        default_duration_minutes=duration,
                        is_telemedicine=telemedicine,
                        is_active=True,
                    )
                )
        await session.flush()

        for idx, vet in enumerate(vet_users, start=1):
            for weekday in range(5):
                session.add(
                    DoctorSchedule(
                        id=_seed_uuid("doctor-schedule", idx * 10 + weekday),
                        clinic_id=clinic.id,
                        vet_id=vet.id,
                        weekday=weekday,
                        start_time=datetime.strptime("09:00", "%H:%M").time(),
                        end_time=datetime.strptime("17:00", "%H:%M").time(),
                        slot_duration=30,
                        is_active=True,
                    )
                )

        for clinic_index, extra_clinic in enumerate(extra_clinics, start=1):
            for vet_index, vet in enumerate(clinic_vet_map[extra_clinic.id], start=1):
                for weekday in range(5):
                    session.add(
                        DoctorSchedule(
                            id=_demo_uuid(f"doctor-schedule-{extra_clinic.id}-{vet.id}-{weekday}"),
                            clinic_id=extra_clinic.id,
                            vet_id=vet.id,
                            weekday=weekday,
                            start_time=datetime.strptime("10:00", "%H:%M").time(),
                            end_time=datetime.strptime("18:00", "%H:%M").time(),
                            slot_duration=30,
                            is_active=True,
                        )
                    )

        appointments: list[Appointment] = []
        for idx in range(80):
            pet = pets[idx % len(pets)]
            owner_user = pet_owner_map[pet.id]
            vet = vet_users[idx % len(vet_users)]
            day_offset = idx % 14
            hour = 9 + ((idx // 14) % 8)
            minute = 30 if idx % 2 else 0
            scheduled_at = (now + timedelta(days=day_offset)).replace(hour=hour, minute=minute)
            is_telemedicine = idx < 10

            service_name = "Телемедицина" if is_telemedicine else services_seed[idx % 4][0]
            appt_type = appt_type_map["video_consultation" if is_telemedicine else appt_types[idx % 4][0]]

            appointment_id = _seed_uuid("appointment", idx + 1)
            if idx == 0:
                appointment_id = DEMO_IDS["appt_barsik"]
                pet = pets[0]
                owner_user = pet_owner_map[pet.id]
                vet = vet_main
            elif idx == 1:
                appointment_id = DEMO_IDS["appt_video_barsik"]
                pet = pets[0]
                owner_user = pet_owner_map[pet.id]
                vet = vet_main
                is_telemedicine = True
                service_name = "Телемедицина"
                appt_type = appt_type_map["video_consultation"]
            elif idx == 2:
                appointment_id = DEMO_IDS["appt_checkup_max"]
                pet = pets[45]
                owner_user = pet_owner_map[pet.id]
                vet = vet_main
                service_name = "Вакцинация"
                appt_type = appt_type_map["vaccination"]

            status = AppointmentStatus.confirmed if idx % 4 == 0 else AppointmentStatus.scheduled
            meeting_token = f"tele-{idx + 1:03d}" if is_telemedicine else None
            video_link = f"https://telemed.lapka.demo/meeting/{meeting_token}" if is_telemedicine else None
            clinic_location = primary_demo_location
            location_resources = location_resources_map.get(primary_demo_location.id, [])
            if is_telemedicine:
                selected_resource = next(
                    (resource for resource in location_resources if resource.resource_type == "telemedicine"),
                    location_resources[0] if location_resources else None,
                )
            else:
                resource_pool = [resource for resource in location_resources if resource.resource_type != "telemedicine"]
                selected_resource = resource_pool[idx % len(resource_pool)] if resource_pool else (location_resources[0] if location_resources else None)

            row = Appointment(
                id=appointment_id,
                clinic_id=clinic.id,
                pet_id=pet.id,
                owner_user_id=owner_user.id,
                vet_id=vet.id,
                clinic_location_id=clinic_location.id if clinic_location else None,
                clinic_resource_id=selected_resource.id if selected_resource else None,
                appointment_type_id=appt_type.id,
                service_type=service_name,
                service_name=service_name,
                start_at=scheduled_at,
                duration_minutes=appt_type.default_duration_minutes,
                room_label=selected_resource.name if selected_resource else None,
                visit_type="video_consultation" if is_telemedicine else "clinic_visit",
                video_link=video_link,
                meeting_token=meeting_token,
                status=status,
                notes="Запись создана в демо-датасете.",
            )
            appointments.append(row)
            session.add(row)
            await session.flush()

            if idx < 50:
                for offset_min in (1440, 120):
                    session.add(
                        Reminder(
                            id=_seed_uuid("reminder-appointment", idx * 10 + offset_min),
                            pet_id=pet.id,
                            owner_user_id=owner_user.id,
                            appointment_id=row.id,
                            reminder_type=ReminderType.checkup,
                            remind_before_minutes=offset_min,
                            channel="in_app",
                            title=f"Напоминание о визите ({'24 часа' if offset_min == 1440 else '2 часа'})",
                            due_at=scheduled_at - timedelta(minutes=offset_min),
                            notes=f"{service_name} · {scheduled_at.strftime('%d.%m.%Y %H:%M')}",
                            is_done=False,
                        )
                    )

        # In-app notifications for Clinic Visit Journey demo.
        first_upcoming = appointments[0] if appointments else None
        if first_upcoming:
            session.add(
                Notification(
                    id=_seed_uuid("notification", 1),
                    user_id=first_upcoming.owner_user_id,
                    pet_id=first_upcoming.pet_id,
                    appointment_id=first_upcoming.id,
                    notification_type=NotificationType.appointment_reminder,
                    channel="in_app",
                    title="Напоминание о приёме",
                    body=f"Запись запланирована на {first_upcoming.start_at.strftime('%d.%m.%Y %H:%M')}.",
                    metadata_json={"channel": "in_app"},
                    is_read=False,
                    created_at=now - timedelta(hours=1),
                )
            )

        session.add(
            Notification(
                id=_seed_uuid("notification", 2),
                user_id=owner_main.id,
                pet_id=DEMO_IDS["barsik_pet"],
                visit_id=barsik_latest_visit_id,
                notification_type=NotificationType.visit_ready,
                channel="in_app",
                title="Выписка по визиту готова",
                body="Откройте карточку Барсика, чтобы посмотреть summary визита и назначения.",
                metadata_json={"visit_id": str(barsik_latest_visit_id)},
                is_read=False,
                created_at=now - timedelta(minutes=20),
            )
        )

        clinic_services_seed = [
            ("Первичный приём", ClinicServiceCategory.consultation, 280000, 30),
            ("Повторный приём", ClinicServiceCategory.consultation, 210000, 25),
            ("Вакцинация комплексная", ClinicServiceCategory.vaccination, 190000, 20),
            ("Вакцинация бешенство", ClinicServiceCategory.vaccination, 140000, 20),
            ("УЗИ брюшной полости", ClinicServiceCategory.imaging, 360000, 45),
            ("Рентген обзорный", ClinicServiceCategory.imaging, 320000, 35),
            ("Лабораторный пакет ОАК", ClinicServiceCategory.lab, 170000, 20),
            ("Биохимический профиль", ClinicServiceCategory.lab, 240000, 20),
            ("Хирургическая консультация", ClinicServiceCategory.surgery, 420000, 45),
            ("Стационар 24 часа", ClinicServiceCategory.inpatient, 650000, 1440),
            ("Телемед-консультация", ClinicServiceCategory.telemedicine, 230000, 30),
            ("Процедурный кабинет", ClinicServiceCategory.other, 180000, 30),
        ]
        clinic_services: list[ClinicService] = []
        for idx, (name, category, price_cents, duration_minutes) in enumerate(clinic_services_seed, start=1):
            row = ClinicService(
                id=_seed_uuid("clinic-service", idx),
                clinic_id=clinic.id,
                name=name,
                category=category,
                price_cents=price_cents,
                currency="RUB",
                duration_minutes=duration_minutes,
                is_active=True,
            )
            clinic_services.append(row)
            session.add(row)
        for clinic_index, extra_clinic in enumerate(extra_clinics, start=1):
            for idx, (name, category, price_cents, duration_minutes) in enumerate(clinic_services_seed, start=1):
                row = ClinicService(
                    id=_demo_uuid(f"clinic-service-{extra_clinic.id}-{idx}"),
                    clinic_id=extra_clinic.id,
                    name=name,
                    category=category,
                    price_cents=price_cents + (clinic_index * 20000),
                    currency="RUB",
                    duration_minutes=duration_minutes,
                    is_active=True,
                )
                clinic_services.append(row)
                session.add(row)
        await session.flush()

        visits_by_pet: dict[uuid.UUID, list[Visit]] = {}
        for visit in visits:
            visits_by_pet.setdefault(visit.pet_id, []).append(visit)
        appointments_by_pet: dict[uuid.UUID, list[Appointment]] = {}
        for appointment in appointments:
            appointments_by_pet.setdefault(appointment.pet_id, []).append(appointment)

        invoices: list[Invoice] = []
        invoice_items_total = 0
        payments_total = 0
        for idx in range(120):
            pet = pets[idx % len(pets)]
            owner_user = pet_owner_map[pet.id]
            pet_visits = visits_by_pet.get(pet.id, [])
            pet_appointments = appointments_by_pet.get(pet.id, [])
            linked_visit = pet_visits[idx % len(pet_visits)] if pet_visits and idx % 2 == 0 else None
            linked_appointment = (
                pet_appointments[idx % len(pet_appointments)] if pet_appointments and idx % 3 == 0 else None
            )
            created_at = now - timedelta(days=(idx % 90), hours=idx % 12)

            if idx < 55:
                invoice_status = InvoiceStatus.paid
            elif idx < 100:
                invoice_status = InvoiceStatus.issued
            else:
                invoice_status = InvoiceStatus.draft

            invoice = Invoice(
                id=_seed_uuid("invoice", idx + 1),
                clinic_id=clinic.id,
                owner_id=owner_user.id,
                pet_id=pet.id,
                visit_id=linked_visit.id if linked_visit else None,
                appointment_id=linked_appointment.id if linked_appointment else None,
                status=invoice_status,
                total_cents=0,
                currency="RUB",
                issued_at=created_at + timedelta(hours=2) if invoice_status in {InvoiceStatus.issued, InvoiceStatus.paid} else None,
                paid_at=created_at + timedelta(hours=3) if invoice_status == InvoiceStatus.paid else None,
                public_token=f"inv_{_seed_uuid('invoice-token', idx + 1).hex[:32]}"
                if invoice_status in {InvoiceStatus.issued, InvoiceStatus.paid}
                else None,
                created_at=created_at,
                updated_at=created_at + timedelta(hours=4),
            )
            session.add(invoice)
            await session.flush()
            invoices.append(invoice)

            items_count = 1 + (idx % 3)
            invoice_total = 0
            for item_idx in range(items_count):
                service = clinic_services[(idx + item_idx) % len(clinic_services)]
                qty = 1 + ((idx + item_idx) % 2)
                unit_price = service.price_cents + (((idx * 37 + item_idx * 53) % 40000) - 12000)
                unit_price = max(60000, unit_price)
                total_cents = unit_price * qty
                invoice_total += total_cents
                invoice_items_total += 1
                session.add(
                    InvoiceItem(
                        id=_seed_uuid("invoice-item", idx * 10 + item_idx + 1),
                        invoice_id=invoice.id,
                        service_id=service.id,
                        name=service.name,
                        qty=qty,
                        unit_price_cents=unit_price,
                        total_cents=total_cents,
                        created_at=created_at + timedelta(minutes=5 + item_idx),
                    )
                )

            invoice.total_cents = invoice_total

            if invoice.status == InvoiceStatus.paid and payments_total < 85:
                payment_status = PaymentStatus.succeeded if idx % 9 else PaymentStatus.refunded
                session.add(
                    Payment(
                        id=_seed_uuid("payment", idx + 1),
                        invoice_id=invoice.id,
                        provider="demo",
                        status=payment_status,
                        amount_cents=invoice.total_cents,
                        currency=invoice.currency,
                        receipt_text=f"Demo payment receipt for invoice {invoice.id}",
                        created_at=(invoice.paid_at or created_at + timedelta(hours=3)),
                        updated_at=(invoice.paid_at or created_at + timedelta(hours=3)),
                    )
                )
                payments_total += 1

        policies_total = 0
        for idx, owner in enumerate(owner_users[:24], start=1):
            session.add(
                InsurancePolicy(
                    id=_seed_uuid("insurance-policy", idx),
                    owner_id=owner.id,
                    provider_name=f"Vet Insurance {1 + (idx % 4)}",
                    policy_number_masked=f"****{1000 + idx}",
                    status=InsurancePolicyStatus.active if idx % 6 else InsurancePolicyStatus.inactive,
                    created_at=now - timedelta(days=idx * 3),
                    updated_at=now - timedelta(days=idx),
                )
            )
            policies_total += 1

        claims_total = 0
        claim_statuses = [
            InsuranceClaimStatus.submitted,
            InsuranceClaimStatus.approved,
            InsuranceClaimStatus.rejected,
            InsuranceClaimStatus.draft,
        ]
        invoices_for_claims = [row for row in invoices if row.status in {InvoiceStatus.paid, InvoiceStatus.issued}]
        for idx in range(20):
            invoice = invoices_for_claims[idx % len(invoices_for_claims)]
            claim_status = claim_statuses[idx % len(claim_statuses)]
            session.add(
                InsuranceClaim(
                    id=_seed_uuid("insurance-claim", idx + 1),
                    clinic_id=clinic.id,
                    owner_id=invoice.owner_id,
                    pet_id=invoice.pet_id,
                    invoice_id=invoice.id,
                    status=claim_status,
                    notes=f"Демо-claim {idx + 1}: статус {claim_status.value}.",
                    created_at=now - timedelta(days=idx + 5),
                    updated_at=now - timedelta(days=idx % 4),
                )
            )
            claims_total += 1

        lab_provider_demo = LabProvider(
            id=_seed_uuid("lab-provider", 1),
            name="DemoLab Core",
            provider_type="demo",
            is_active=True,
            created_at=now - timedelta(days=60),
        )
        lab_provider_backup = LabProvider(
            id=_seed_uuid("lab-provider", 2),
            name="DemoLab Backup",
            provider_type="demo",
            is_active=True,
            created_at=now - timedelta(days=30),
        )
        session.add_all([lab_provider_demo, lab_provider_backup])
        await session.flush()

        lab_orders_total = 0
        lab_results_total = 0
        for idx in range(40):
            pet = pets[(idx * 3) % len(pets)]
            owner_user = pet_owner_map[pet.id]
            vet = vet_users[idx % len(vet_users)]
            pet_visits = visits_by_pet.get(pet.id, [])
            ordered_at = now - timedelta(days=(idx % 45), hours=idx % 8)
            order_status = (
                LabOrderStatus.received if idx < 25 else LabOrderStatus.sent if idx < 35 else LabOrderStatus.created
            )
            order = LabOrder(
                id=_seed_uuid("lab-order", idx + 1),
                clinic_id=clinic.id,
                pet_id=pet.id,
                visit_id=pet_visits[0].id if pet_visits else None,
                provider_id=lab_provider_demo.id if idx % 5 else lab_provider_backup.id,
                status=order_status,
                ordered_at=ordered_at,
                received_at=ordered_at + timedelta(days=1) if order_status == LabOrderStatus.received else None,
                external_ref=f"LAB-{idx + 1:04d}" if order_status in {LabOrderStatus.sent, LabOrderStatus.received} else None,
                created_by=vet.id,
                created_at=ordered_at,
                updated_at=ordered_at + timedelta(hours=12),
            )
            session.add(order)
            await session.flush()
            lab_orders_total += 1

            if idx < 25:
                session.add(
                    LabResult(
                        id=_seed_uuid("lab-result", idx + 1),
                        order_id=order.id,
                        result_text=(
                            "Демо-результат: показатели представлены для обсуждения с ветеринарным врачом. "
                            "Владелец получает только безопасную интерпретацию."
                        ),
                        attachments_json=[
                            f"https://picsum.photos/seed/lapka-lab-result-{idx + 1}-a/1400/1000",
                            f"https://picsum.photos/seed/lapka-lab-result-{idx + 1}-b/1400/1000",
                        ],
                        created_at=ordered_at + timedelta(days=1, hours=2),
                    )
                )
                lab_results_total += 1

        def add_template_seed(
            *,
            template_id: uuid.UUID,
            clinic_id: uuid.UUID,
            template_type: str,
            name: str,
            body: str,
            created_by: uuid.UUID,
            scope: str = "clinic",
            specialty: str | None = None,
            visibility: str = "clinic",
            status: str = "draft",
            version: int = 1,
            source_template_id: uuid.UUID | None = None,
            is_default: bool = False,
            usage_count: int = 0,
            scenario_tags: list[str] | None = None,
            updated_delta_days: int = 0,
            last_used_delta_days: int | None = None,
        ) -> None:
            updated_at = now - timedelta(days=updated_delta_days)
            last_used_at = None if last_used_delta_days is None else now - timedelta(days=last_used_delta_days)
            session.add(
                Template(
                    id=template_id,
                    clinic_id=clinic_id,
                    template_type=template_type,
                    name=name,
                    body=body,
                    scope=scope,
                    specialty=specialty,
                    visibility=visibility,
                    status=status,
                    version=version,
                    source_template_id=source_template_id,
                    is_default=is_default,
                    scenario_tags_json=scenario_tags or [],
                    usage_count=usage_count,
                    last_used_at=last_used_at,
                    created_by=created_by,
                    created_at=updated_at - timedelta(days=max(version, 1)),
                    updated_at=updated_at,
                )
            )

        main_template_ids = {
            "visit_protocol": DEMO_IDS["template_main"],
            "owner_reco": _seed_uuid("template", 2),
            "exam_checklist": _seed_uuid("template", 3),
            "prescription": _seed_uuid("template", 4),
            "triage_note": _seed_uuid("template", 5),
            "inpatient_report": _seed_uuid("template", 6),
        }
        main_template_seed = [
            (
                main_template_ids["visit_protocol"],
                "visit_protocol",
                "Шаблон приёма",
                "Жалобы: {{complaints}}\nОсмотр: {{exam}}\nПлан: {{plan}}",
                "clinic",
                "general",
                "clinic",
                "published",
                True,
                28,
                ["primary_exam", "intake"],
                admin_main.id,
            ),
            (
                main_template_ids["owner_reco"],
                "owner_reco",
                "Рекомендации владельцу",
                "Наблюдение: {{plan}}\nКонтроль: {{meds}}",
                "clinic",
                "therapy",
                "clinic",
                "published",
                True,
                19,
                ["owner_summary", "follow_up"],
                admin_main.id,
            ),
            (
                main_template_ids["exam_checklist"],
                "exam_checklist",
                "Чеклист осмотра",
                "Вес: {{weight}}\nЖалобы: {{complaints}}",
                "clinic",
                "general",
                "clinic",
                "published",
                False,
                23,
                ["primary_exam", "checklist"],
                admin_main.id,
            ),
            (
                main_template_ids["prescription"],
                "prescription",
                "Шаблон назначения",
                "Препарат: {{meds}}\nКомментарий врача.",
                "branch",
                "therapy",
                "branch",
                "published",
                False,
                14,
                ["medications", "owner_summary"],
                admin_main.id,
            ),
            (
                main_template_ids["triage_note"],
                "triage_note",
                "Triage заметка",
                "Симптомы: {{complaints}}\nУточняющие вопросы.",
                "personal",
                "general",
                "private",
                "draft",
                False,
                7,
                ["triage", "intake"],
                vet_main.id,
            ),
            (
                main_template_ids["inpatient_report"],
                "inpatient_report",
                "Отчёт стационара",
                "Пациент: {{pet_name}}\nПлан: {{plan}}",
                "personal",
                "inpatient",
                "private",
                "published",
                True,
                16,
                ["inpatient", "owner_update"],
                vet_users[1].id if len(vet_users) > 1 else vet_main.id,
            ),
        ]
        for idx, (
            template_id,
            template_type,
            name,
            body,
            scope,
            specialty,
            visibility,
            status,
            is_default,
            usage_count,
            scenario_tags,
            created_by,
        ) in enumerate(main_template_seed, start=1):
            add_template_seed(
                template_id=template_id,
                clinic_id=clinic.id,
                template_type=template_type,
                name=name,
                body=body,
                created_by=created_by,
                scope=scope,
                specialty=specialty,
                visibility=visibility,
                status=status,
                version=2 if idx % 2 == 0 else 3,
                is_default=is_default,
                usage_count=usage_count,
                scenario_tags=scenario_tags,
                updated_delta_days=idx * 4,
                last_used_delta_days=max(1, idx * 2),
            )

        for clinic_index, (extra_clinic, spec, admin_user) in enumerate(
            zip(extra_clinics, NETWORK_CLINIC_SPECS, extra_clinic_admins),
            start=1,
        ):
            clinic_vets = clinic_vet_map[extra_clinic.id]
            clinic_templates = [
                (
                    _demo_uuid(f"template-{spec['slug']}-clinic-primary"),
                    "visit_protocol",
                    f"{spec['name']}: первичный приём",
                    "Жалобы: {{complaints}}\nОсмотр: {{exam}}\nПлан: {{plan}}",
                    "clinic",
                    "general",
                    "clinic",
                    "published",
                    True,
                    18 + clinic_index,
                    ["primary_exam", "network_standard"],
                    admin_user.id,
                    None,
                ),
                (
                    _demo_uuid(f"template-{spec['slug']}-owner-summary"),
                    "owner_reco",
                    f"{spec['name']}: owner summary",
                    "Наблюдение: {{plan}}\nКонтроль: {{meds}}",
                    "clinic",
                    "therapy",
                    "clinic",
                    "published",
                    False,
                    11 + clinic_index,
                    ["owner_summary", "follow_up"],
                    admin_user.id,
                    main_template_ids["owner_reco"],
                ),
                (
                    _demo_uuid(f"template-{spec['slug']}-branch-round"),
                    "inpatient_report",
                    f"{spec['name']}: обновление филиала",
                    "Пациент: {{pet_name}}\nПлан: {{plan}}",
                    "branch",
                    "inpatient",
                    "branch",
                    "published",
                    clinic_index % 2 == 0,
                    8 + clinic_index,
                    ["inpatient", "branch_update"],
                    admin_user.id,
                    main_template_ids["inpatient_report"],
                ),
                (
                    _demo_uuid(f"template-{spec['slug']}-personal-{clinic_vets[0].id}"),
                    "exam_checklist",
                    f"{clinic_vets[0].full_name}: personal checklist",
                    "Вес: {{weight}}\nЖалобы: {{complaints}}\nКонтроль: {{plan}}",
                    "personal",
                    spec["vets"][0]["specialty"],
                    "private",
                    "published" if clinic_index % 2 else "draft",
                    True,
                    5 + clinic_index,
                    ["doctor_flow", "personal"],
                    clinic_vets[0].id,
                    main_template_ids["exam_checklist"],
                ),
                (
                    _demo_uuid(f"template-{spec['slug']}-personal-alt-{clinic_vets[-1].id}"),
                    "triage_note",
                    f"{clinic_vets[-1].full_name}: triage card",
                    "Симптомы: {{complaints}}\nУточняющие вопросы.\nКонтроль: {{plan}}",
                    "personal",
                    spec["vets"][-1]["specialty"],
                    "private",
                    "archived" if clinic_index % 3 == 0 else "draft",
                    False,
                    2 + clinic_index,
                    ["triage", "doctor_flow"],
                    clinic_vets[-1].id,
                    main_template_ids["triage_note"],
                ),
            ]
            for offset, (
                template_id,
                template_type,
                name,
                body,
                scope,
                specialty,
                visibility,
                status,
                is_default,
                usage_count,
                scenario_tags,
                created_by,
                source_template_id,
            ) in enumerate(clinic_templates, start=1):
                add_template_seed(
                    template_id=template_id,
                    clinic_id=extra_clinic.id,
                    template_type=template_type,
                    name=name,
                    body=body,
                    created_by=created_by,
                    scope=scope,
                    specialty=specialty,
                    visibility=visibility,
                    status=status,
                    version=1 + ((clinic_index + offset) % 3),
                    source_template_id=source_template_id,
                    is_default=is_default,
                    usage_count=usage_count,
                    scenario_tags=scenario_tags,
                    updated_delta_days=clinic_index * 6 + offset,
                    last_used_delta_days=max(1, clinic_index + offset),
                )

        published_status = ReviewModerationStatus.published
        pending_status = ReviewModerationStatus.pending
        rejected_status = ReviewModerationStatus.rejected
        published_reviews = 0

        for idx in range(150):
            is_clinic_review = idx < 80
            review_id = DEMO_IDS["review_main"] if idx == 0 else _seed_uuid("review", idx + 1)
            target_type = ReviewTargetType.clinic if is_clinic_review else ReviewTargetType.vet
            target_id = clinic.id if is_clinic_review else vet_users[idx % len(vet_users)].id
            vet_id = None if is_clinic_review else target_id
            author = owner_users[idx % len(owner_users)]

            verify = idx < 45
            linked_visit = visits[idx % len(visits)].id if verify else None
            moderation_status = pending_status if idx % 19 == 0 else rejected_status if idx % 37 == 0 else published_status
            if moderation_status == published_status:
                published_reviews += 1

            rating = rng.choices([5, 4, 3, 2], weights=[44, 34, 16, 6], k=1)[0]
            title = REVIEW_TITLES[idx % len(REVIEW_TITLES)]
            review_text = f"{REVIEW_TEXTS[idx % len(REVIEW_TEXTS)]} (демо отзыв #{idx + 1})"

            session.add(
                Review(
                    id=review_id,
                    visit_id=linked_visit,
                    owner_user_id=author.id,
                    vet_id=vet_id,
                    target_type=target_type,
                    target_id=target_id,
                    title=title,
                    verified=verify,
                    rating=rating,
                    text=review_text,
                    moderation_status=moderation_status,
                    created_at=now - timedelta(days=idx % 120, hours=idx % 12),
                )
            )

        extra_review_count = 0
        for clinic_index, extra_clinic in enumerate(extra_clinics, start=1):
            clinic_review_total = 8 + clinic_index * 2
            clinic_vets = clinic_vet_map[extra_clinic.id]
            for review_index in range(clinic_review_total):
                author = owner_users[(review_index + clinic_index * 3) % len(owner_users)]
                rating = rng.choices([5, 4, 3], weights=[48, 36, 16], k=1)[0]
                session.add(
                    Review(
                        id=_demo_uuid(f"review-{extra_clinic.id}-{review_index + 1}"),
                        visit_id=None,
                        owner_user_id=author.id,
                        vet_id=None,
                        target_type=ReviewTargetType.clinic,
                        target_id=extra_clinic.id,
                        title=REVIEW_TITLES[(review_index + clinic_index) % len(REVIEW_TITLES)],
                        verified=False,
                        rating=rating,
                        text=f"{REVIEW_TEXTS[(review_index + clinic_index) % len(REVIEW_TEXTS)]} ({extra_clinic.name})",
                        moderation_status=published_status,
                        created_at=now - timedelta(days=(review_index + clinic_index) % 90, hours=review_index % 12),
                    )
                )
                published_reviews += 1
                extra_review_count += 1
            for vet_index, vet in enumerate(clinic_vets, start=1):
                for review_index in range(5):
                    author = owner_users[(review_index + clinic_index + vet_index) % len(owner_users)]
                    rating = rng.choices([5, 4, 3], weights=[46, 38, 16], k=1)[0]
                    session.add(
                        Review(
                            id=_demo_uuid(f"review-{vet.id}-{review_index + 1}"),
                            visit_id=None,
                            owner_user_id=author.id,
                            vet_id=vet.id,
                            target_type=ReviewTargetType.vet,
                            target_id=vet.id,
                            title=REVIEW_TITLES[(review_index + vet_index) % len(REVIEW_TITLES)],
                            verified=False,
                            rating=rating,
                            text=f"{REVIEW_TEXTS[(review_index + vet_index) % len(REVIEW_TEXTS)]} ({vet.full_name})",
                            moderation_status=published_status,
                            created_at=now - timedelta(days=(review_index + clinic_index + vet_index) % 75, hours=vet_index),
                        )
                    )
                    published_reviews += 1
                    extra_review_count += 1

        for idx in range(60):
            actor = [owner_main, vet_main, admin_main][idx % 3]
            target_pet = pets[idx % len(pets)]
            session.add(
                AuditEvent(
                    id=_seed_uuid("audit", idx + 1),
                    actor_user_id=actor.id,
                    clinic_id=clinic.id,
                    action=["auth.login", "visit.view", "document.view", "consent.grant", "inpatient.view"][idx % 5],
                    target_type=["user", "visit", "document", "consent", "inpatient_stay"][idx % 5],
                    target_id=str(target_pet.id),
                    metadata_json={"seed": True, "index": idx + 1},
                    created_at=now - timedelta(days=idx % 30, hours=idx % 24),
                )
            )

        barsik_rx_hash = _hash_token("barsik-public-link")
        session.add(
            PublicLink(
                id=_seed_uuid("public-prescription", 1),
                token_hash=barsik_rx_hash,
                link_type="prescription",
                visit_id=barsik_latest_visit_id,
                pet_id=DEMO_IDS["barsik_pet"],
                expires_at=now + timedelta(days=7),
            )
        )

        session.add(
            PublicLink(
                id=DEMO_IDS["public_doc_link"],
                token_hash=_hash_token("barsik-public-doc"),
                link_type="document",
                document_id=None,
                pet_id=DEMO_IDS["barsik_pet"],
                expires_at=now + timedelta(days=1),
            )
        )

        await session.flush()
        await _seed_pharmacy_marketplace(
            session,
            rng=rng,
            owner_id=owner_main.id,
            clinic_ids=[row.id for row in all_clinics] if all_clinics else [],
        )
        await session.flush()

        await recalculate_ratings_summary(
            session,
            target_type=ReviewTargetType.clinic,
            target_id=clinic.id,
        )
        for extra_clinic in extra_clinics:
            await recalculate_ratings_summary(
                session,
                target_type=ReviewTargetType.clinic,
                target_id=extra_clinic.id,
            )
        for vet in vet_users:
            await recalculate_ratings_summary(
                session,
                target_type=ReviewTargetType.vet,
                target_id=vet.id,
            )
        for vet in extra_vet_users:
            await recalculate_ratings_summary(
                session,
                target_type=ReviewTargetType.vet,
                target_id=vet.id,
            )

        await _seed_vpn_mvp_demo(session, owner_user_id=owner_main.id)

        await session.commit()

        sample_full = full_record_pets[0]
        sample_basic = basic_record_pets[0]
        sample_none = no_consent_pets[0]
        barsik_qr_token = f"QR-{_seed_lapka_id(1)}"
        barsik_passport = await session.scalar(select(PetPassport).where(PetPassport.pet_id == DEMO_IDS["barsik_pet"]))
        barsik_passport_token = barsik_passport.public_token if barsik_passport else None
        summary = {
            "seed": seed_value,
            "generated_at": now.isoformat(),
            "counts": {
                "clinics": len(all_clinics),
                "clinic_admins": 1 + len(extra_clinic_admins),
                "vets": len(vet_users) + len(extra_vet_users),
                "owners": len(owner_users),
                "pets": len(pets),
                "pets_by_species": {
                    "cats": 45,
                    "dogs": 45,
                    "other": 10,
                },
                "visits": len(visits),
                "inpatient_active": len(inpatient_stays),
                "inpatient_events": inpatient_event_total,
                "appointments_future_14d": len(appointments),
                "telemedicine_appointments": 10,
                "notifications": 4,
                "reviews_total": 150 + extra_review_count,
                "reviews_published": published_reviews,
                "consents_full_record": len(full_record_pets),
                "consents_basic_medical": len(basic_record_pets),
                "consents_none": len(no_consent_pets),
                "consents_inpatient_view": len(inpatient_pets),
                "consents_camera_view": len(inpatient_pets) - len(camera_scope_blocked_pet_ids),
                "pet_qr_tokens": len(pets),
                "pet_passports": len(pets),
                "lost_pet_reports": 5,
                "lost_pet_sightings": 2,
                "referrals": 10,
                "clinic_invites": 3,
                "consent_requests_pending": len(consent_request_seed_pets),
                "clinic_services": len(clinic_services),
                "invoices": len(invoices),
                "invoice_items": invoice_items_total,
                "payments": payments_total,
                "insurance_policies": policies_total,
                "insurance_claims": claims_total,
                "lab_providers": 2,
                "lab_orders": lab_orders_total,
                "lab_results": lab_results_total,
                "templates_total": 6 + len(extra_clinics) * 5,
                "symptoms": seeded_symptoms_count,
                "diseases": seeded_diseases_count,
                "clinical_protocols": seeded_protocols_count,
                "ai_providers": ai_control_plane_counts["providers"],
                "ai_models": ai_control_plane_counts["models"],
                "ai_routes": ai_control_plane_counts["routes"],
                "ai_policies": ai_control_plane_counts["policies"],
                "ai_prompts": ai_control_plane_counts["prompts"],
                "ai_clinic_overrides": ai_control_plane_counts["clinic_overrides"],
                "ai_role_policies": ai_control_plane_counts["role_policies"],
                "ai_usage_logs": ai_control_plane_counts["usage_logs"],
                "vpn_demo_owner_subscription_active": 1,
            },
            "demo_credentials": [
                {"role": "owner", "email": "owner@lapka.local", "password": "demo12345"},
                {"role": "vet", "email": "vet@lapka.local", "password": "demo12345"},
                {"role": "clinic_admin", "email": "admin@lapka.local", "password": "demo12345"},
                {"role": "network_admin", "email": "platform@lapka.local", "password": "demo12345"},
            ],
            "sample_entities": {
                "clinic_id": str(clinic.id),
                "network_clinic_ids": [str(item.id) for item in all_clinics],
                "barsik_pet_id": str(DEMO_IDS["barsik_pet"]),
                "barsik_lapka_id": _seed_lapka_id(1),
                "barsik_qr_token": barsik_qr_token,
                "barsik_passport_token": barsik_passport_token,
                "barsik_visit_id": str(barsik_latest_visit_id),
                "barsik_stay_id": str(DEMO_IDS["barsik_stay"]),
                "lost_pet_report_id": str(lost_reports[0].id) if lost_reports else None,
                "referral_id": str(_seed_uuid("referral", 1)),
                "clinic_invite_id": str(_seed_uuid("clinic-invite", 1)),
                "invoice_id": str(invoices[0].id) if invoices else None,
                "lab_order_id": str(_seed_uuid("lab-order", 1)),
                "full_record_pet": {
                    "pet_id": str(sample_full.id),
                    "owner_email": pet_owner_map[sample_full.id].email,
                },
                "basic_medical_pet": {
                    "pet_id": str(sample_basic.id),
                    "owner_email": pet_owner_map[sample_basic.id].email,
                },
                "no_consent_pet": {
                    "pet_id": str(sample_none.id),
                    "owner_email": pet_owner_map[sample_none.id].email,
                },
                "camera_scope_blocked_pets": [str(pet_id) for pet_id in camera_scope_blocked_pet_ids],
            },
        }
        (storage_dir / "seed_summary.json").write_text(
            json.dumps(summary, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(json.dumps(summary["counts"], ensure_ascii=False))
        print("Seed completed")


if __name__ == "__main__":
    asyncio.run(seed())
