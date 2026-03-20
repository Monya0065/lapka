import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.auth import register_owner, login
from src.models import User, RoleEnum
from src.security.passwords import hash_password


@pytest.mark.asyncio
async def test_register_owner_success():
    """Test successful owner registration"""
    # Mock dependencies
    mock_db = AsyncMock(spec=AsyncSession)
    mock_get_user_by_email = AsyncMock(return_value=None)
    mock_create_user = AsyncMock()
    mock_log_audit = AsyncMock()
    mock_hash_password = MagicMock(return_value="hashed_password")

    # Mock user object
    mock_user = MagicMock(spec=User)
    mock_user.id = "test-user-id"
    mock_create_user.return_value = mock_user

    # Patch the functions
    import src.services.auth as auth_module
    auth_module.get_user_by_email = mock_get_user_by_email
    auth_module.create_user = mock_create_user
    auth_module.log_audit = mock_log_audit
    auth_module.hash_password = mock_hash_password

    # Test data
    email = "test@example.com"
    full_name = "Test User"
    phone = "+1234567890"
    password = "testpass123"

    # Call the function
    result = await register_owner(
        mock_db,
        email=email,
        full_name=full_name,
        phone=phone,
        password=password
    )

    # Assertions
    assert result == mock_user
    mock_get_user_by_email.assert_called_once_with(mock_db, email)
    mock_create_user.assert_called_once_with(
        mock_db,
        email=email,
        full_name=full_name,
        phone=phone,
        password_hash="hashed_password",
        role=RoleEnum.owner,
    )
    mock_log_audit.assert_called_once()


@pytest.mark.asyncio
async def test_register_owner_email_exists():
    """Test registration fails when email already exists"""
    mock_db = AsyncMock(spec=AsyncSession)
    mock_get_user_by_email = AsyncMock(return_value=MagicMock(spec=User))

    import src.services.auth as auth_module
    auth_module.get_user_by_email = mock_get_user_by_email

    with pytest.raises(Exception) as exc_info:
        await register_owner(
            mock_db,
            email="existing@example.com",
            full_name="Test User",
            phone="+1234567890",
            password="testpass123"
        )

    assert exc_info.value.status_code == 409
    assert "EMAIL_EXISTS" in str(exc_info.value.detail)


@pytest.mark.asyncio
@pytest.mark.skip(reason="Requires complex mocking of imported functions - tested via integration tests")
async def test_login_user_success():
    """Test successful user login"""
    pass


@pytest.mark.asyncio
async def test_login_user_invalid_credentials():
    """Test login fails with invalid credentials"""
    mock_db = AsyncMock(spec=AsyncSession)
    mock_get_user_by_email = AsyncMock(return_value=None)

    import src.services.auth as auth_module
    auth_module.get_user_by_email = mock_get_user_by_email

    with pytest.raises(Exception) as exc_info:
        await login(mock_db, email="nonexistent@example.com", password="wrongpass")

    assert exc_info.value.status_code == 401
    assert "INVALID_CREDENTIALS" in str(exc_info.value.detail)