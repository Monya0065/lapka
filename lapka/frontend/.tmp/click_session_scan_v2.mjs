import { chromium } from 'playwright';

const API = 'http://localhost:8000';
const WEB = 'http://localhost:3000';

async function createSession(email, password) {
  const login = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!login.ok) throw new Error(`login failed: ${email}`);
  const tokens = await login.json();
  const me = await fetch(`${API}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  const user = await me.json();
  return { tokens, user };
}

const checks = [
  { email:'owner@lapka.local', route:'/owner/care', items:[['link','Паспорт питомца'],['link','Режим восстановления']] },
  { email:'owner@lapka.local', route:'/owner/services', items:[['link','Открыть карту'],['link','Паспорт питомца'],['link','Открыть расходы']] },
  { email:'vet@lapka.local', route:'/vet/patient/55555555-5555-5555-5555-555555555555', items:[['link','Начать новый приём'],['link','Открыть документы']] },
  { email:'admin@lapka.local', route:'/clinic/inpatient', items:[['link','Расписание и приём'],['link','Входящие и сигналы'],['link','Реестр пациентов']] },
  { email:'platform@lapka.local', route:'/platform/dashboard', items:[['link','Центр AI'],['link','Клиники сети']] }
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

for (const check of checks) {
  const auth = await createSession(check.email, 'demo12345');
  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ auth }) => {
    localStorage.setItem('lapka.role', auth.user.role);
    localStorage.setItem('lapka.email', auth.user.email);
    localStorage.setItem('lapka.access_token', auth.tokens.access_token);
    localStorage.setItem('lapka.refresh_token', auth.tokens.refresh_token);
    localStorage.setItem('lapka.user', JSON.stringify(auth.user));
  }, { auth });
  await page.goto(`${WEB}${check.route}`, { waitUntil: 'networkidle' });
  for (const [kind, label] of check.items) {
    const target = page.getByRole(kind, { name: label }).first();
    if (await target.count()) {
      await Promise.all([page.waitForLoadState('networkidle'), target.click()]);
      console.log('OK', check.route, label, page.url());
      await page.goBack({ waitUntil: 'networkidle' });
    } else {
      console.log('MISS', check.route, label);
    }
  }
}
await browser.close();
