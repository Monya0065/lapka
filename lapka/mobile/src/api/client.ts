const API_BASE = process.env.API_URL || 'http://localhost:8000';

interface LoginPayload {
  email: string;
  password: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  role: string;
  email: string;
}

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Login failed');
  return response.json();
}

export async function getLostPets(params?: { city?: string; status?: string; limit?: number; offset?: number }): Promise<unknown[]> {
  const query = new URLSearchParams();
  if (params?.city) query.set('city', params.city);
  if (params?.status) query.set('status', params.status);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const response = await fetch(`${API_BASE}/api/v1/lost-pets?${query}`);
  if (!response.ok) throw new Error('Failed to fetch lost pets');
  return response.json();
}

export async function getLostPetDetail(id: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}/api/v1/lost-pets/${id}`);
  if (!response.ok) throw new Error('Failed to fetch pet detail');
  return response.json();
}

export async function createLostPet(token: string, payload: {
  title: string;
  description: string;
  pet_type: string;
  city: string;
  status: string;
}): Promise<unknown> {
  const response = await fetch(`${API_BASE}/api/v1/owner/lost-pets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to create lost pet');
  return response.json();
}

export async function createSighting(token: string, petId: string, payload: {
  message: string;
  location: string;
}): Promise<unknown> {
  const response = await fetch(`${API_BASE}/api/v1/lost-pets/${petId}/sightings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to create sighting');
  return response.json();
}

export async function enhanceDescription(token: string, description: string): Promise<{ enhanced_description: string }> {
  const response = await fetch(`${API_BASE}/api/v1/lost-pets/ai/enhance-description`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ description }),
  });
  if (!response.ok) throw new Error('Failed to enhance description');
  return response.json();
}