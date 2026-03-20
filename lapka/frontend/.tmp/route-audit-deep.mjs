import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:3000';
const API = 'http://127.0.0.1:8000';
const users = {
  owner: { email: 'owner@lapka.local', password: 'demo12345', role: 'owner', routes: ['/owner/dashboard','/owner/pets','/owner/records','/owner/documents','/owner/care','/owner/knowledge','/owner/services','/owner/inpatient','/owner/market','/owner/passport-center','/owner/pet/55555555-5555-5555-5555-555555555555','/owner/pet/55555555-5555-5555-5555-555555555555/records','/owner/pet/55555555-5555-5555-5555-555555555555/documents','/owner/pet/55555555-5555-5555-5555-555555555555/passport','/owner/clinic/11111111-1111-1111-1111-111111111111','/owner/vet/33333333-3333-3333-3333-333333333333'] },
  vet: { email: 'vet@lapka.local', password: 'demo12345', role: 'vet', routes: ['/vet/dashboard','/vet/patients','/vet/patient/55555555-5555-5555-5555-555555555555','/vet/labs','/vet/inpatient','/vet/inpatient/77777777-7777-7777-7777-777777777777','/vet/visit/66666666-6666-6666-6666-666666666666'] },
  clinic_admin: { email: 'admin@lapka.local', password: 'demo12345', role: 'clinic_admin', routes: ['/clinic/dashboard','/clinic/checkin','/clinic/patients','/clinic/patients/55555555-5555-5555-5555-555555555555','/clinic/schedule','/clinic/inpatient','/clinic/inpatient/77777777-7777-7777-7777-777777777777','/clinic/billing','/clinic/billing/11111111-1111-1111-1111-111111111111','/clinic/templates'] },
  network_admin: { email: 'platform@lapka.local', password: 'demo12345', role: 'network_admin', routes: ['/platform/dashboard','/platform/security','/platform/ai','/platform/clinics','/platform/users','/platform/inbox'] },
};
async function login(page, { email, password, role }) {
  const res = await page.request.post(`${API}/api/v1/auth/login`, { data: { email, password }, headers: { 'Content-Type': 'application/json' } });
  const payload = await res.json();
  await page.addInitScript((session) => {
    localStorage.setItem('lapka.access_token', session.access_token);
    localStorage.setItem('lapka.refresh_token', session.refresh_token);
    localStorage.setItem('lapka.role', session.role);
    localStorage.setItem('lapka.email', session.email);
    localStorage.setItem('lapka.user', JSON.stringify({ role: session.role, email: session.email }));
  }, { access_token: payload.access_token, refresh_token: payload.refresh_token, role, email });
}
const issues = [];
const seen = new Set();
const browser = await chromium.launch({ headless: true });
for (const [key, user] of Object.entries(users)) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, user);
  for (const route of user.routes) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    const links = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim() })).filter(x => x.href && x.href.startsWith('/') && !x.href.startsWith('/api/')));
    for (const link of links) {
      const id = `${key}:${link.href}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const res = await page.request.get(`${BASE}${link.href}`, { failOnStatusCode: false });
      if (res.status() >= 400) issues.push({ role: key, from: route, href: link.href, status: res.status(), text: link.text });
    }
  }
  await context.close();
}
await browser.close();
console.log(JSON.stringify(issues, null, 2));
