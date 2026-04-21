import { expect, test, type Page, type APIRequestContext } from '@playwright/test';

function pathnameIs(urlString: string, path: string) {
  try {
    return new URL(urlString).pathname === path;
  } catch {
    return false;
  }
}

function currentPathname(urlString: string) {
  try {
    return new URL(urlString).pathname;
  } catch {
    return '';
  }
}

const CREDENTIALS = {
  owner: { email: 'owner@lapka.local', password: 'demo12345', role: 'owner' },
  vet: { email: 'vet@lapka.local', password: 'demo12345', role: 'vet' },
  clinic_admin: { email: 'admin@lapka.local', password: 'demo12345', role: 'clinic_admin' },
  network_admin: { email: 'platform@lapka.local', password: 'demo12345', role: 'network_admin' },
};

async function login(page: Page, role: keyof typeof CREDENTIALS) {
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

async function loginViaApi(page: Page, request: APIRequestContext, role: keyof typeof CREDENTIALS) {
  const user = CREDENTIALS[role];
  const apiBase = process.env.E2E_API_URL || 'http://localhost:8000';
  const payload: Record<string, string> = { email: user.email, password: user.password };
  if (user.role === 'vet' || user.role === 'clinic_admin') {
    payload.clinic_id = process.env.CLINIC_ID || '11111111-1111-1111-1111-111111111111';
  }
  const loginResponse = await request.post(`${apiBase}/api/v1/auth/login`, { data: payload });
  expect(loginResponse.ok()).toBeTruthy();
  const tokens = await loginResponse.json();

  const meResponse = await request.get(`${apiBase}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  expect(meResponse.ok()).toBeTruthy();
  const me = await meResponse.json();

  await page.goto('/');
  await page.evaluate(
    ({ access, refresh, role, email, userObj }: { access: string; refresh: string; role: string; email: string; userObj: unknown }) => {
      window.localStorage.setItem('lapka.access_token', access);
      window.localStorage.setItem('lapka.refresh_token', refresh);
      window.localStorage.setItem('lapka.role', role);
      window.localStorage.setItem('lapka.email', email);
      window.localStorage.setItem('lapka.user', JSON.stringify(userObj));
    },
    {
      access: tokens.access_token,
      refresh: tokens.refresh_token,
      role: me.role,
      email: me.email,
      userObj: me as unknown,
    },
  );
}

async function gotoRouteWithReauth(page: Page, request: APIRequestContext, role: keyof typeof CREDENTIALS, route: string) {
  await page.goto(route);
  if (currentPathname(page.url()) === '/login') {
    await loginViaApi(page, request, role);
    await page.goto(route);
  }
}

async function completeLegalGateIfShown(page: Page) {
  const onLegalPage = () => {
    try {
      return new URL(page.url()).pathname.endsWith('/legal');
    } catch {
      return false;
    }
  };

  if (!onLegalPage()) return false;
  await expect(page.getByRole('heading', { name: /Юридический центр/i })).toBeVisible();

  const checkboxes = page.locator('input[type="checkbox"]');
  const total = await checkboxes.count();
  for (let i = 0; i < total; i += 1) {
    const checkbox = checkboxes.nth(i);
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }
  }
  return true;
}

test('owner happy path: login -> pets list', async ({ page }) => {
  await login(page, 'owner');
  await expect.poll(() => pathnameIs(page.url(), '/owner/dashboard')).toBeTruthy();
  await expect(
    page.getByTestId('owner-dashboard-title').or(page.getByRole('heading', { name: /Персональный центр здоровья питомца/i }))
  ).toBeVisible();

  await page.goto('/owner/pets');
  await expect.poll(() => pathnameIs(page.url(), '/owner/pets')).toBeTruthy();
  await expect(page.getByTestId('owner-pets-title').or(page.getByRole('heading', { name: /^Мои питомцы$/i }).first())).toBeVisible();
  const hasPetCards = await page.locator('[data-testid="pet-card"], .surface-card').count();
  const hasEmptyState = await page.getByText(/питомц|нет питомц|добав/i).count();
  expect(hasPetCards + hasEmptyState).toBeGreaterThan(0);
});

test('owner nav baseline: core routes open without legal redirect loop', async ({ page, request }) => {
  await loginViaApi(page, request, 'owner');
  const routes = ['/owner/dashboard', '/owner/pets', '/owner/documents', '/owner/billing'];

  for (const route of routes) {
    await gotoRouteWithReauth(page, request, 'owner', route);
    await expect.poll(() => pathnameIs(page.url(), route), { timeout: 15_000 }).toBeTruthy();
    await expect.poll(() => !page.url().includes('/owner/legal')).toBeTruthy();
  }
});

test('vet nav baseline: core routes open without legal redirect loop', async ({ page, request }) => {
  await loginViaApi(page, request, 'vet');
  const routes = ['/vet/dashboard', '/vet/patients', '/vet/documents', '/vet/labs'];

  for (const route of routes) {
    await gotoRouteWithReauth(page, request, 'vet', route);
    await expect.poll(() => pathnameIs(page.url(), route), { timeout: 20_000 }).toBeTruthy();
    await expect.poll(() => !page.url().includes('/vet/legal')).toBeTruthy();
  }
});

test('clinic admin nav baseline: core routes open without legal redirect loop', async ({ page, request }) => {
  await loginViaApi(page, request, 'clinic_admin');
  const routes = ['/clinic/dashboard', '/clinic/schedule', '/clinic/patients', '/clinic/billing'];

  for (const route of routes) {
    await gotoRouteWithReauth(page, request, 'clinic_admin', route);
    await expect.poll(() => pathnameIs(page.url(), route), { timeout: 20_000 }).toBeTruthy();
    await expect.poll(() => !page.url().includes('/clinic/legal')).toBeTruthy();
  }
});

test('platform nav baseline: core routes open without legal redirect loop', async ({ page, request }) => {
  await loginViaApi(page, request, 'network_admin');
  const routes = ['/platform/dashboard', '/platform/clinics', '/platform/users', '/platform/security'];

  for (const route of routes) {
    await gotoRouteWithReauth(page, request, 'network_admin', route);
    await expect.poll(() => pathnameIs(page.url(), route), { timeout: 20_000 }).toBeTruthy();
    await expect.poll(() => !page.url().includes('/platform/legal')).toBeTruthy();
  }
});

test('owner pets card compact visual does not show gallery tabs', async ({ page, request }) => {
  await loginViaApi(page, request, 'owner');
  await page.goto('/owner/pets');
  await expect.poll(() => pathnameIs(page.url(), '/owner/pets')).toBeTruthy();

  const cards = page.getByTestId('pet-card');
  const cardCount = await cards.count();
  if (cardCount > 0) {
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.getByTestId('pet-card-visual')).toBeVisible();
    await expect(firstCard.getByRole('button', { name: /Фото питомца|Породное фото|3D-визуал/i })).toHaveCount(0);
    return;
  }

  await expect(page.getByTestId('owner-pets-title').or(page.getByRole('heading', { name: /^Мои питомцы$/i }).first())).toBeVisible();
});

test('owner pets card keeps aligned visual and action geometry', async ({ page, request }) => {
  await loginViaApi(page, request, 'owner');
  await page.goto('/owner/pets');
  await expect.poll(() => pathnameIs(page.url(), '/owner/pets')).toBeTruthy();

  const cards = page.getByTestId('pet-card');
  const cardCount = await cards.count();
  if (cardCount === 0) {
    await expect(page.getByTestId('owner-pets-title').or(page.getByRole('heading', { name: /^Мои питомцы$/i }).first())).toBeVisible();
    return;
  }

  const firstCard = cards.first();
  const visual = firstCard.getByTestId('pet-card-visual');
  const actions = firstCard.getByTestId('pet-card-actions').locator('a,button');
  await expect(visual).toBeVisible();
  await expect(firstCard.getByTestId('pet-card-metrics')).toBeVisible();

  const visualBox = await visual.boundingBox();
  expect(visualBox).toBeTruthy();
  expect((visualBox?.height || 0) >= 220).toBeTruthy();

  const actionCount = await actions.count();
  if (actionCount >= 2) {
    const heights: number[] = [];
    for (let i = 0; i < actionCount; i += 1) {
      const box = await actions.nth(i).boundingBox();
      if (box?.height) heights.push(Math.round(box.height));
    }
    const uniqueHeights = new Set(heights);
    expect(uniqueHeights.size <= 2).toBeTruthy();
  }
});

test('workspace privacy banner is dismissible and non-blocking', async ({ page, request }) => {
  await loginViaApi(page, request, 'owner');
  await page.evaluate(() => {
    window.localStorage.removeItem('lapka.privacy-banner.dismissed.owner');
  });
  await page.goto('/owner/dashboard');
  await expect.poll(() => pathnameIs(page.url(), '/owner/dashboard')).toBeTruthy();

  const banner = page.getByText('Конфиденциальность и безопасность').first();
  if (await banner.count()) {
    await expect(banner).toBeVisible();
    await page.getByRole('button', { name: 'Скрыть' }).first().click();
    await expect(banner).toHaveCount(0);
  }

  await page.goto('/owner/pets');
  await expect.poll(() => pathnameIs(page.url(), '/owner/pets')).toBeTruthy();
  await expect(page.getByTestId('owner-pets-title').or(page.getByRole('heading', { name: /^Мои питомцы$/i }).first())).toBeVisible();
});

test('owner pet profile quick actions stay aligned', async ({ page, request }) => {
  await loginViaApi(page, request, 'owner');
  await page.goto('/owner/pets');
  await expect.poll(() => pathnameIs(page.url(), '/owner/pets')).toBeTruthy();

  const openProfileLinks = page.getByRole('link', { name: 'Открыть профиль' });
  const profileLinkCount = await openProfileLinks.count();
  if (profileLinkCount === 0) {
    await expect(page.getByTestId('owner-pets-title').or(page.getByRole('heading', { name: /^Мои питомцы$/i }).first())).toBeVisible();
    return;
  }

  await openProfileLinks.first().click();
  await expect.poll(() => page.url().includes('/owner/pet/')).toBeTruthy();
  const title = page.getByTestId('owner-pet-profile-title');
  if (!(await title.count())) {
    await expect(page.getByTestId('owner-pets-title').or(page.getByRole('heading', { name: /^Мои питомцы$/i }).first())).toBeVisible();
    return;
  }
  await expect(title).toBeVisible();

  const quickActions = page.getByTestId('owner-pet-quick-actions');
  if (!(await quickActions.count())) {
    await expect(title).toBeVisible();
    return;
  }
  await expect(quickActions).toBeVisible();
  const actionButtons = quickActions.locator('a');
  const count = await actionButtons.count();
  expect(count >= 4).toBeTruthy();

  const heights: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const box = await actionButtons.nth(i).boundingBox();
    if (box?.height) heights.push(Math.round(box.height));
  }
  expect(new Set(heights).size <= 2).toBeTruthy();
});

test('policy event does not break navigation', async ({ page, request }) => {
  await loginViaApi(page, request, 'owner');
  await page.goto('/owner/dashboard');
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('lapka:policy-forbidden', {
        detail: { message: 'Role is not allowed for this endpoint' },
      })
    );
  });
  await expect.poll(() => pathnameIs(page.url(), '/owner/dashboard')).toBeTruthy();
  await page.goto('/owner/pets');
  await expect.poll(() => pathnameIs(page.url(), '/owner/pets')).toBeTruthy();
});

// verify dark theme toggle cycles and adds class to <html>
test('theme toggle cycles modes', async ({ page }) => {
  await page.goto('/');
  const btn = page.getByTestId('theme-toggle').or(page.locator('button[title^="Theme:"]'));
  await expect(btn).toBeVisible();

  // click twice to ensure dark applied (system -> light -> dark)
  await btn.click();
  await btn.click();
  const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  expect(hasDark).toBeTruthy();
});

test('vet happy path: login -> search patient -> open card', async ({ page }) => {
  await login(page, 'vet');
  await expect.poll(() => pathnameIs(page.url(), '/vet/dashboard')).toBeTruthy();

  await page.goto('/vet/patients');
  await expect(
    page.getByTestId('vet-patients-title').or(page.getByRole('heading', { name: /Поиск пациента и доступ к карте/i }))
  ).toBeVisible();

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
    await expect.poll(() => page.url().includes('/vet/patient/')).toBeTruthy();
    await expect(
      page.getByTestId('vet-patient-title').or(page.getByRole('heading', { name: /Пациент и ход приёма/i }))
    ).toBeVisible();
  } else if (await requestButtons.count()) {
    await expect(requestButtons.first()).toBeVisible();
  } else {
    // Expect empty state if no results
    await expect(emptyState).toBeVisible();
  }
});

test('clinic admin happy path: login -> dashboard -> schedule', async ({ page }) => {
  await login(page, 'clinic_admin');
  await expect.poll(() => pathnameIs(page.url(), '/clinic/dashboard')).toBeTruthy();
  await expect(
    page
      .getByTestId('clinic-dashboard-title')
      .or(page.getByRole('heading', { name: /CRM и контроль клиники|Операционный дашборд клиники/i }))
  ).toBeVisible();

  await page.getByRole('link', { name: 'Расписание' }).first().click();
  await expect.poll(() => pathnameIs(page.url(), '/clinic/schedule'), { timeout: 25_000 }).toBeTruthy();

  const scheduleHeading = page
    .getByTestId('clinic-schedule-title')
    .or(page.locator('h1.page-title'))
    .or(page.getByRole('heading', { name: /Расписание|операционн|календарь/i }));
  await expect(scheduleHeading.first()).toBeVisible({ timeout: 25_000 });
  await expect(scheduleHeading.first()).toContainText(/Расписание|операционн|календарь/i);
});

test('role guard: owner cannot open vet routes', async ({ page }) => {
  await login(page, 'owner');
  await expect.poll(() => pathnameIs(page.url(), '/owner/dashboard')).toBeTruthy();

  await page.goto('/vet/dashboard');
  await expect
    .poll(() => {
      const pathname = new URL(page.url()).pathname;
      return pathname === '/owner/dashboard' || pathname === '/login';
    })
    .toBeTruthy();
  await expect.poll(() => pathnameIs(page.url(), '/vet/dashboard')).toBeFalsy();
});

test('legal gate: owner confirms documents and returns to target', async ({ page, request }) => {
  await loginViaApi(page, request, 'owner');
  await page.goto('/owner/pets');

  const completed = await completeLegalGateIfShown(page);
  if (completed) {
    await expect.poll(() => pathnameIs(page.url(), '/owner/pets'), { timeout: 20_000 }).toBeTruthy();
  } else {
    await expect.poll(() => pathnameIs(page.url(), '/owner/pets')).toBeTruthy();
  }

  await expect(page.getByTestId('owner-pets-title').or(page.getByRole('heading', { name: /^Мои питомцы$/i }).first())).toBeVisible();
});

