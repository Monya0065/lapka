import { chromium } from 'playwright';

const routes = [
  '/owner/dashboard',
  '/owner/care',
  '/owner/services',
  '/owner/medications',
  '/owner/knowledge',
  '/owner/clinic/11111111-1111-1111-1111-111111111111',
  '/owner/vet/33333333-3333-3333-3333-333333333333',
  '/owner/inpatient/77777777-7777-7777-7777-777777777777',
  '/vet/dashboard',
  '/vet/patients',
  '/vet/patient/55555555-5555-5555-5555-555555555555',
  '/vet/labs',
  '/clinic/dashboard',
  '/clinic/checkin',
  '/clinic/schedule',
  '/clinic/inpatient',
  '/clinic/billing/11111111-1111-1111-1111-111111111111',
  '/platform/dashboard',
  '/platform/ai'
];
const widths = [820, 1024, 1280];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
async function login(role, email) {
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.locator('select').first().selectOption(role);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('demo12345');
  await page.getByRole('button', { name: /войти|login/i }).click();
  await page.waitForLoadState('networkidle');
}
const sessions = [
  { prefix: '/owner', role: 'owner', email: 'owner@lapka.local' },
  { prefix: '/vet', role: 'vet', email: 'vet@lapka.local' },
  { prefix: '/clinic', role: 'clinic_admin', email: 'admin@lapka.local' },
  { prefix: '/platform', role: 'network_admin', email: 'platform@lapka.local' },
];
for (const session of sessions) {
  await login(session.role, session.email);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1100 });
    for (const route of routes.filter((r) => r.startsWith(session.prefix))) {
      await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle' });
      const data = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      if (data.sw > data.cw + 2) {
        console.log('OVERFLOW', width, route, data.sw, data.cw);
      }
    }
  }
}
await browser.close();
