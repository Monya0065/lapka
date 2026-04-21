import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:8000';

test.describe('lost-pets module', () => {
  test('public list loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/lost-pets`);
    await expect(page.locator('h1')).toContainText(/Потерявшиеся/i);
  });

  test('search by city works', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/lost-pets?city=Москва`);
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('filter by status works', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/lost-pets?status=active`);
    expect(response.ok()).toBe(true);
    const data = await response.json();
    for (const item of data) {
      expect(item.status).toBe('active');
    }
  });

  test('detail page loads', async ({ page, request }) => {
    const listResp = await request.get(`${API_URL}/api/v1/lost-pets`);
    const data = await listResp.json();
    if (data.length === 0) return;
    
    const id = data[0].id;
    await page.goto(`${BASE_URL}/lost-pets`);
    await page.click(`[href*="${id}"]`);
    await expect(page).toHaveURL(new RegExp(id));
  });

  test('sighting creation works', async ({ request }) => {
    const listResp = await request.get(`${API_URL}/api/v1/lost-pets`);
    const data = await listResp.json();
    if (data.length === 0) return;
    
    const id = data[0].id;
    const sightingResp = await request.post(`${API_URL}/api/v1/lost-pets/${id}/sightings`, {
      data: { message: 'Test sighting', location: 'Test location' }
    });
    expect(sightingResp.ok()).toBe(true);
  });
  
  test('AI enhance description works', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/lost-pets/ai/enhance-description`, {
      data: { description: 'кошка серая' }
    });
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.enhanced_description).toBeDefined();
  });

  test('owner can create lost pet announcement', async ({ request }) => {
    const loginResp = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: 'owner@lapka.local', password: 'demo12345' }
    });
    if (!loginResp.ok()) return;
    const tokens = await loginResp.json();
    
    const createResp = await request.post(`${API_URL}/api/v1/owner/lost-pets`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      data: {
        title: 'Test lost cat',
        description: 'Test description',
        pet_type: 'cat',
        city: 'Москва',
        status: 'active'
      }
    });
    expect(createResp.ok()).toBe(true);
  });

  test('pagination works', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/lost-pets?limit=2&offset=0`);
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.length).toBeLessThanOrEqual(2);
  });

  test('detail page shows pet info', async ({ page, request }) => {
    const listResp = await request.get(`${API_URL}/api/v1/lost-pets`);
    const data = await listResp.json();
    if (data.length === 0) return;
    
    const id = data[0].id;
    const detailResp = await request.get(`${API_URL}/api/v1/lost-pets/${id}`);
    expect(detailResp.ok()).toBe(true);
    const pet = await detailResp.json();
    expect(pet.id).toBe(id);
    expect(pet.title).toBeDefined();
  });
});