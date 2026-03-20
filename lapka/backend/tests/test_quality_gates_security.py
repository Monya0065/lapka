import os

import pytest
import requests


API = os.getenv('LAPKA_API_BASE', 'http://localhost:8000')
CLINIC_ID = '11111111-1111-1111-1111-111111111111'
FULL_RECORD_PET_ID = '55555555-5555-5555-5555-555555555555'
NO_CONSENT_PET_ID = '60136ddf-8327-5875-8e39-2f336b1d9708'
VISIT_ID = '66666666-6666-6666-6666-666666666666'


def _login(email: str, password: str = 'demo12345') -> str:
    response = requests.post(
        f'{API}/api/v1/auth/login',
        json={'email': email, 'password': password},
        timeout=20,
    )
    response.raise_for_status()
    return response.json()['access_token']


@pytest.fixture(scope='session')
def tokens():
    return {
        'owner': _login('owner@lapka.local'),
        'vet': _login('vet@lapka.local'),
        'admin': _login('admin@lapka.local'),
    }


@pytest.mark.integration
def test_rbac_owner_cannot_open_clinic_members(tokens):
    response = requests.get(
        f'{API}/api/v1/clinics/me/members',
        headers={'Authorization': f"Bearer {tokens['owner']}"},
        timeout=20,
    )
    assert response.status_code == 403


@pytest.mark.integration
def test_consent_scope_blocks_vet_without_grant(tokens):
    allowed = requests.get(
        f'{API}/api/v1/pets/{FULL_RECORD_PET_ID}?clinic_id={CLINIC_ID}',
        headers={'Authorization': f"Bearer {tokens['vet']}"},
        timeout=20,
    )
    denied = requests.get(
        f'{API}/api/v1/pets/{NO_CONSENT_PET_ID}?clinic_id={CLINIC_ID}',
        headers={'Authorization': f"Bearer {tokens['vet']}"},
        timeout=20,
    )

    assert allowed.status_code == 200
    assert denied.status_code == 403


@pytest.mark.integration
def test_public_token_restriction_payload(tokens):
    create_response = requests.post(
        f'{API}/api/v1/public-links/prescription',
        headers={
            'Authorization': f"Bearer {tokens['vet']}",
            'Content-Type': 'application/json',
        },
        json={
            'visit_id': VISIT_ID,
            'pet_id': FULL_RECORD_PET_ID,
            'expires_in_hours': 6,
        },
        timeout=20,
    )
    create_response.raise_for_status()
    token = create_response.json()['token']

    public_response = requests.get(
        f'{API}/api/v1/public/prescriptions/{token}',
        timeout=20,
    )
    assert public_response.status_code == 200

    payload = public_response.json()
    assert 'medications' in payload
    assert 'pet_name' in payload

    forbidden_keys = {
        'owner_email',
        'owner_phone',
        'assessment_note',
        'plan_note',
        'dosage',
    }
    assert all(key not in payload for key in forbidden_keys)

    for med in payload.get('medications', []):
        assert 'prescription_required' in med
        assert 'dosage' not in med
        assert 'instruction_note' not in med
