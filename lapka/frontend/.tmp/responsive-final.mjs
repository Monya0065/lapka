import { chromium } from 'playwright';
const BASE='http://127.0.0.1:3000';
const API='http://127.0.0.1:8000';
const cases=[
 ['/owner/dashboard','owner'],
 ['/owner/care','owner'],
 ['/owner/clinic/11111111-1111-1111-1111-111111111111','owner'],
 ['/owner/vet/33333333-3333-3333-3333-333333333333','owner'],
 ['/owner/inpatient/77777777-7777-7777-7777-777777777777','owner'],
 ['/vet/patient/55555555-5555-5555-5555-555555555555','vet'],
 ['/vet/labs','vet'],
 ['/clinic/checkin','clinic_admin'],
 ['/clinic/inpatient','clinic_admin'],
 ['/clinic/billing/11111111-1111-1111-1111-111111111111','clinic_admin'],
 ['/platform/dashboard','network_admin'],
 ['/platform/ai','network_admin'],
];
const users={owner:['owner@lapka.local','demo12345'],vet:['vet@lapka.local','demo12345'],clinic_admin:['admin@lapka.local','demo12345'],network_admin:['platform@lapka.local','demo12345']};
async function token(role){const [email,password]=users[role]; const res=await fetch(`${API}/api/v1/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}); return res.json();}
const tokens={}; for(const role of new Set(cases.map(([,r])=>r))) tokens[role]=await token(role);
const browser=await chromium.launch({headless:true});
for (const width of [768,820,1024,1280]){
 console.log(`\n# width ${width}`);
 for(const [route,role] of cases){
  const context=await browser.newContext({viewport:{width,height:1100}});
  const page=await context.newPage();
  const t=tokens[role];
  await page.addInitScript(s=>{localStorage.setItem('lapka.access_token',s.access_token);localStorage.setItem('lapka.refresh_token',s.refresh_token);localStorage.setItem('lapka.role',s.role);localStorage.setItem('lapka.email',s.email);localStorage.setItem('lapka.user',JSON.stringify({role:s.role,email:s.email}));},{access_token:t.access_token,refresh_token:t.refresh_token,role,email:users[role][0]});
  await page.goto(`${BASE}${route}`,{waitUntil:'networkidle'});
  const m=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyScrollWidth:document.body.scrollWidth}));
  if(m.scrollWidth>m.clientWidth+2||m.bodyScrollWidth>m.clientWidth+2) console.log('OVERFLOW', route, JSON.stringify(m));
  await context.close();
 }
}
await browser.close();
