import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
async function login(role, email) {
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.locator('select').first().selectOption(role);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill('demo12345');
  await page.getByRole('button', { name: /войти|login/i }).click();
  await page.waitForLoadState('networkidle');
}
const checks = [
  { role:'owner', email:'owner@lapka.local', route:'/owner/care', links:['Открыть центр ухода','Паспорт питомца'] },
  { role:'owner', email:'owner@lapka.local', route:'/owner/services', links:['Карта','Паспорт','Расходы'] },
  { role:'vet', email:'vet@lapka.local', route:'/vet/patient/55555555-5555-5555-5555-555555555555', links:['Начать новый приём','Открыть документы'] },
  { role:'clinic_admin', email:'admin@lapka.local', route:'/clinic/inpatient', links:['Расписание','Inbox','Реестр пациентов'] },
  { role:'network_admin', email:'platform@lapka.local', route:'/platform/dashboard', links:['Центр AI','Клиники сети'] }
];
for (const check of checks) {
  await login(check.role, check.email);
  await page.goto(`http://localhost:3000${check.route}`, { waitUntil: 'networkidle' });
  for (const label of check.links) {
    const link = page.getByRole('link', { name: label }).first();
    if (await link.count()) {
      await Promise.all([page.waitForLoadState('networkidle'), link.click()]);
      console.log('OK', check.route, label, page.url());
      await page.goBack({ waitUntil: 'networkidle' });
    } else {
      console.log('MISS', check.route, label);
    }
  }
}
await browser.close();
