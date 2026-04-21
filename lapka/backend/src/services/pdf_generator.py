import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Visit, PetOwnerLink


async def generate_visit_protocol_pdf(
    db: AsyncSession,
    *,
    visit_id: uuid.UUID,
) -> bytes:
    from sqlalchemy import select
    from src.models import Visit, MasterPet, User
    from src.repositories import get_visit
    
    visit = await get_visit(db, visit_id)
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "VISIT_NOT_FOUND", "message": "Visit not found"},
        )
    
    pet = await db.scalar(select(MasterPet).where(MasterPet.id == visit.pet_id))
    vet = await db.scalar(select(User).where(User.id == visit.vet_id))
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Протокол визита - {pet.name if pet else 'Unknown'}</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; }}
            .header {{ border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }}
            .title {{ font-size: 24px; font-weight: bold; }}
            .subtitle {{ color: #666; margin-top: 5px; }}
            .section {{ margin: 20px 0; }}
            .section-title {{ font-weight: bold; font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }}
            .label {{ font-weight: bold; color: #666; width: 150px; display: inline-block; }}
            .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999; }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">Протокол ветеринарного осмотра</div>
            <div class="subtitle">Lapka Veterinary System</div>
        </div>
        
        <div class="section">
            <div class="section-title">Информация о питомце</div>
            <p><span class="label">Имя:</span> {pet.name if pet else '-'}</p>
            <p><span class="label">Вид:</span> {pet.species if pet else '-'}</p>
            <p><span class="label">Порода:</span> {pet.breed if pet else '-'}</p>
            <p><span class="label">Возраст:</span> {pet.birth_date if pet else '-'}</p>
        </div>
        
        <div class="section">
            <div class="section-title">Жалоба</div>
            <p>{visit.chief_complaint or '-'}</p>
        </div>
        
        <div class="section">
            <div class="section-title">Осмотр</div>
            <p>{visit.exam_findings or '-'}</p>
        </div>
        
        <div class="section">
            <div class="section-title">Оценка</div>
            <p>{visit.assessment_note or '-'}</p>
        </div>
        
        <div class="section">
            <div class="section-title">План</div>
            <p>{visit.plan_note or '-'}</p>
        </div>
        
        <div class="section">
            <div class="section-title">Врач</div>
            <p>{vet.full_name if vet else '-'}</p>
        </div>
        
        <div class="footer">
            <p>Дата создания: {datetime.utcnow().strftime('%d.%m.%Y %H:%M')}</p>
            <p>Документ сгенерирован системой Lapka</p>
        </div>
    </body>
    </html>
    """
    
    try:
        import weasyprint
        pdf_bytes = weasyprint.HTML(string=html_content).write_pdf()
        return pdf_bytes
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
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Паспорт - {pet.name}</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; }}
            .header {{ text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }}
            .title {{ font-size: 28px; font-weight: bold; }}
            .photo {{ width: 200px; height: 200px; background: #f0f0f0; margin: 20px auto; border-radius: 10px; }}
            .info {{ margin: 15px 0; }}
            .label {{ font-weight: bold; color: #666; }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">Ветеринарный паспорт</div>
        </div>
        
        <div class="photo"></div>
        
        <div class="info"><span class="label">Имя:</span> {pet.name}</div>
        <div class="info"><span class="label">Вид:</span> {pet.species}</div>
        <div class="info"><span class="label">Порода:</span> {pet.breed or '-'}</div>
        <div class="info"><span class="label">Пол:</span> {pet.sex or '-'}</div>
        <div class="info"><span class="label">Дата рождения:</span> {pet.birth_date or '-'}</div>
        <div class="info"><span class="label">Идентификатор:</span> {pet.lapka_id}</div>
        <div class="info"><span class="label">Чип:</span> {pet.chip_id or '-'}</div>
        
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #999;">
            Создано: {datetime.utcnow().strftime('%d.%m.%Y')} | Lapka Veterinary System
        </div>
    </body>
    </html>
    """
    
    try:
        import weasyprint
        pdf_bytes = weasyprint.HTML(string=html_content).write_pdf()
        return pdf_bytes
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
    
    vaccines_html = ""
    for v in vaccine_list:
        vaccines_html += f"<tr><td>{v.vaccine_name}</td><td>{v.administered_at.strftime('%d.%m.%Y')}</td><td>{v.next_due_date.strftime('%d.%m.%Y') if v.next_due_date else '-'}</td></tr>"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Сертификат вакцинации - {pet.name}</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; }}
            .header {{ border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th, td {{ border: 1px solid #ddd; padding: 10px; text-align: left; }}
            th {{ background: #f5f5f5; }}
        </style>
    </head>
    <body>
        <div class="header">
            <div style="font-size: 24px; font-weight: bold;">Сертификат вакцинации</div>
            <div>Питомец: {pet.name}</div>
        </div>
        
        <table>
            <tr><th>Вакцина</th><th>Дата</th><th>Следующая</th></tr>
            {vaccines_html}
        </table>
    </body>
    </html>
    """
    
    try:
        import weasyprint
        pdf_bytes = weasyprint.HTML(string=html_content).write_pdf()
        return pdf_bytes
    except ImportError:
        return html_content.encode('utf-8')