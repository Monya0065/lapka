import { chromium } from 'playwright';
const BASE='http://127.0.0.1:3000';
const API='http://127.0.0.1:8000';
const user={ email:'owner@lapka.local', password:'demo12345', role:'owner' };
const routes=[
 '/owner/clinic/11111111-1111-1111-1111-111111111111',
 '/owner/vet/33333333-3333-3333-3333-333333333333',
 '/owner/inpatient/77777777-7777-7777-7777-777777777777',
 '/clinic/inpatient/77777777-7777-7777-7777-777777777777',
 '/clinic/billing/11111111-1111-1111-1111-111111111111',
 '/platform/dashboard',
 '/platform/ai'
];
const widths=[820,1024,1280];
async function inject(page, role,email,access_token,refresh_token){
 await page.addInitScript((s)=>{
 localStorage.setItem('lapka.access_token',s.access_token);
 localStorage.setItem('lapka.refresh_token',s.refresh_token);
 localStorage.setItem('lapka.role',s.role);
 localStorage.setItem('lapka.email',s.email);
 localStorage.setItem('lapka.user', JSON.stringify({role:s.role,email:s.email}));
 },{role,email,access_token,refresh_token});
}
const browser=await chromium.launch({headless:true});
for (const width of widths){
 const context=await browser.newContext({viewport:{width,height:1100}});
 const page=await context.newPage();
 const res=await page.request.post(`${API}/api/v1/auth/login`,{data:{email:user.email,password:user.password},headers:{'Content-Type':'application/json'}});
 const payload=await res.json();
 await inject(page,user.role,user.email,payload.access_token,payload.refresh_token);
 console.log(`\n# width ${width}`);
 for (const route of routes){
   await page.goto(`${BASE}${route}`,{waitUntil:'networkidle'});
   const dims=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
   if(dims.sw>dims.cw){
     console.log(`OVERFLOW ${route} ${dims.sw-dims.cw}px`);
   }
 }
 await context.close();
}
await browser.close();
