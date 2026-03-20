import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3000';
const API = 'http://127.0.0.1:8000';

const users = {
  owner: { email: 'owner@lapka.local', password: 'demo12345', role: 'owner', routes: ['/owner/dashboard','/owner/services','/owner/care','/owner/knowledge','/owner/appointments'] },
  vet: { email: 'vet@lapka.local', password: 'demo12345', role: 'vet', routes: ['/vet/dashboard','/vet/patients','/vet/labs','/vet/inpatient'] },
  clinic_admin: { email: 'admin@lapka.local', password: 'demo12345', role: 'clinic_admin', routes: ['/clinic/dashboard','/clinic/checkin','/clinic/patients','/clinic/inpatient'] },
  network_admin: { email: 'platform@lapka.local', password: 'demo12345', role: 'network_admin', routes: ['/platform/dashboard','/platform/security','/platform/ai'] },
};

async function login(page, { email, password, role }) {
  const res = await page.request.post(`${API}/api/v1/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  const payload = await res.json();
  await page.addInitScript((session) => {
    localStorage.setItem('lapka.access_token', session.access_token);
    localStorage.setItem('lapka.refresh_token', session.refresh_token);
    localStorage.setItem('lapka.role', session.role);
    localStorage.setItem('lapka.email', session.email);
    localStorage.setItem('lapka.user', JSON.stringify({ role: session.role, email: session.email }));
  }, { access_token: payload.access_token, refresh_token: payload.refresh_token, role, email });
}

const checked = new Set();
const issues = [];

async function inspectRoute(page, route, role) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  const data = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]'))
      .map((a) => ({ href: a.getAttribute('href'), text: a.textContent?.trim() || '' }))
      .filter((x) => x.href && x.href.startsWith('/') && !x.href.startsWith('/api/'));
  });
  for (const link of data) {
    const href = link.href;
    if (checked.has(`${role}:${href}`)) continue;
    checked.add(`${role}:${href}`);
    const res = await page.request.get(`${BASE}${href}`, { failOnStatusCode: false });
    const status = res.status();
    if (status >= 400) {
      issues.push({ role, from: route, href, status, text: link.text });
    }
  }
}

const browser = await chromium.launch({ headless: true });
for (const [key, user] of Object.entries(users)) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, user);
  for (const route of user.routes) {
    await inspectRoute(page, route, key);
  }
  await context.close();
}
await browser.close();
console.log(JSON.stringify(issues, null, 2));
