import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Visit, PetOwnerLink


_LAPKA_CSS = """
:root {
    --lapka-blue: #2563eb;
    --lapka-gray: #374151;
    --lapka-light: #f3f4f6;
    --lapka-border: #e5e7eb;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: var(--lapka-gray);
    margin: 0;
    padding: 0;
}

@page {
    size: A4;
    margin: 15mm 18mm;
}

.header {
    border-bottom: 2px solid var(--lapka-blue);
    padding-bottom: 14px;
    margin-bottom: 24px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
}

.doc-title { font-size: 18pt; font-weight: 700; color: var(--lapka-blue); }
.doc-subtitle { font-size: 9pt; color: #6b7280; margin-top: 4px; }
.doc-date { font-size: 9pt; color: #9ca3af; text-align: right; }

.section { margin: 18px 0; }
.section-title {
    font-size: 11pt;
    font-weight: 600;
    color: var(--lapka-blue);
    border-bottom: 1px solid var(--lapka-border);
    padding-bottom: 5px;
    margin-bottom: 10px;
}

.field-row { display: flex; margin: 5px 0; }
.field-label { font-weight: 600; color: #6b7280; min-width: 120px; }
.field-value { flex: 1; color: var(--lapka-gray); }

.grid-2col { display: flex; gap: 24px; }
.grid-2col > div { flex: 1; }

.footer {
    margin-top: 36px;
    padding-top: 14px;
    border-top: 1px solid var(--lapka-border);
    font-size: 8pt;
    color: #9ca3af;
    display: flex;
    justify-content: space-between;
}

table { width: 100%; border-collapse: collapse; margin: 8px 0; }
th, td { border: 1px solid var(--lapka-border); padding: 7px 10px; text-align: left; font-size: 10pt; }
th { background: var(--lapka-light); font-weight: 600; color: var(--lapka-blue); }
tr:nth-child(even) td { background: #fafafa; }
"""


def _build_visit_html(visit, pet, vet) -> str:
    birth = pet.birth_date.strftime('%d.%m.%Y') if pet and pet.birth_date else '—'
    exam_date = visit.exam_date.strftime('%d.%m.%Y %H:%M') if visit.exam_date else datetime.utcnow().strftime('%d.%m.%Y %H:%M')
    created = visit.created_at.strftime('%d.%m.%Y %H:%M') if visit.created_at else datetime.utcnow().strftime('%d.%m.%Y %H:%M')

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Протокол визита</title>
<style>{_LAPKA_CSS}</style>
</head>
<body>
<div class="header">
  <div>
    <div class="doc-title">Протокол ветеринарного осмотра</div>
    <div class="doc-subtitle">Lapka Veterinary System</div>
  </div>
  <div class="doc-date">от {exam_date}</div>
</div>

<div class="grid-2col">
  <div class="section">
    <div class="section-title">Питомец</div>
    <div class="field-row"><span class="field-label">Имя:</span><span class="field-value">{pet.name if pet else '—'}</span></div>
    <div class="field-row"><span class="field-label">Вид:</span><span class="field-value">{pet.species if pet else '—'}</span></div>
    <div class="field-row"><span class="field-label">Порода:</span><span class="field-value">{pet.breed or '—'}</span></div>
    <div class="field-row"><span class="field-label">Пол:</span><span class="field-value">{pet.sex or '—'}</span></div>
    <div class="field-row"><span class="field-label">Возраст:</span><span class="field-value">{birth}</span></div>
    {f'<div class="field-row"><span class="field-label">Чип:</span><span class="field-value">{pet.chip_id}</span></div>' if pet and pet.chip_id else ''}
  </div>
  <div>
    <div class="section-title">Врач</div>
    <div class="field-row"><span class="field-label">ФИО:</span><span class="field-value">{vet.full_name if vet else '—'}</span></div>
    <div class="field-row"><span class="field-label">ID:</span><span class="field-value">{str(vet.id)[:8]}...</span></div>
  </div>
</div>

<div class="section"><div class="section-title">Жалоба</div><p>{visit.chief_complaint or '—'}</p></div>
<div class="section"><div class="section-title">Осмотр</div><p>{visit.exam_findings or '—'}</p></div>
<div class="section"><div class="section-title">Оценка</div><p>{visit.assessment_note or '—'}</p></div>
<div class="section"><div class="section-title">План</div><p>{visit.plan_note or '—'}</p></div>

<div class="footer">
  <span>Создано: {created} · Lapka Veterinary System</span>
  <span>Документ сгенерирован автоматически</span>
</div>
</body>
</html>"""


def _build_passport_html(pet) -> str:
    birth = pet.birth_date.strftime('%d.%m.%Y') if pet.birth_date else '—'
    created = datetime.utcnow().strftime('%d.%m.%Y')
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Паспорт — {pet.name}</title>
<style>{_LAPKA_CSS}</style>
</head>
<body>
<div class="header">
  <div><div class="doc-title">Ветеринарный паспорт</div><div class="doc-subtitle">Lapka Veterinary System</div></div>
  <div class="doc-date">{created}</div>
</div>
<div class="section">
  <div class="section-title">Данные питомца</div>
  <div class="field-row"><span class="field-label">Имя:</span><span class="field-value">{pet.name}</span></div>
  <div class="field-row"><span class="field-label">Вид:</span><span class="field-value">{pet.species}</span></div>
  <div class="field-row"><span class="field-label">Порода:</span><span class="field-value">{pet.breed or '—'}</span></div>
  <div class="field-row"><span class="field-label">Пол:</span><span class="field-value">{pet.sex or '—'}</span></div>
  <div class="field-row"><span class="field-label">Дата рождения:</span><span class="field-value">{birth}</span></div>
  <div class="field-row"><span class="field-label">ID (Lapka):</span><span class="field-value">{pet.lapka_id}</span></div>
  <div class="field-row"><span class="field-label">Чип:</span><span class="field-value">{pet.chip_id or '—'}</span></div>
</div>
<div class="footer">
  <span>Создано: {created} · Lapka Veterinary System</span>
  <span>Документ сгенерирован автоматически</span>
</div>
</body>
</html>"""


def _build_vaccine_html(pet, vaccine_list) -> str:
    created = datetime.utcnow().strftime('%d.%m.%Y')
    rows_html = ""
    for v in vaccine_list:
        next_due = v.next_due_date.strftime('%d.%m.%Y') if v.next_due_date else '—'
        rows_html += f"<tr><td>{v.vaccine_name}</td><td>{v.administered_at.strftime('%d.%m.%Y')}</td><td>{next_due}</td></tr>"
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Сертификат вакцинации — {pet.name}</title>
<style>{_LAPKA_CSS}</style>
</head>
<body>
<div class="header">
  <div><div class="doc-title">Сертификат вакцинации</div><div class="doc-subtitle">Питомец: {pet.name}</div></div>
  <div class="doc-date">{created}</div>
</div>
<div class="section">
  <div class="section-title">Записи о вакцинации</div>
  <table>
    <tr><th>Вакцина</th><th>Дата</th><th>Следующая</th></tr>
    {rows_html or '<tr><td colspan="3">Нет записей</td></tr>'}
  </table>
</div>
<div class="footer">
  <span>Создано: {created} · Lapka Veterinary System</span>
  <span>Документ сгенерирован автоматически</span>
</div>
</body>
</html>"""


async def generate_visit_protocol_pdf(
    db: AsyncSession,
    *,
    visit_id: uuid.UUID,
) -> bytes:
    from sqlalchemy import select
    from src.models import MasterPet, User
    from src.repositories import get_visit

    visit = await get_visit(db, visit_id)
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "VISIT_NOT_FOUND", "message": "Visit not found"},
        )

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == visit.pet_id))
    vet = await db.scalar(select(User).where(User.id == visit.vet_id))

    html_content = _build_visit_html(visit, pet, vet)
    try:
        import weasyprint
        return weasyprint.HTML(string=html_content).write_pdf()
    except ImportError:
        return html_content.encode('utf-8')


async def generate_pet_passport_pdf(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID,
) -> bytes:
    from sqlalchemy import select
    from src.models import MasterPet

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == pet_id))
    if not pet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PET_NOT_FOUND", "message": "Pet not found"},
        )

    html_content = _build_passport_html(pet)
    try:
        import weasyprint
        return weasyprint.HTML(string=html_content).write_pdf()
    except ImportError:
        return html_content.encode('utf-8')


async def generate_vaccine_certificate_pdf(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID,
) -> bytes:
    from sqlalchemy import select
    from src.models import MasterPet, VaccineEntry

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == pet_id))
    vaccines = await db.scalars(
        select(VaccineEntry)
        .where(VaccineEntry.pet_id == pet_id)
        .order_by(VaccineEntry.administered_at.desc())
        .limit(20)
    )
    vaccine_list = list(vaccines)

    html_content = _build_vaccine_html(pet, vaccine_list)
    try:
        import weasyprint
        return weasyprint.HTML(string=html_content).write_pdf()
    except ImportError:
        return html_content.encode('utf-8')