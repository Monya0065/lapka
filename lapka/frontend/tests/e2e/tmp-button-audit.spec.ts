import { test } from '@playwright/test';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';

async function login(page, role: string, email: string, password: string) {
  await page.goto(`${base}/login?role=${role}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.waitForTimeout(500);
}

async function clickAudit(page, route: string) {
  await page.goto(`${base}${route}`);
  await page.waitForTimeout(300);
  const buttons = await page.locator('button:visible').elementHandles();
  let clicked = 0;
  let failed = 0;

  for (const handle of buttons.slice(0, 16)) {
    try {
      const txt = ((await handle.textContent()) || '').trim();
      if (/выйти/i.test(txt)) continue;
      const disabled = await handle.isDisabled();
      if (disabled) continue;
      await handle.click({ timeout: 1200 });
      await page.waitForTimeout(90);
      clicked += 1;
    } catch {
      failed += 1;
    }
  }

  console.log(`route=${route} buttons=${buttons.length} clicked=${clicked} failed=${failed}`);
}

test('owner buttons audit', async ({ page }) => {
  await login(page, 'owner', 'owner@lapka.local', 'demo12345');
  const routes = [
    '/owner/dashboard',
    '/owner/pets',
    '/owner/appointments',
    '/owner/pharmacy',
    '/owner/tools/calculators',
    '/owner/inpatient',
    '/owner/map',
  ];
  for (const route of routes) {
    await clickAudit(page, route);
  }
});

test('vet buttons audit', async ({ page }) => {
  await login(page, 'vet', 'vet@lapka.local', 'demo12345');
  const routes = ['/vet/dashboard', '/vet/patients', '/vet/visit/66666666-6666-6666-6666-666666666666', '/vet/labs'];
  for (const route of routes) {
    await clickAudit(page, route);
  }
});

test('admin buttons audit', async ({ page }) => {
  await login(page, 'clinic_admin', 'admin@lapka.local', 'demo12345');
  const routes = ['/clinic/dashboard', '/clinic/schedule', '/clinic/services', '/clinic/billing', '/clinic/audit'];
  for (const route of routes) {
    await clickAudit(page, route);
  }
});
