"""Owner-facing educational snippets (no treatment steps or drug doses — AGENTS.md)."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/public/care-guides", tags=["public-care"])


class CareGuideTopic(BaseModel):
    id: str
    title_ru: str = Field(..., description="Заголовок для владельца")
    title_en: str = Field(..., description="English title")
    summary_ru: str
    summary_en: str
    bullets_ru: list[str]
    bullets_en: list[str]


_TOPICS: list[dict] = [
    {
        "id": "before_visit",
        "title_ru": "Перед визитом к ветеринару",
        "title_en": "Before a veterinary visit",
        "summary_ru": "Как подготовиться, чтобы врач быстрее понял ситуацию.",
        "summary_en": "How to prepare so your vet can assess the situation efficiently.",
        "bullets_ru": [
            "Запишите, когда начались симптомы и как они менялись.",
            "Сфотографируйте или принесите этикетки корма и лекарств, если питомец что-то получает.",
            "Подготовьте вопросы заранее — на приёме легко что-то забыть.",
            "Для кошек: по возможности используйте переноску; не кормите перед визитом, если врач просил голодную диету для анализов.",
        ],
        "bullets_en": [
            "Note when signs started and how they changed.",
            "Bring photos or labels of food and any medications.",
            "Write questions ahead — it is easy to forget during the visit.",
            "For cats: use a carrier when possible; follow fasting instructions if tests are planned.",
        ],
    },
    {
        "id": "after_vaccination",
        "title_ru": "После вакцинации",
        "title_en": "After vaccination",
        "summary_ru": "Обычные наблюдения; когда срочно звонить клинике.",
        "summary_en": "What is common; when to call the clinic urgently.",
        "bullets_ru": [
            "Лёгкая вялость или припухлость в месте укола в первые сутки встречаются — наблюдайте за питомцем.",
            "Обильная рвота, отёк морды, затруднённое дыхание, коллапс — немедленно обратитесь к ветеринару.",
            "Не давайте самостоятельно обезболивающие или антигистаминные без назначения врача.",
        ],
        "bullets_en": [
            "Mild tiredness or a small lump at the injection site can occur in the first day — monitor your pet.",
            "Severe vomiting, facial swelling, trouble breathing, or collapse need urgent veterinary care.",
            "Do not give pain or allergy medications unless your vet prescribed them.",
        ],
    },
    {
        "id": "travel_stress",
        "title_ru": "Перевозка и стресс",
        "title_en": "Travel and stress",
        "summary_ru": "Снижение стресса при поездках — без медикаментозных дозировок.",
        "summary_en": "Reducing travel stress — without medication dosing.",
        "bullets_ru": [
            "Приучайте к переноске дома: короткие сессии с лакомствами и привычным одеялом.",
            "В машине закрепите переноску; избегайте долгого простоя на солнце в салоне.",
            "Седативные препараты подбирает только ветеринар с учётом здоровья питомца.",
        ],
        "bullets_en": [
            "Carrier-train at home with short sessions, treats, and a familiar blanket.",
            "Secure the carrier in the car; avoid long sun exposure in a parked vehicle.",
            "Sedatives must be chosen by a vet for your pet’s health status.",
        ],
    },
    {
        "id": "parasites_prevention",
        "title_ru": "Паразиты и профилактика",
        "title_en": "Parasites and prevention",
        "summary_ru": "Почему важен план профилактики и как его согласовать с клиникой.",
        "summary_en": "Why a prevention plan matters and how to align it with your clinic.",
        "bullets_ru": [
            "Схемы обработки от блох, клещей и гельминтов зависят от региона, образа жизни и возраста — их задаёт ветеринар.",
            "Не смешивайте препараты «как у соседа» — риск передозировки или неэффективности.",
            "Регулярно обновляйте напоминания в приложении после каждого визита.",
        ],
        "bullets_en": [
            "Flea, tick, and deworming plans depend on region, lifestyle, and age — your vet should define them.",
            "Avoid copying a friend’s protocol — risk of ineffectiveness or overdose.",
            "Refresh reminders in the app after each visit.",
        ],
    },
    {
        "id": "nutrition_hydration",
        "title_ru": "Питание и вода",
        "title_en": "Nutrition and water",
        "summary_ru": "Базовые принципы без расчёта рационов и дозировок.",
        "summary_en": "Basics without ration calculations or dosing.",
        "bullets_ru": [
            "Резко не меняйте корм без консультации — перевод делают постепенно по рекомендации врача.",
            "Свежая вода всегда в доступе; при рвоте или отказе от воды уточните срок обращения с клиникой.",
            "Лакомства не должны превышать разумную долю рациона — лишний вес ухудшает здоровье.",
        ],
        "bullets_en": [
            "Avoid abrupt diet changes — transitions should be gradual per veterinary advice.",
            "Fresh water should always be available; vomiting or refusal to drink warrants timely clinic contact.",
            "Treats should stay a small part of the diet — excess weight harms health.",
        ],
    },
]


@router.get("", response_model=list[CareGuideTopic])
async def list_care_guides() -> list[CareGuideTopic]:
    return [CareGuideTopic.model_validate(item) for item in _TOPICS]
