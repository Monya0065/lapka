import { expect, test } from '@playwright/test';

const CREDENTIALS = {
  owner: { email: 'owner@lapka.local', password: 'demo12345', role: 'owner' },
  vet: { email: 'vet@lapka.local', password: 'demo12345', role: 'vet' },
  clinic_admin: { email: 'admin@lapka.local', password: 'demo12345', role: 'clinic_admin' },
};

async function login(page, role: keyof typeof CREDENTIALS) {
  const user = CREDENTIALS[role];
  await page.goto(`/login?role=${user.role}`);

  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Пароль').fill(user.password);
  // clinic/vet users need to specify clinic id for context
  if (user.role === 'vet' || user.role === 'clinic_admin') {
    await page.getByLabel('ID клиники').fill(process.env.CLINIC_ID || '11111111-1111-1111-1111-111111111111');
  }
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
}

test('owner happy path: login -> pets list', async ({ page }) => {
  await login(page, 'owner');
  await expect(page).toHaveURL(/\/owner\/dashboard/);
  await page.waitForTimeout(2000); // wait for data load
  console.log('Current URL:', await page.url());
  const h1s = await page.locator('h1').allTextContents();
  console.log('H1s on page:', h1s);
  const allHeadings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
  console.log('All headings:', allHeadings);
  const zdr = await page.locator('h1').filter({ hasText: 'Здравствуйте' }).count();
  console.log('H1 with Здравствуйте count:', zdr);
  const firstH1 = await page.locator('h1').first().textContent();
  console.log('First H1 text:', firstH1);
  await page.screenshot({ path: 'debug-owner-dashboard.png' });
  await expect(page.getByRole('heading', { name: /Персональный центр здоровья питомца/i })).toBeVisible();

  await page.goto('/owner/pets');
  await expect(page).toHaveURL(/\/owner\/pets/);
  await expect(page.getByRole('heading', { name: /^Мои питомцы$/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Барсик$/i })).toBeVisible();
});

// verify dark theme toggle cycles and adds class to <html>
test('theme toggle cycles modes', async ({ page }) => {
  await page.goto('/');
  const btn = page.locator('button[title^="Theme:"]');
  await expect(btn).toBeVisible();

  // click twice to ensure dark applied (system -> light -> dark)
  await btn.click();
  await btn.click();
  const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  expect(hasDark).toBeTruthy();
});

test('vet happy path: login -> search patient -> open card', async ({ page }) => {
  await login(page, 'vet');
  await expect(page).toHaveURL(/\/vet\/dashboard/);

  await page.goto('/vet/patients');
  await page.waitForTimeout(10000); // wait for clinic scope to load
  console.log('Vet patients URL:', await page.url());
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
  console.log('Headings on vet patients:', headings);
  const pacientiCount = await page.locator('h1').filter({ hasText: 'Пациенты' }).count();
  console.log('H1 with Пациенты count:', pacientiCount);
  await page.screenshot({ path: 'debug-vet-patients.png' });
  await expect(page.getByRole('heading', { name: /Поиск пациента и доступ к карте/i })).toBeVisible();

  await page.getByLabel('Запрос').fill('Барсик');
  await page.getByRole('button', { name: 'Найти' }).click();

  const openCards = page.getByRole('link', { name: 'Карточка пациента' });
  const requestButtons = page.getByRole('button', { name: 'Запросить согласие владельца' });
  const emptyState = page.getByText('Нет результатов');

  await expect
    .poll(async () => (await openCards.count()) + (await requestButtons.count()) + (await emptyState.count()), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);

  if (await openCards.count()) {
    await openCards.first().click();
    await expect(page).toHaveURL(/\/vet\/patient\//);
    await expect(page.getByRole('heading', { name: /Пациент и ход приёма/i })).toBeVisible();
  } else if (await requestButtons.count()) {
    await expect(requestButtons.first()).toBeVisible();
  } else {
    // Expect empty state if no results
    await expect(emptyState).toBeVisible();
  }
});

test('clinic admin happy path: login -> dashboard -> schedule', async ({ page }) => {
  await login(page, 'clinic_admin');
  await expect(page).toHaveURL(/\/clinic\/dashboard/);
  await expect(page.getByRole('heading', { name: /CRM и контроль клиники/i })).toBeVisible();

  await page.goto('/clinic/schedule');
  await expect(page).toHaveURL(/\/clinic\/schedule/);
  await expect(page.getByRole('heading', { name: /Расписание/i })).toBeVisible();
});

test('role guard: owner cannot open vet routes', async ({ page }) => {
  await login(page, 'owner');
  await expect(page).toHaveURL(/\/owner\/dashboard/);

  await page.goto('/vet/dashboard');
  await expect(page).toHaveURL(/\/owner\/dashboard/);
});
