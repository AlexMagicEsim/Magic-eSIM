/**
 * S6 · Order status — the screen a real paid purchase proved missing.
 *
 * On 2026-08-18 a customer paid via СБП, the callback confirmed it, fulfilment
 * issued a provider eSIM — and the Mini App had nowhere to land them. Money had
 * gone and the app showed a catalogue.
 *
 * These pin the five states, the return path from Platega (§8.4 startapp), that
 * a URL can never assert payment, and that polling stops.
 *
 *   node test/mini-app/order.e2e.js
 */
const http=require('http'),fs=require('fs'),path=require('path');
const pw=require('playwright');
const APP=path.join(__dirname,'..','..','app');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
let bad=0; const ok=(l,c,d='')=>{if(!c)bad++;console.log(`   ${c?'ok  ':'FAIL'} ${l}${d?'  — '+d:''}`);};

function mock(cfg){
  window.__activeCalls=0;
  window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
    initDataUnsafe:{start_param:cfg.startParam||undefined},
    ready(){},expand(){},close(){},colorScheme:'light',themeParams:{},
    setBackgroundColor(){},setHeaderColor(){},onEvent(){},
    BackButton:{show(){},hide(){},onClick(){},offClick(){}},
    HapticFeedback:{impactOccurred(){},notificationOccurred(){}},openLink(){}}};
  const j=(b,s=200)=>Promise.resolve(new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json'}}));
  const PKG=[{package_id:'p1',name:'Algeria 100MB 7Days',data_gb:0.1,validity_days:7,country_code:'DZ',price:100,coverage_country_codes:['DZ'],coverage_flags:'🇩🇿'}];
  window.fetch=(u)=>{u=String(u);
    if(u.includes('catalog.json'))return j({schema_version:1,generated_at:'2026-08-18T07:08:16Z',package_count:1,packages:PKG});
    if(u.includes('/tma/session'))return j({session_token:'m',expires_in:1800});
    if(u.includes('/retail/packages'))return j({status:'success',count:1,currency:'RUB',data:PKG});
    if(u.includes('/me/orders/active')){
      window.__activeCalls++;
      const seq=cfg.sequence||[];
      const idx=Math.min(window.__activeCalls-1,seq.length-1);
      return j({items:seq[idx]||[]});
    }
    if(u.includes('/tma/esims'))return j({items:cfg.esims||[]});
    return j({items:[]});};
}

(async()=>{
const s=http.createServer((q,r)=>{const u=q.url.split('?')[0];const n=u==='/'?'/index.html':u;
const root=n.startsWith('/assets/')?path.join(APP,'..'):APP;
fs.readFile(path.join(root,n),(e,b)=>{if(e)return r.writeHead(404).end();r.writeHead(200,{'content-type':T[path.extname(n)]||'text/plain'});r.end(b);});});
await new Promise(r=>s.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${s.address().port}/index.html`;

const ORDER=(st)=>({public_order_token:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaAB12cd',display_status:st,status:st,package_name:'Algeria 100MB 7Days',amount_rub:100});

for (const eng of ['webkit','chromium']) {
  const br=await pw[eng].launch();
  const scenarios=[
    {name:'return via startapp, order still paying',startParam:'o_AB12cd',
     sequence:[[ORDER('awaiting_payment')]],expectTitle:'Ждём оплату'},
    {name:'payment received -> preparing',startParam:'o_AB12cd',
     sequence:[[ORDER('paid')]],expectTitle:'Оплата получена'},
    {name:'issuing',startParam:'o_AB12cd',
     sequence:[[ORDER('purchasing_esim')]],expectTitle:'Готовим eSIM'},
    {name:'completed -> eSIM ready + CTA',startParam:'o_AB12cd',
     sequence:[[]],esims:[{id:'e1',country:'Алжир',status:'ready'}],expectTitle:'eSIM готова'},
    {name:'no startapp -> normal catalogue, S6 not shown',startParam:undefined,
     sequence:[[]],expectScreen:'screen-home'},
    {name:'forged paid=true in URL proves nothing',startParam:'o_AB12cd',
     sequence:[[ORDER('awaiting_payment')]],query:'?paid=true&success=1',expectTitle:'Ждём оплату'},
    {name:'ref that matches nothing falls back to first active',startParam:'o_ZZZZZZ',
     sequence:[[ORDER('paid')]],expectTitle:'Оплата получена'},
  ];
  console.log(`\n── ${eng} ──`);
  for (const sc of scenarios) {
    const ctx=await br.newContext({...pw.devices['iPhone 13']});
    await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    await ctx.addInitScript(mock,sc);
    const p=await ctx.newPage();
    await p.goto(base+(sc.query||''));
    await p.waitForTimeout(2200);
    const screen=(await p.$$eval('.screen[data-active]',n=>n.map(x=>x.id)))[0];
    if (sc.expectScreen) {
      ok(sc.name, screen===sc.expectScreen, screen);
    } else {
      const title=await p.$eval('#order-title',n=>n.innerText).catch(()=>'(no S6)');
      const cta=await p.$$eval('#order-body button',n=>n.map(b=>b.innerText.trim()));
      ok(sc.name, screen==='screen-order'&&title===sc.expectTitle, `${screen} / "${title}"`);
      if (sc.expectTitle==='eSIM готова') ok('  CTA «Открыть eSIM» present', cta.some(t=>t.includes('Открыть eSIM')), cta.join('|'));
    }
    await ctx.close();
  }
  // bounded polling: it must stop, not run forever
  const ctx=await br.newContext({...pw.devices['iPhone 13']});
  await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.addInitScript(mock,{startParam:'o_AB12cd',sequence:[[ORDER('paid')]]});
  const p=await ctx.newPage(); await p.goto(base);
  await p.waitForTimeout(3000); const a=await p.evaluate(()=>window.__activeCalls);
  await p.waitForTimeout(4000); const b=await p.evaluate(()=>window.__activeCalls);
  ok('polling is bounded and backs off', b>a && b<12, `${a} -> ${b} calls`);
  await ctx.close();
  await br.close();
}
s.close();
console.log(bad?`\n${bad} FAILED`:'\nall S6 checks passed');
process.exit(bad?1:0);
})();
