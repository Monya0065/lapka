const { chromium } = require('./node_modules/playwright');
const roles = {
  owner: 'owner@lapka.local',
  vet: 'vet@lapka.local',
  clinic_admin: 'admin@lapka.local',
  network_admin: 'platform@lapka.local',
};
async function login(browser, role){
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  await page.goto(`http://localhost:3000/login?role=${role}`, { waitUntil:'networkidle' });
  if (await page.locator('input[type="email"]').count()) {
    await page.fill('input[type="email"]', roles[role]);
    await page.fill('input[type="password"]', 'demo12345');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
  }
  return { context, page };
}
async function check(page, url, selectors=[]){
  const res = await page.goto(`http://localhost:3000${url}`, { waitUntil:'networkidle' });
  await page.waitForSelector('body');
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    const shell = document.querySelector('[data-workspace-shell]');
    const title = document.querySelector('.page-title');
    return Boolean(main || shell || title);
  }, null, { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll('a,button,input,select,textarea').length > 0, null, { timeout: 10000 }).catch(() => {});
  const status = res ? res.status() : 'nores';
  const missing = [];
  for (const sel of selectors) {
    if (!await page.locator(sel).count()) missing.push(sel);
  }
  return { url, status, missing };
}
(async()=>{
  const browser = await chromium.launch({ headless:true });
  const matrix = [];
  {
    const {context,page}=await login(browser,'owner');
    for (const item of [
      ['/owner/dashboard',['a[href="/owner/care"]']],
      ['/owner/care',['a[href="/owner/recovery"]']],
      ['/owner/services',['a[href="/owner/appointments"]']],
      ['/owner/inbox',['button:has-text("Прочитать всё")']],
      ['/owner/clinic/11111111-1111-1111-1111-111111111111',['a[href*="/owner/appointments?clinic_id="]']],
      ['/owner/vet/33333333-3333-3333-3333-333333333333',['a[href*="/owner/appointments?vet_id="]']],
      ['/owner/inpatient/77777777-7777-7777-7777-777777777777',['a[href="/owner/inbox"]']],
    ]) matrix.push(await check(page, item[0], item[1]));
    await context.close();
  }
  {
    const {context,page}=await login(browser,'vet');
    for (const item of [
      ['/vet/dashboard',['a[href="/vet/patients"]']],
      ['/vet/patients',['input[placeholder*="Имя"], input[placeholder*="телефон"], input[placeholder*="Телефон"]']],
      ['/vet/patient/55555555-5555-5555-5555-555555555555',['a[href*="/vet/visit/"]']],
      ['/vet/labs',['a[href*="/vet/patient/"]']],
      ['/vet/inbox',['button:has-text("Прочитать всё")']],
    ]) matrix.push(await check(page, item[0], item[1]));
    await context.close();
  }
  {
    const {context,page}=await login(browser,'clinic_admin');
    for (const item of [
      ['/clinic/dashboard',['a[href="/clinic/schedule"]']],
      ['/clinic/checkin',['input[placeholder*="поиск"], input[placeholder*="Поиск"], button:has-text("Сканировать QR")']],
      ['/clinic/schedule',['button:has-text("Подтвердить"), button:has-text("Отменить")']],
      ['/clinic/inpatient',['a[href*="/clinic/inpatient/"]']],
      ['/clinic/inbox',['button:has-text("Прочитать всё")']],
    ]) matrix.push(await check(page, item[0], item[1]));
    await context.close();
  }
  {
    const {context,page}=await login(browser,'network_admin');
    for (const item of [
      ['/platform/dashboard',['a[href="/platform/clinics"]']],
      ['/platform/ai',['select']],
      ['/platform/inbox',['button:has-text("Прочитать всё")']],
    ]) matrix.push(await check(page, item[0], item[1]));
    await context.close();
  }
  console.log(JSON.stringify(matrix, null, 2));
  await browser.close();
})();
