import { chromium } from 'playwright';
const BASE='http://127.0.0.1:3000';
const API='http://127.0.0.1:8000';
const users={owner:['owner@lapka.local','demo12345'],vet:['vet@lapka.local','demo12345'],clinic_admin:['admin@lapka.local','demo12345'],network_admin:['platform@lapka.local','demo12345']};
const checks=[
 ['owner','/owner/dashboard','Открыть профиль',/\/owner\/pet\//],
 ['owner','/owner/dashboard','Открыть лекарства',/\/owner\/medications/],
 ['owner','/owner/services','Открыть карту',/\/owner\/map/],
 ['vet','/vet/dashboard','Открыть поток приёма',/\/vet\/appointments/],
 ['vet','/vet/labs','Открыть пациента',/\/vet\/patient\//],
 ['clinic_admin','/clinic/dashboard','Ресепшн',/\/clinic\/checkin/],
 ['clinic_admin','/clinic/dashboard','Расписание',/\/clinic\/schedule/],
 ['network_admin','/platform/dashboard','Клиники сети',/\/platform\/clinics/],
 ['network_admin','/platform/dashboard','Центр AI',/\/platform\/ai/],
];
async function login(page, role){const [email,password]=users[role];const res=await page.request.post(`${API}/api/v1/auth/login`,{data:{email,password},headers:{'Content-Type':'application/json'}});const p=await res.json();await page.addInitScript(s=>{localStorage.setItem('lapka.access_token',s.access_token);localStorage.setItem('lapka.refresh_token',s.refresh_token);localStorage.setItem('lapka.role',s.role);localStorage.setItem('lapka.email',s.email);localStorage.setItem('lapka.user',JSON.stringify({role:s.role,email:s.email}));},{access_token:p.access_token,refresh_token:p.refresh_token,role,email});}
const browser=await chromium.launch({headless:true});
const results=[];
for(const [role,route,label,expect] of checks){
 const ctx=await browser.newContext({viewport:{width:1440,height:1100}}); const page=await ctx.newPage();
 const pageErrors=[]; page.on('pageerror',e=>pageErrors.push(String(e)));
 await login(page,role); await page.goto(`${BASE}${route}`,{waitUntil:'networkidle'});
 const loc=page.getByRole('link',{name:label}).first();
 if(!(await loc.count())) {results.push({role,route,label,status:'missing'}); await ctx.close(); continue;}
 await loc.scrollIntoViewIfNeeded();
 const box=await loc.boundingBox();
 await page.mouse.click(box.x+box.width/2, box.y+box.height/2);
 await page.waitForTimeout(600);
 results.push({role,route,label,status:expect.test(page.url())?'ok':'wrong-target',url:page.url(),pageErrors});
 await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results,null,2));
