/**
 * W4 · Top-up purchase — the flow, and the two things it must never say.
 *
 * Мои eSIM → eSIM → Пополнить → вариант → способ оплаты → условия → Оплатить →
 * Platega → возврат в Telegram → статус.
 *
 * What is pinned here is not layout. It is:
 *
 *   - a closed feature draws no pay button, and the SERVER decides that;
 *   - СБП is preselected and the terms box is not;
 *   - the pay button cannot be reached without an actual acceptance;
 *   - the request carries an opaque option id and no provider anything;
 *   - a return resumes the SAME intent instead of minting a second one;
 *   - an UNCERTAIN outcome reads «проверяем», never «не удалось» — a customer
 *     told a top-up failed while it may be on their eSIM buys a second one;
 *   - a failed one is visible as money owed rather than swallowed;
 *   - nothing technical is ever drawn.
 *
 * WebKit and Chromium, on an iPhone viewport with real touch. Nothing here
 * reaches a provider, Platega or a backend: the gateway is faked at the network
 * edge and openLink is recorded rather than followed.
 *
 *   node test/mini-app/topup.e2e.js
 */
const http=require('http'),fs=require('fs'),path=require('path');
const pw=require('playwright');
const APP=path.join(__dirname,'..','..','app');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
let bad=0; const ok=(l,c,d='')=>{if(!c)bad++;console.log(`   ${c?'ok  ':'FAIL'} ${l}${d?'  — '+d:''}`);};

function mock(cfg){
  window.__quotes=[]; window.__checkouts=0; window.__statusCalls=0; window.__opened=[];
  if(cfg.pendingTopup){ try{ sessionStorage.setItem('mesim.pending_topup',cfg.pendingTopup); }catch(e){} }
  window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
    initDataUnsafe:{},ready(){},expand(){},close(){},colorScheme:'light',themeParams:{},
    setBackgroundColor(){},setHeaderColor(){},onEvent(){},
    BackButton:{show(){},hide(){},onClick(){},offClick(){}},
    HapticFeedback:{impactOccurred(){},notificationOccurred(){}},
    // Recorded, never followed. Leaving for a real payment page is exactly what
    // this suite must not do.
    openLink(u){window.__opened.push(String(u));}}};
  const j=(b,s=200)=>Promise.resolve(new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json'}}));
  const PKG=[{package_id:'p1',name:'Algeria 100MB 7Days',data_gb:0.1,validity_days:7,country_code:'DZ',price:100,coverage_country_codes:['DZ'],coverage_flags:'🇩🇿'}];
  const ESIM={id:'e1',country_code:'DZ',package_name:'Algeria 100MB 7Days',status:'active',
    usage_state:'known',total_volume_bytes:1073741824,used_volume_bytes:107374182,remaining_volume_bytes:966367436};
  window.fetch=(u,opts)=>{u=String(u);const p0=u.split('?')[0];
    if(u.includes('catalog.json'))return j({schema_version:1,generated_at:'2026-08-19T00:00:00Z',package_count:1,packages:PKG});
    if(u.includes('/tma/session'))return j({session_token:'m',expires_in:1800});
    if(u.includes('/retail/packages'))return j({status:'success',count:1,currency:'RUB',data:PKG});
    if(u.includes('/me/orders/active'))return j({items:[]});
    if(u.includes('/me/orders'))return j({items:[],next_cursor:null});
    // POST /tma/esims/:id/topups/quote
    if(/\/tma\/esims\/[^/]+\/topups\/quote$/.test(p0)){
      window.__quotes.push(opts&&opts.body?JSON.parse(opts.body):null);
      if(cfg.quoteError)return j({error:cfg.quoteError,message:'нет'},409);
      return j({public_token:'tu_live_token',data_gb:1,validity_days:7,price_rub:200,
        currency:'RUB',payment_type:'sbp',expires_at:'2026-08-19T13:00:00Z'});}
    // POST /tma/topups/:token/checkout
    if(/\/tma\/topups\/[^/]+\/checkout$/.test(p0)){
      window.__checkouts++;
      return j({public_token:'tu_live_token',redirect_url:'https://platega.io/pay/xyz',
        payment_type:'sbp',amount_rub:200,replay:window.__checkouts>1});}
    // GET /tma/topups/:token/status
    if(/\/tma\/topups\/[^/]+\/status$/.test(p0)){
      window.__statusCalls++;
      const seq=cfg.statusSeq||[];
      return j(seq[Math.min(window.__statusCalls-1,seq.length-1)]||seq[0]);}
    // GET /tma/esims/:id/topups — discovery
    if(/\/tma\/esims\/[^/]+\/topups$/.test(p0))return j(cfg.topups||{topup_available:false,topup_options:[],purchase_enabled:false});
    if(/\/tma\/esims\/[^/]+$/.test(p0))return j(ESIM);
    if(u.includes('/tma/esims'))return j({items:[ESIM]});
    return j({items:[]});};
}

const OPTIONS={topup_available:true,reason:null,purchase_enabled:true,
  topup_options:[{option_id:'a1b2c3d4e5f6a1b2c3d4e5f6',data_gb:1,validity_days:7,price_rub:200},
                 {option_id:'b1b2c3d4e5f6a1b2c3d4e5f6',data_gb:3,validity_days:15,price_rub:500}]};
const CLOSED={...OPTIONS,purchase_enabled:false};

const ST=(status,extra={})=>({public_token:'tu_live_token',status,
  status_text:{awaiting_payment:'Ожидаем оплату',paid:'Оплата получена',in_progress:'Пополняем eSIM',
    completed:'Пополнение выполнено',verifying:'Проверяем состояние пополнения',
    needs_review:'Требуется дополнительная проверка',refund_pending:'Пополнение не выполнено. Вернём деньги'}[status],
  status_detail:'—',
  is_final:['completed','needs_review','refund_pending'].includes(status),
  data_gb:1,validity_days:7,price_rub:200,currency:'RUB',payment_type:'sbp',
  created_at:'2026-08-19T12:00:00Z',payment_url:null,...extra});

(async()=>{
const s=http.createServer((q,r)=>{const u=q.url.split('?')[0];const n=u==='/'?'/index.html':u;
const root=n.startsWith('/assets/')?path.join(APP,'..'):APP;
fs.readFile(path.join(root,n),(e,b)=>{if(e)return r.writeHead(404).end();r.writeHead(200,{'content-type':T[path.extname(n)]||'text/plain'});r.end(b);});});
await new Promise(r=>s.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${s.address().port}/index.html`;

const openCtx=async(br,cfg)=>{
  const ctx=await br.newContext({...pw.devices['iPhone 13']});
  await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.addInitScript(mock,cfg);
  const p=await ctx.newPage();
  await p.goto(base);
  await p.waitForTimeout(2200);
  return {ctx,p};
};

/** Мои eSIM → the one eSIM → Пополнить. */
const toTopups=async(p)=>{
  await p.tap('#nav-esims');
  await p.waitForTimeout(600);
  await p.locator('#esims-list button.card').first().click();
  await p.waitForTimeout(900);
  await p.getByRole('button',{name:/^Пополнить$/}).click();
  await p.waitForTimeout(500);
};

for (const eng of ['webkit','chromium']) {
  const br=await pw[eng].launch();
  console.log(`\n── ${eng} ──`);

  /* ---- 1. the server decides whether buying is open ---- */
  {
    const {ctx,p}=await openCtx(br,{topups:CLOSED});
    await toTopups(p);
    const box=await p.$eval('#esim-topup',n=>n.innerText);
    ok('closed: the options are shown', box.includes('1 ГБ')&&box.includes('3 ГБ'), box.slice(0,40));
    ok('closed: no pay CTA is drawn', !/Оплатить/.test(box), box.slice(0,80));
    // A div, not a button: there is nothing to tap, rather than a tap that
    // silently does nothing.
    const tappable=await p.$$eval('#esim-topup button.topup-opt',n=>n.length);
    ok('closed: an option is not tappable', tappable===0, String(tappable));
    await ctx.close();
  }

  /* ---- 2. open: choose an option, and the defaults ---- */
  {
    const {ctx,p}=await openCtx(br,{topups:OPTIONS});
    await toTopups(p);
    await p.locator('#esim-topup button.topup-opt').first().click();
    await p.waitForTimeout(400);

    const sbp=await p.$eval('.topup-method[data-method="sbp"]',n=>n.getAttribute('aria-pressed'));
    const card=await p.$eval('.topup-method[data-method="card"]',n=>n.getAttribute('aria-pressed'));
    ok('СБП is the default, card is an explicit choice', sbp==='true'&&card==='false', `${sbp}/${card}`);

    const checked=await p.$eval('#topup-terms',n=>n.checked);
    ok('the terms box is NOT pre-ticked', checked===false, String(checked));

    const disabled=await p.$eval('#esim-topup .btn--wide',n=>n.disabled);
    ok('«Оплатить» is unreachable without consent', disabled===true, String(disabled));

    // Choosing the card is a real switch, and it is exclusive.
    await p.click('.topup-method[data-method="card"]');
    await p.waitForTimeout(200);
    const after=await p.$$eval('.topup-method',n=>n.map(b=>b.getAttribute('aria-pressed')).join(','));
    ok('choosing the card deselects СБП', after==='false,true', after);
    await ctx.close();
  }

  /* ---- 3. pay: what travels, and where it lands ---- */
  {
    const {ctx,p}=await openCtx(br,{topups:OPTIONS,statusSeq:[ST('awaiting_payment')]});
    await toTopups(p);
    await p.locator('#esim-topup button.topup-opt').first().click();
    await p.waitForTimeout(300);
    await p.click('#topup-terms');
    await p.waitForTimeout(200);
    await p.getByRole('button',{name:/Оплатить/}).click();
    await p.waitForTimeout(1500);

    const quotes=await p.evaluate(()=>window.__quotes);
    ok('exactly one quote was sent', quotes.length===1, String(quotes.length));
    ok('it carries only the three allowed fields',
      quotes[0]&&Object.keys(quotes[0]).sort().join(',')==='option_id,payment_type,terms_accepted',
      JSON.stringify(quotes[0]));
    ok('the option id is opaque — no package, price, ICCID or provider',
      !/esimaccess|mobimatter|iccid|price|package/i.test(JSON.stringify(quotes[0])), JSON.stringify(quotes[0]));
    ok('consent travels as a real true', quotes[0].terms_accepted===true, String(quotes[0].terms_accepted));

    const checkouts=await p.evaluate(()=>window.__checkouts);
    ok('exactly one checkout was created', checkouts===1, String(checkouts));

    const opened=await p.evaluate(()=>window.__opened);
    ok('the customer is sent to Platega, and only to Platega',
      opened.length===1&&opened[0]==='https://platega.io/pay/xyz', opened.join('|'));

    const screen=(await p.$$eval('.screen[data-active]',n=>n.map(x=>x.id)))[0];
    const title=await p.$eval('#topup-title',n=>n.innerText);
    ok('it lands on the status screen', screen==='screen-topup', screen);
    ok('«Ожидаем оплату»', title==='Ожидаем оплату', title);
    await ctx.close();
  }

  /* ---- 4. the return resumes the SAME intent ---- */
  {
    // A relaunch with a top-up remembered from before the payment browser.
    const {ctx,p}=await openCtx(br,{topups:OPTIONS,pendingTopup:'tu_live_token',
      statusSeq:[ST('paid')]});
    const screen=(await p.$$eval('.screen[data-active]',n=>n.map(x=>x.id)))[0];
    const title=await p.$eval('#topup-title',n=>n.innerText);
    ok('a return opens the status screen, not the catalogue', screen==='screen-topup', screen);
    ok('«Оплата получена»', title==='Оплата получена', title);

    const quotes=await p.evaluate(()=>window.__quotes.length);
    const checkouts=await p.evaluate(()=>window.__checkouts);
    ok('NO second intent is minted on return', quotes===0, String(quotes));
    ok('NO second payment is created on return', checkouts===0, String(checkouts));
    await ctx.close();
  }

  /* ---- 5. the two states that are easy to get wrong ---- */
  {
    const {ctx,p}=await openCtx(br,{topups:OPTIONS,pendingTopup:'tu_live_token',
      statusSeq:[ST('verifying')]});
    const title=await p.$eval('#topup-title',n=>n.innerText);
    const body=await p.$eval('#topup-body',n=>n.innerText);
    ok('an uncertain outcome says «проверяем»', title==='Проверяем состояние пополнения', title);
    ok('and NEVER «не удалось»', !/не удалось/i.test(title+body), (title+body).slice(0,80));
    ok('it is not treated as final: a refresh is offered', /Обновить/.test(body), body.slice(0,80));
    await ctx.close();
  }
  {
    const {ctx,p}=await openCtx(br,{topups:OPTIONS,pendingTopup:'tu_live_token',
      statusSeq:[ST('refund_pending')]});
    const title=await p.$eval('#topup-title',n=>n.innerText);
    const body=await p.$eval('#topup-body',n=>n.innerText);
    ok('a failed top-up is visible as money owed', /Вернём деньги/.test(title), title);
    ok('and offers a human', /поддержку/i.test(body), body.slice(0,80));
    await ctx.close();
  }

  /* ---- 6. the happy end, and the one that needs a person ---- */
  for (const [status,expect,cta] of [
    ['paid','Оплата получена',null],
    ['in_progress','Пополняем eSIM',null],
    ['completed','Пополнение выполнено','К моим eSIM'],
    ['needs_review','Требуется дополнительная проверка','поддержку'],
  ]) {
    const {ctx,p}=await openCtx(br,{topups:OPTIONS,pendingTopup:'tu_live_token',statusSeq:[ST(status)]});
    const title=await p.$eval('#topup-title',n=>n.innerText);
    const body=await p.$eval('#topup-body',n=>n.innerText);
    ok(`«${expect}»`, title===expect, title);
    if (cta) ok(`  it offers «${cta}»`, new RegExp(cta,'i').test(body), body.slice(0,80));
    // Whatever it says, it never leaks the machinery.
    ok('  nothing technical is drawn',
      !/esimaccess|mobimatter|iccid|packageCode|transactionId|provider|8997|TOPUP_/i.test(title+body),
      (title+body).slice(0,90));
    await ctx.close();
  }

  /* ---- 7. a URL still proves nothing ---- */
  {
    const ctx=await br.newContext({...pw.devices['iPhone 13']});
    await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    await ctx.addInitScript(mock,{topups:OPTIONS,pendingTopup:'tu_live_token',statusSeq:[ST('awaiting_payment')]});
    const p=await ctx.newPage();
    // Everything a forged return could carry. The state comes from the server.
    await p.goto(base+'?paid=true&success=1&topup=completed&status=completed');
    await p.waitForTimeout(2200);
    const title=await p.$eval('#topup-title',n=>n.innerText);
    ok('a forged return URL cannot claim a top-up succeeded', title==='Ожидаем оплату', title);
    await ctx.close();
  }

  /* ---- 8. an in-flight top-up is surfaced, not a second offer ---- */
  {
    const {ctx,p}=await openCtx(br,{
      topups:{topup_available:false,reason:'TOPUP_IN_PROGRESS',in_progress:true,topup_options:[],purchase_enabled:true},
      statusSeq:[ST('in_progress')]});
    await p.tap('#nav-esims');
    await p.waitForTimeout(600);
    await p.locator('#esims-list button.card').first().click();
    await p.waitForTimeout(900);
    const box=await p.$eval('#esim-topup',n=>n.innerText);
    ok('an eSIM with one already running offers no second', !/^Пополнить$/m.test(box), box.slice(0,80));
    ok('and says why', /уже выполняется/.test(box), box.slice(0,80));
    await ctx.close();
  }

  await br.close();
}

s.close();
console.log(bad?`\n${bad} FAILED`:'\nall passed');
process.exit(bad?1:0);
})();
