from fastapi import APIRouter, Depends, Query

from src.models import RoleEnum
from src.security.deps import require_roles
from src.services.catalog import catalog_counts, search_diseases, search_drugs, search_symptoms

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/meta")
async def get_catalog_meta() -> dict:
    return catalog_counts()


@router.get("/symptoms")
async def get_symptoms(
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    red_flag: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict]:
    return search_symptoms(q=q, category=category, red_flag=red_flag, limit=limit)


@router.get("/diseases")
async def get_diseases(
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    species: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict]:
    return search_diseases(q=q, category=category, species=species, limit=limit)


@router.get("/drugs")
async def get_drugs(
    q: str | None = Query(default=None),
    species: str | None = Query(default=None),
    prescription_required: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
) -> list[dict]:
    return search_drugs(q=q, species=species, prescription_required=prescription_required, limit=limit)
