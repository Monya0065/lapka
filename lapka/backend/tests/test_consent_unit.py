import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from src.services.consent import grant_consent, list_owner_consents
from src.models import ConsentGrant, ConsentScope, PetOwnerLink
from src.repositories.consents import create_consent, get_consent, list_consents_for_owner
from src.repositories.pets import get_pet


@pytest.mark.asyncio
async def test_list_owner_consents():
    """Test listing owner consents"""
    mock_db = AsyncMock(spec=AsyncSession)
    mock_list_consents = AsyncMock(return_value=[MagicMock(spec=ConsentGrant)])

    import src.services.consent as consent_module
    consent_module.list_consents_for_owner = mock_list_consents

    owner_user_id = "test-owner-id"

    result = await list_owner_consents(mock_db, owner_user_id=owner_user_id)

    assert len(result) == 1
    mock_list_consents.assert_called_once_with(mock_db, owner_user_id)


@pytest.mark.asyncio
async def test_grant_consent_success():
    """Test successful consent granting"""
    # Mocks
    mock_db = AsyncMock(spec=AsyncSession)
    mock_get_pet = AsyncMock()
    mock_create_consent = AsyncMock()
    mock_log_audit = AsyncMock()

    # Mock pet
    mock_pet = MagicMock()
    mock_pet.id = "test-pet-id"
    mock_get_pet.return_value = mock_pet

    # Mock owner link
    mock_owner_link = MagicMock(spec=PetOwnerLink)
    mock_db.scalar.return_value = mock_owner_link

    # Mock consent
    mock_consent = MagicMock(spec=ConsentGrant)
    mock_create_consent.return_value = mock_consent

    # Patch functions
    import src.services.consent as consent_module
    consent_module.get_pet = mock_get_pet
    consent_module.create_consent = mock_create_consent
    consent_module.log_audit = mock_log_audit

    # Test data
    owner_user_id = "test-owner-id"
    pet_id = "test-pet-id"
    clinic_id = "test-clinic-id"
    scope_level = ConsentScope.full_record
    expires_at = None

    # Call function
    result = await grant_consent(
        mock_db,
        owner_user_id=owner_user_id,
        pet_id=pet_id,
        clinic_id=clinic_id,
        scope_level=scope_level,
        expires_at=expires_at
    )

    # Assertions
    assert result == mock_consent
    mock_get_pet.assert_called_once_with(mock_db, pet_id)
    mock_create_consent.assert_called_once_with(
        mock_db,
        pet_id=pet_id,
        owner_user_id=owner_user_id,
        clinic_id=clinic_id,
        scope_level=scope_level,
        expires_at=expires_at,
    )
    mock_log_audit.assert_called_once()


@pytest.mark.asyncio
async def test_grant_consent_pet_not_found():
    """Test consent granting fails when pet not found"""
    mock_db = AsyncMock(spec=AsyncSession)
    mock_get_pet = AsyncMock(return_value=None)

    import src.services.consent as consent_module
    consent_module.get_pet = mock_get_pet

    with pytest.raises(HTTPException) as exc_info:
        await grant_consent(
            mock_db,
            owner_user_id="test-owner-id",
            pet_id="nonexistent-pet-id",
            clinic_id="test-clinic-id",
                scope_level=ConsentScope.basic_medical,
            expires_at=None
        )

    assert exc_info.value.status_code == 404
    assert "PET_NOT_FOUND" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_grant_consent_forbidden():
    """Test consent granting fails when owner doesn't own the pet"""
    mock_db = AsyncMock(spec=AsyncSession)
    mock_get_pet = AsyncMock(return_value=MagicMock())
    mock_db.scalar.return_value = None  # No owner link

    import src.services.consent as consent_module
    consent_module.get_pet = mock_get_pet

    with pytest.raises(HTTPException) as exc_info:
        await grant_consent(
            mock_db,
            owner_user_id="test-owner-id",
            pet_id="test-pet-id",
            clinic_id="test-clinic-id",
                scope_level=ConsentScope.basic_medical,
            expires_at=None
        )

    assert exc_info.value.status_code == 403
    assert "FORBIDDEN" in str(exc_info.value.detail)