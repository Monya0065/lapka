import { chromium } from 'playwright';
const BASE='http://127.0.0.1:3000';
const API='http://127.0.0.1:8000';
const users={
 owner:{email:'owner@lapka.local',password:'demo12345',role:'owner'},
 vet:{email:'vet@lapka.local',password:'demo12345',role:'vet'},
 clinic_admin:{email:'admin@lapka.local',password:'demo12345',role:'clinic_admin'},
 network_admin:{email:'platform@lapka.local',password:'demo12345',role:'network_admin'},
};
async function login(page,user){
 const res=await page.request.post(`${API}/api/v1/auth/login`,{data:{email:user.email,password:user.password},headers:{'Content-Type':'application/json'}});
 if(!res.ok()) throw new Error(`login failed ${user.role}: ${res.status()}`);
 const payload=await res.json();
 await page.addInitScript((session)=>{
  localStorage.setItem('lapka.access_token',session.access_token);
  localStorage.setItem('lapka.refresh_token',session.refresh_token);
  localStorage.setItem('lapka.role',session.role);
  localStorage.setItem('lapka.email',session.email);
  localStorage.setItem('lapka.user',JSON.stringify({role:session.role,email:session.email}));
 },{access_token:payload.access_token,refresh_token:payload.refresh_token,role:user.role,email:user.email});
}
const checks=[
 {role:'owner',start:'/owner/dashboard',click:'Открыть профиль',expect:/\/owner\/pet\//},
 {role:'owner',start:'/owner/dashboard',click:'Открыть лекарства',expect:/\/owner\/medications/},
 {role:'owner',start:'/owner/services',click:'Открыть карту',expect:/\/owner\/map/},
 {role:'vet',start:'/vet/dashboard',click:'Открыть поток приёма',expect:/\/vet\/appointments/},
 {role:'vet',start:'/vet/labs',click:'Открыть пациента',expect:/\/vet\/patient\//},
 {role:'clinic_admin',start:'/clinic/dashboard',click:'Ресепшн',expect:/\/clinic\/checkin/},
 {role:'clinic_admin',start:'/clinic/dashboard',click:'Расписание',expect:/\/clinic\/schedule/},
 {role:'network_admin',start:'/platform/dashboard',click:'Клиники сети',expect:/\/platform\/clinics/},
 {role:'network_admin',start:'/platform/dashboard',click:'Центр AI',expect:/\/platform\/ai/},
];
const browser=await chromium.launch({headless:true});
const results=[];
for(const check of checks){
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 const page=await context.newPage();
 const pageErrors=[];
 page.on('pageerror',e=>pageErrors.push(String(e)));
 await login(page,users[check.role]);
 await page.goto(`${BASE}${check.start}`,{waitUntil:'networkidle'});
 const locator=page.getByRole('link',{name:check.click}).first();
 if(!(await locator.count())){
  results.push({status:'missing',...check,pageErrors});
  await context.close();
  continue;
 }
 await locator.click();
 await page.waitForLoadState('networkidle');
 results.push({status:check.expect.test(page.url())?'ok':'wrong-target',...check,url:page.url(),pageErrors});
 await context.close();
}
await browser.close();
console.log(JSON.stringify(results,null,2));
