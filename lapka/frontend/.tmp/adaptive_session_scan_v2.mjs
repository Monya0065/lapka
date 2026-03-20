import { chromium } from 'playwright';
const API='http://localhost:8000';
const WEB='http://localhost:3000';
async function createSession(email,password){
 const login=await fetch(`${API}/api/v1/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 const tokens=await login.json();
 const me=await fetch(`${API}/api/v1/auth/me`,{headers:{Authorization:`Bearer ${tokens.access_token}`}});
 const user=await me.json();
 return {tokens,user};
}
const sessions=[
 {email:'owner@lapka.local', routes:['/owner/dashboard','/owner/care','/owner/services','/owner/knowledge','/owner/clinic/11111111-1111-1111-1111-111111111111','/owner/vet/33333333-3333-3333-3333-333333333333','/owner/inpatient/77777777-7777-7777-7777-777777777777']},
 {email:'vet@lapka.local', routes:['/vet/dashboard','/vet/patients','/vet/patient/55555555-5555-5555-5555-555555555555','/vet/labs','/vet/inpatient/77777777-7777-7777-7777-777777777777']},
 {email:'admin@lapka.local', routes:['/clinic/dashboard','/clinic/checkin','/clinic/schedule','/clinic/inpatient','/clinic/inpatient/77777777-7777-7777-7777-777777777777','/clinic/billing/11111111-1111-1111-1111-111111111111']},
 {email:'platform@lapka.local', routes:['/platform/dashboard','/platform/ai','/platform/security','/platform/clinics']}
];
const widths=[768,820,1024,1280];
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
for(const session of sessions){
 const auth=await createSession(session.email,'demo12345');
 await page.goto(WEB,{waitUntil:'domcontentloaded'});
 await page.evaluate(({auth})=>{
  localStorage.setItem('lapka.role',auth.user.role);
  localStorage.setItem('lapka.email',auth.user.email);
  localStorage.setItem('lapka.access_token',auth.tokens.access_token);
  localStorage.setItem('lapka.refresh_token',auth.tokens.refresh_token);
  localStorage.setItem('lapka.user',JSON.stringify(auth.user));
 },{auth});
 for(const width of widths){
  await page.setViewportSize({width,height:1100});
  for(const route of session.routes){
   await page.goto(`${WEB}${route}`,{waitUntil:'networkidle'});
   const data=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
   if(data.sw>data.cw+2) console.log('OVERFLOW',width,route,data.sw,data.cw);
  }
 }
}
await browser.close();
