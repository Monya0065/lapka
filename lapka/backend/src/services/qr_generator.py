import uuid
from typing import Optional

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
from qrcode.image.styles.colormasks import SolidFill


def generate_qr_code(
    data: str,
    *,
    size: int = 300,
    color: str = "#164560",
    background: str = "#ffffff",
) -> bytes:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(),
        color_mask=SolidFill(color_str=color, back_color_str=background),
    )
    
    import io
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def generate_pet_qr_code(
    pet_id: uuid.UUID,
    *,
    base_url: str = "http://localhost:3000",
    size: int = 300,
) -> bytes:
    url = f"{base_url}/pet-passport/{pet_id}"
    return generate_qr_code(url, size=size)


def generate_visit_qr_code(
    visit_id: uuid.UUID,
    *,
    base_url: str = "http://localhost:3000",
    size: int = 300,
) -> bytes:
    url = f"{base_url}/owner/visit/{visit_id}"
    return generate_qr_code(url, size=size)


def generate_clinic_qr_code(
    clinic_id: uuid.UUID,
    *,
    base_url: str = "http://localhost:3000",
    size: int = 300,
) -> bytes:
    url = f"{base_url}/clinic/{clinic_id}"
    return generate_qr_code(url, size=size)


def generate_appointment_qr_code(
    appointment_id: uuid.UUID,
    *,
    base_url: str = "http://localhost:3000",
    size: int = 300,
) -> bytes:
    url = f"{base_url}/public-booking/{appointment_id}"
    return generate_qr_code(url, size=size)


def generate_vaccine_qr_code(
    pet_id: uuid.UUID,
    vaccine_name: str,
    *,
    base_url: str = "http://localhost:3000",
    size: int = 200,
) -> bytes:
    url = f"{base_url}/owner/pet/{pet_id}/vaccines?q={vaccine_name}"
    return generate_qr_code(url, size=size)


def generate_lost_pet_qr_code(
    report_id: uuid.UUID,
    *,
    base_url: str = "http://localhost:3000",
    size: int = 300,
) -> bytes:
    url = f"{base_url}/lost-pets/{report_id}"
    return generate_qr_code(url, size=size)


def generate_prescription_qr_code(
    token: str,
    *,
    base_url: str = "http://localhost:3000",
    size: int = 300,
) -> bytes:
    url = f"{base_url}/public-rx/{token}"
    return generate_qr_code(url, size=size)