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
    if(u.includes('/tma/session')){
      // A cold gateway is the very condition that makes a payment return slow,
      // so "the session failed" and "the customer just paid" arrive together.
      if(cfg.sessionFails)return Promise.resolve(new Response('',{status:502}));
      return j({session_token:'m',expires_in:1800});}
    if(u.includes('/retail/packages'))return j({status:'success',count:1,currency:'RUB',data:PKG});
    if(u.includes('/me/orders/active')){
      window.__activeCalls++;
      const seq=cfg.sequence||[];
      const idx=Math.min(window.__activeCalls-1,seq.length-1);
      return j({items:seq[idx]||[]});
    }
    // The full history. An order that has succeeded, failed or been cancelled
    // is NOT in /active — this is the only place its real outcome is legible,
    // and the app is required to come here rather than guess from the eSIM list.
    if(u.includes('/me/orders')){window.__historyCalls=(window.__historyCalls||0)+1;
      return j({items:cfg.history||[],next_cursor:null});}
    // GET /tma/esims/:id — the detail the CTA must land on.
    if(/\/tma\/esims\/[^/?]+$/.test(u.split('?')[0])){
      const id=u.split('?')[0].split('/').pop();
      const hit=(cfg.esims||[]).find(x=>x.id===id);
      window.__detailOpened=id;
      return hit?j(hit):j({error:'NOT_FOUND'},404);}
    if(u.includes('/tma/esims'))return j({items:cfg.esims||[]});
    return j({items:[]});};
}

(async()=>{
const s=http.createServer((q,r)=>{const u=q.url.split('?')[0];const n=u==='/'?'/index.html':u;
const root=n.startsWith('/assets/')?path.join(APP,'..'):APP;
fs.readFile(path.join(root,n),(e,b)=>{if(e)return r.writeHead(404).end();r.writeHead(200,{'content-type':T[path.extname(n)]||'text/plain'});r.end(b);});});
await new Promise(r=>s.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${s.address().port}/index.html`;

// `display_status` — and ONLY the values lib/tmaProjection.js can emit:
// awaiting_payment · paid · provisioning · ready · failed · canceled · unknown.
// This fixture used to invent `purchasing_esim`/`completed` (the INTERNAL
// retail_orders.status names), which is why the suite was green while
// production showed «Заказ» with an empty note for every real fulfilment.
const ORDER=(st,extra={})=>({public_order_token:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaAB12cd',display_status:st,package_name:'Algeria 100MB 7Days',country_code:'DZ',amount_rub:100,...extra});
const OTHER=(st)=>({public_order_token:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbZZ99zz',display_status:st,package_name:'Best World 10 GB',country_code:'AL',amount_rub:5000});

for (const eng of ['webkit','chromium']) {
  const br=await pw[eng].launch();
  const scenarios=[
    {name:'return via startapp, order still paying',startParam:'o_AB12cd',
     sequence:[[ORDER('awaiting_payment')]],expectTitle:'Ждём оплату'},
    {name:'payment received -> preparing',startParam:'o_AB12cd',
     sequence:[[ORDER('paid')]],expectTitle:'Оплата получена'},
    {name:'issuing (backend says provisioning)',startParam:'o_AB12cd',
     sequence:[[ORDER('provisioning')]],expectTitle:'Готовим eSIM'},
    {name:'completed -> read from history, eSIM ready + CTA',startParam:'o_AB12cd',
     sequence:[[]],history:[ORDER('ready',{esim_id:'e1'})],
     esims:[{id:'e1',country_code:'DZ',package_name:'Algeria 100MB 7Days',status:'ready'}],
     expectTitle:'eSIM готова'},
    // The regression this whole rewrite exists for: an order that FAILED, for a
    // customer who already owns an unrelated eSIM. The old screen read the
    // empty active list as success and congratulated them.
    {name:'a FAILED order is never reported as success',startParam:'o_AB12cd',
     sequence:[[]],history:[ORDER('failed')],
     esims:[{id:'e9',country_code:'TR',package_name:'Turkey 3GB 15Days',status:'active'}],
     expectTitle:'Нужна помощь с заказом'},
    {name:'a CANCELED order says so',startParam:'o_AB12cd',
     sequence:[[]],history:[ORDER('canceled')],
     esims:[{id:'e9',country_code:'TR',package_name:'Turkey 3GB 15Days',status:'active'}],
     expectTitle:'Заказ отменён'},
    // Someone else's order must never be shown just because it is first.
    {name:'an unknown ref does not borrow another order',startParam:'o_QQ00qq',
     sequence:[[]],history:[OTHER('ready')],
     esims:[{id:'e9',country_code:'TR',package_name:'Turkey 3GB 15Days',status:'active'}],
     expectTitle:'Заказ не найден'},
    // Returning from a PAID order onto a session that will not come up. The
    // screen used to be skipped entirely — boot() returned before the return
    // branch — and the customer landed on a catalogue with no sign of the money
    // they had just spent. It must say something, and it must not guess.
    {name:'a payment return survives a dead session',startParam:'o_AB12cd',
     sessionFails:true,sequence:[[ORDER('paid')]],expectTitle:'Не удалось проверить оплату'},
    {name:'no startapp -> normal catalogue, S6 not shown',startParam:undefined,
     sequence:[[]],expectScreen:'screen-home'},
    {name:'forged paid=true in URL proves nothing',startParam:'o_AB12cd',
     sequence:[[ORDER('awaiting_payment')]],query:'?paid=true&success=1',expectTitle:'Ждём оплату'},
    // A regional pack files under one arbitrary member country (AL for «Весь
    // мир»). The title must name the destination that was sold.
    {name:'a regional order is not titled with a member country',startParam:'o_ZZ99zz',
     sequence:[[OTHER('paid')]],expectTitle:'Оплата получена',expectCard:'Весь мир'},
  ];
  console.log(`\n── ${eng} ──`);
  for (const sc of scenarios) {
    const ctx=await br.newContext({...pw.devices['iPhone 13']});
    await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    await ctx.addInitScript(mock,sc);
    const p=await ctx.newPage();
    await p.goto(base+(sc.query||''));
    // A failing session spends its whole budget first: 3 attempts with
    // [600,1500] backoff on each of two endpoints is a little over 4 s before
    // boot() can reach the return branch at all.
    await p.waitForTimeout(sc.sessionFails?6000:2200);
    const screen=(await p.$$eval('.screen[data-active]',n=>n.map(x=>x.id)))[0];
    if (sc.expectScreen) {
      ok(sc.name, screen===sc.expectScreen, screen);
    } else {
      const title=await p.$eval('#order-title',n=>n.innerText).catch(()=>'(no S6)');
      const cta=await p.$$eval('#order-body button',n=>n.map(b=>b.innerText.trim()));
      const bodyText=await p.$eval('#order-body',n=>n.innerText).catch(()=>'');
      ok(sc.name, screen==='screen-order'&&title===sc.expectTitle, `${screen} / "${title}"`);
      if (sc.expectCard) ok('  the card names the destination sold', bodyText.includes(sc.expectCard), sc.expectCard);
      if (sc.expectTitle==='eSIM готова') {
        ok('  CTA «Открыть eSIM» present', cta.some(t=>t.includes('Открыть eSIM')), cta.join('|'));
        // And it opens THE eSIM that was bought, not a list to search through.
        // The order carries esim_id; using it is the whole point of reading the
        // order instead of guessing from the eSIM list.
        await p.getByRole('button',{name:/Открыть eSIM/}).click();
        await p.waitForTimeout(900);
        const after=(await p.$$eval('.screen[data-active]',n=>n.map(x=>x.id)))[0];
        const opened=await p.evaluate(()=>window.__detailOpened||null);
        ok('  it opens that eSIM, not the list', after==='screen-esim'&&opened==='e1', `${after} / ${opened}`);
      }
      if (sc.expectTitle==='Не удалось проверить оплату')
        ok('  it offers a retry and a human', cta.some(t=>t.includes('Проверить'))&&cta.some(t=>t.includes('поддержку')), cta.join('|'));
      if (sc.expectTitle==='Нужна помощь с заказом'||sc.expectTitle==='Заказ не найден')
        ok('  a way to reach support exists', cta.some(t=>t.includes('поддержку')), cta.join('|'));
      // Whatever else it says, it must never claim a raw code or a wrong country.
      ok('  no raw code in the card', !/\b(AF-29|CA-4|GL-120|DZ|AL)\b/.test(bodyText), bodyText.slice(0,60));
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
