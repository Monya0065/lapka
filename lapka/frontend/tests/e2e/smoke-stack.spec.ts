import { expect, test } from '@playwright/test';

const API = process.env.E2E_API_URL || 'http://localhost:8000';

test.describe('stack smoke', () => {
  test('backend health and public capabilities', async ({ request }) => {
    const health = await request.get(`${API}/health`);
    expect(health.ok(), `health status ${health.status()}`).toBeTruthy();
    const body = await health.json();
    expect(body).toHaveProperty('status', 'ok');

    const cap = await request.get(`${API}/api/v1/system/capabilities`);
    expect(cap.ok(), `capabilities status ${cap.status()}`).toBeTruthy();
    const capJson = await cap.json();
    expect(capJson).toHaveProperty('integrations');
    expect(capJson).toHaveProperty('integrations_ready');
    expect(capJson).toHaveProperty('storage');
  });

  test('marketing home responds', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    const hero = page.getByTestId('marketing-hero-title').or(page.getByRole('heading', { level: 1 }));
    await expect(hero).toContainText(/медицинская|медкарта|питомц|Lapka|карта/i);
  });

  test('public places list without auth', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/places?type=pharmacy&limit=5`);
    expect(res.ok(), `places ${res.status()}`).toBeTruthy();
    const json = await res.json();
    expect(Array.isArray(json)).toBeTruthy();
  });
});
