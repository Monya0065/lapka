import { chromium, request } from 'playwright';
const base = 'http://localhost:3000';
const api = 'http://localhost:8000';
const users = {
  owner: { email: 'owner@lapka.local', password: 'demo12345', user: { email: 'owner@lapka.local', role: 'owner' } },
  vet: { email: 'vet@lapka.local', password: 'demo12345', user: { email: 'vet@lapka.local', role: 'vet' } },
  clinic_admin: { email: 'admin@lapka.local', password: 'demo12345', user: { email: 'admin@lapka.local', role: 'clinic_admin' } },
  network_admin: { email: 'admin@lapka.local', password: 'demo12345', user: { email: 'admin@lapka.local', role: 'network_admin' } },
};
const routes = [
  ['/owner/dashboard','owner'], ['/owner/care','owner'], ['/owner/services','owner'], ['/owner/clinic/11111111-1111-1111-1111-111111111111','owner'], ['/owner/vet/33333333-3333-3333-3333-333333333333','owner'], ['/owner/inpatient/77777777-7777-7777-7777-777777777777','owner'],
  ['/vet/dashboard','vet'], ['/vet/patients','vet'], ['/vet/patient/55555555-5555-5555-5555-555555555555','vet'], ['/vet/labs','vet'],
  ['/clinic/dashboard','clinic_admin'], ['/clinic/checkin','clinic_admin'], ['/clinic/schedule','clinic_admin'], ['/clinic/inpatient','clinic_admin'], ['/clinic/billing/11111111-1111-1111-1111-111111111111','clinic_admin'],
  ['/platform/dashboard','network_admin'], ['/platform/ai','network_admin'],
];
const widths = [820, 1024, 1280, 1440];
async function login(role) {
  const ctx = await request.newContext();
  const res = await ctx.post(`${api}/api/v1/auth/login`, { headers: { 'Content-Type': 'application/json' }, data: { email: users[role].email, password: users[role].password } });
  if (!res.ok()) throw new Error(`login failed ${role}: ${res.status()}`);
  const body = await res.json();
  await ctx.dispose();
  return { ...body, user: users[role].user };
}
const tokens = {};
for (const role of new Set(routes.map(([, r]) => r))) tokens[role] = await login(role);
const browser = await chromium.launch({ headless: true });
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 1100 } });
  console.log(`\n# width ${width}`);
  for (const [route, role] of routes) {
    const auth = tokens[role];
    await page.addInitScript((payload) => {
      localStorage.setItem('lapka.role', payload.role);
      localStorage.setItem('lapka.email', payload.email);
      localStorage.setItem('lapka.access_token', payload.access);
      localStorage.setItem('lapka.refresh_token', payload.refresh);
      localStorage.setItem('lapka.user', JSON.stringify(payload.user));
    }, { role, email: auth.user.email, access: auth.access_token, refresh: auth.refresh_token, user: auth.user });
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    const stats = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const overflow = Math.max(root.scrollWidth - window.innerWidth, body.scrollWidth - window.innerWidth);
      return { overflow, title: document.querySelector('h1')?.textContent?.trim() || '' };
    });
    if (stats.overflow > 4) console.log(`OVERFLOW ${stats.overflow}px ${route} :: ${stats.title}`);
  }
  await page.close();
}
await browser.close();
