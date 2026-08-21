/**
 * The notification switches, and the door that leads to them.
 *
 * The switches themselves shipped working. What did not work was FINDING them:
 * their only entry was a button at the foot of the Помощь tab, below six FAQ
 * accordions, so a customer looking for notification settings concluded the app
 * had none. That is the defect these tests pin — a control nobody can reach is
 * not a shipped control.
 *
 * The other half is that the switches must govern REAL sends. A switch that
 * flips locally and never reaches the server would be the same lie the old
 * placeholder toggles would have been, so the request body is asserted, not
 * just the checkbox state.
 *
 *   node test/mini-app/notifications.e2e.js
 */
const http=require('http'),fs=require('fs'),path=require('path');
const pw=require('playwright');
const APP=path.join(__dirname,'..','..','app');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
let bad=0; const ok=(l,c,d='')=>{if(!c)bad++;console.log(`   ${c?'ok  ':'FAIL'} ${l}${d?'  — '+d:''}`);};

function mock(cfg){
  window.__calls=[]; window.__prefCalls=[];
  window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',initDataUnsafe:{},
    ready(){},expand(){},close(){},colorScheme:cfg.scheme||'light',platform:'ios',themeParams:cfg.theme||{},
    setBackgroundColor(){},setHeaderColor(){},onEvent(){},
    BackButton:{show(){},hide(){},onClick(){},offClick(){}},
    HapticFeedback:{impactOccurred(){},notificationOccurred(){}},openLink(u){window.__opened=u;}}};

  // The fake server's state lives in sessionStorage, NOT on `window`:
  // addInitScript re-runs on every navigation, so a window-scoped store resets
  // on reload and would make the app look like it forgot when it was the mock
  // that forgot. This is the bug that made the first run of this test red.
  const KEY='__prefs_store';
  if(cfg.resetStore)sessionStorage.removeItem(KEY);
  const store={get prefs(){try{return JSON.parse(sessionStorage.getItem(KEY))||{low_data:true,expiry:true};}
    catch{return {low_data:true,expiry:true};}},
    set prefs(v){sessionStorage.setItem(KEY,JSON.stringify(v));}};
  if(!sessionStorage.getItem(KEY))store.prefs=cfg.prefs===undefined?{low_data:true,expiry:true}:cfg.prefs;
  const j=(b,s=200)=>Promise.resolve(new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json'}}));
  window.fetch=(u,o)=>{u=String(u);const p=u.split('?')[0];
    const body=o&&o.body?JSON.parse(o.body):null;
    window.__calls.push({url:p,method:(o&&o.method)||'GET'});
    if(u.includes('catalog.json'))return j({schema_version:1,generated_at:'x',package_count:0,packages:[]});
    if(u.includes('/tma/session'))return j({session_token:'m',expires_in:1800});
    if(u.includes('/retail/packages'))return j({status:'success',count:0,currency:'RUB',data:[]});
    if(/\/notifications\/prefs$/.test(p)){
      window.__prefCalls.push(body);
      if(cfg.prefsFails)return j({error:'INTERNAL_ERROR',message:'нет'},500);
      const next={...store.prefs};
      if(body&&typeof body.low_data==='boolean')next.low_data=body.low_data;
      if(body&&typeof body.expiry==='boolean')next.expiry=body.expiry;
      store.prefs=next;
      return j(next);
    }
    if(/\/tma\/me$/.test(p)){
      if(cfg.meFails)return j({error:'INTERNAL_ERROR',message:'нет'},500);
      if(cfg.meDelay)return new Promise(res=>setTimeout(()=>res(new Response(
        JSON.stringify({customer:{created_at:'2026-08-18T00:00:00.000Z'},emails:[],counts:{orders:0,esims:0},
          notifications:{...store.prefs}}),{status:200,headers:{'content-type':'application/json'}})),cfg.meDelay));
      const me={customer:{created_at:'2026-08-18T00:00:00.000Z'},
        emails:[{id:'11111111-2222-4333-8444-555555555555',masked:'b***r@example.com',verified_at:'2026-08-19T08:54:02.000Z'}],
        counts:{orders:2,esims:2}};
      // cfg.omitPrefs models a backend that predates the columns.
      if(!cfg.omitPrefs)me.notifications={...store.prefs};
      return j(me);
    }
    if(/\/tma\/esims/.test(p))return j({esims:[]});
    if(/\/orders/.test(p))return j({orders:[]});
    return j({});
  };
}

const rows=(page)=>page.evaluate(()=>[...document.querySelectorAll('#screen-settings .switch')].map(w=>{
  const i=w.querySelector('input[type=checkbox]');
  const t=w.querySelector('.switch__t,.row,div');
  return {checked:i.checked,disabled:i.disabled,text:w.textContent.replace(/\s+/g,' ').trim()};
}));

async function openSettingsViaGear(page){
  await page.evaluate(()=>document.querySelector('#open-settings').click());
  await page.waitForTimeout(700);
}

(async()=>{
  const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);
    const n=u==='/'||u==='/app/'?'/index.html':u.replace(/^\/app/,'');
    fs.readFile(path.join(APP,n),(e,b)=>{if(e){r.writeHead(404).end();return;}
      r.writeHead(200,{'content-type':T[path.extname(n)]||'text/plain'});r.end(b);});});
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+srv.address().port+'/';
  const br=await pw.webkit.launch();

  /* ---- 1. the door ------------------------------------------------- */
  console.log('\n[the entry point]');
  {
    const ctx=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
    // telegram-web-app.js would otherwise load for real and overwrite the mock's
    // window.Telegram — including colorScheme, which is how the first dark run
    // reported data-tg-scheme=light on a page that was visibly dark.
    await ctx.route('https://telegram.org/**',(r)=>r.fulfill({status:200,body:''}));
    const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
    await p.addInitScript(mock,{resetStore:true}); await p.goto(base); await p.waitForTimeout(1200);
    const g=await p.evaluate(()=>{const b=document.querySelector('#open-settings');
      if(!b)return null;const r=b.getBoundingClientRect();
      const h1=document.querySelector('.hero h1').getBoundingClientRect();
      return {w:Math.round(r.width),h:Math.round(r.height),top:Math.round(r.top),right:Math.round(r.right),
        vw:document.documentElement.clientWidth, label:b.getAttribute('aria-label'),
        inFold:r.top>=0&&r.bottom<=innerHeight, overlapsTitle:r.left<h1.right&&r.top<h1.bottom&&r.bottom>h1.top};});
    ok('the gear exists on the home screen',!!g);
    ok('it is visible without scrolling',g&&g.inFold,g&&`top ${g.top}`);
    ok('it clears the 44px tap floor',g&&g.w>=44&&g.h>=44,g&&`${g.w}x${g.h}`);
    ok('it is inside the viewport',g&&g.right<=g.vw,g&&`right ${g.right}/${g.vw}`);
    ok('it does not sit on top of the title',g&&!g.overlapsTitle);
    ok('it names itself for a screen reader',g&&g.label==='Настройки',g&&g.label);
    await openSettingsViaGear(p);
    const on=await p.evaluate(()=>document.querySelector('#screen-settings').classList.contains('screen--on')
      ||!document.querySelector('#screen-settings').hidden);
    ok('tapping it opens Настройки',on);
    // the OLD door must still work — this is a second entry, not a replacement
    await p.evaluate(()=>{const b=[...document.querySelectorAll('button,a')].filter(n=>n.textContent.trim()==='Помощь'&&n.getBoundingClientRect().width>0)[0];if(b)b.click();});
    await p.waitForTimeout(500);
    const still=await p.evaluate(()=>[...document.querySelectorAll('#screen-help button')].some(n=>n.textContent.trim()==='Настройки'));
    ok('the entry at the foot of Помощь still exists',still);
    ok('no page errors',!errs.length,errs.join('|'));
    await p.screenshot({path:'/private/tmp/claude-501/-Users-xxx-Desktop-eSim/292faf93-883b-4959-b678-8b7cdaf41e6e/scratchpad/gear-home.png'});
    await ctx.close();
  }

  /* ---- 2. the switches --------------------------------------------- */
  console.log('\n[the switches]');
  {
    const ctx=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
    // telegram-web-app.js would otherwise load for real and overwrite the mock's
    // window.Telegram — including colorScheme, which is how the first dark run
    // reported data-tg-scheme=light on a page that was visibly dark.
    await ctx.route('https://telegram.org/**',(r)=>r.fulfill({status:200,body:''}));
    const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
    await p.addInitScript(mock,{resetStore:true}); await p.goto(base); await p.waitForTimeout(1200);
    await openSettingsViaGear(p);
    const r=await rows(p);
    ok('there are exactly two switches',r.length===2,String(r.length));
    ok('«Интернет заканчивается» is one of them',/Интернет заканчивается/.test(r[0]&&r[0].text));
    ok('with the sublabel «При остатке 20% и 10%»',/При остатке 20% и 10%/.test(r[0]&&r[0].text));
    ok('«Срок действия истекает» is the other',/Срок действия истекает/.test(r[1]&&r[1].text));
    ok('with the sublabel «За 3 дня и за сутки»',/За 3 дня и за сутки/.test(r[1]&&r[1].text));
    ok('both are real checkboxes, not styled divs',r.every(x=>typeof x.checked==='boolean'));
    ok('no page errors',!errs.length,errs.join('|'));
    const noOverflow=await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1);
    ok('the settings screen does not scroll sideways at 390px',noOverflow);
    await p.screenshot({path:'/private/tmp/claude-501/-Users-xxx-Desktop-eSim/292faf93-883b-4959-b678-8b7cdaf41e6e/scratchpad/gear-settings-light.png'});
    await ctx.close();
  }

  /* ---- 3. defaults -------------------------------------------------- */
  console.log('\n[defaults]');
  {
    const ctx=await br.newContext({viewport:{width:390,height:844}});
    // telegram-web-app.js would otherwise load for real and overwrite the mock's
    // window.Telegram — including colorScheme, which is how the first dark run
    // reported data-tg-scheme=light on a page that was visibly dark.
    await ctx.route('https://telegram.org/**',(r)=>r.fulfill({status:200,body:''}));
    const p=await ctx.newPage();
    await p.addInitScript(mock,{omitPrefs:true,resetStore:true}); await p.goto(base); await p.waitForTimeout(1200);
    await openSettingsViaGear(p);
    const r=await rows(p);
    ok('a backend that sends no prefs still draws both switches',r.length===2);
    ok('and both default to ON — silence must be opted into, not out of',r.every(x=>x.checked));
    await ctx.close();
  }

  /* ---- 4. what actually reaches the server -------------------------- */
  console.log('\n[the request]');
  {
    const ctx=await br.newContext({viewport:{width:390,height:844}});
    // telegram-web-app.js would otherwise load for real and overwrite the mock's
    // window.Telegram — including colorScheme, which is how the first dark run
    // reported data-tg-scheme=light on a page that was visibly dark.
    await ctx.route('https://telegram.org/**',(r)=>r.fulfill({status:200,body:''}));
    const p=await ctx.newPage();
    await p.addInitScript(mock,{resetStore:true}); await p.goto(base); await p.waitForTimeout(1200);
    await openSettingsViaGear(p);
    await p.evaluate(()=>document.querySelectorAll('#screen-settings input[type=checkbox]')[0].click());
    await p.waitForTimeout(700);
    const calls=await p.evaluate(()=>window.__prefCalls);
    ok('turning one off sends exactly one request',calls.length===1,JSON.stringify(calls));
    ok('it carries low_data:false',calls[0]&&calls[0].low_data===false,JSON.stringify(calls[0]));
    ok('and does NOT resend the switch nobody touched',calls[0]&&!('expiry' in calls[0]),JSON.stringify(calls[0]));
    const url=await p.evaluate(()=>window.__calls.filter(c=>/notifications\/prefs$/.test(c.url)).pop());
    ok('to the existing prefs endpoint',url&&/\/api\/v1\/tma\/notifications\/prefs$/.test(url.url),url&&url.url);
    ok('by POST',url&&url.method==='POST',url&&url.method);
    await ctx.close();
  }

  /* ---- 5. persistence across a restart ------------------------------ */
  console.log('\n[persistence]');
  {
    const ctx=await br.newContext({viewport:{width:390,height:844}});
    // telegram-web-app.js would otherwise load for real and overwrite the mock's
    // window.Telegram — including colorScheme, which is how the first dark run
    // reported data-tg-scheme=light on a page that was visibly dark.
    await ctx.route('https://telegram.org/**',(r)=>r.fulfill({status:200,body:''}));
    const p=await ctx.newPage();
    // NOT resetStore: the reload below must find the fake server's state intact.
    await p.addInitScript(mock,{}); await p.goto(base); await p.waitForTimeout(1200);
    await openSettingsViaGear(p);
    await p.evaluate(()=>document.querySelectorAll('#screen-settings input[type=checkbox]')[1].click());
    await p.waitForTimeout(700);
    const before=await rows(p);
    ok('expiry reads OFF after the tap',before[1]&&before[1].checked===false);
    // A real relaunch: new document, fresh state, same server.
    await p.reload({waitUntil:'load'}); await p.waitForTimeout(1400);
    await openSettingsViaGear(p);
    const after=await rows(p);
    ok('after a full Mini App restart it is still OFF',after[1]&&after[1].checked===false,
      JSON.stringify(after.map(x=>x.checked)));
    ok('and the untouched switch is still ON',after[0]&&after[0].checked===true);
    await ctx.close();
  }

  /* ---- 6. loading and failure --------------------------------------- */
  console.log('\n[loading and failure]');
  {
    const ctx=await br.newContext({viewport:{width:390,height:844}});
    // telegram-web-app.js would otherwise load for real and overwrite the mock's
    // window.Telegram — including colorScheme, which is how the first dark run
    // reported data-tg-scheme=light on a page that was visibly dark.
    await ctx.route('https://telegram.org/**',(r)=>r.fulfill({status:200,body:''}));
    const p=await ctx.newPage();
    // /me is held for 1.2s. Without a delay the mock resolves in a microtask and
    // the skeleton is gone before it can be observed — which says nothing about
    // whether it was ever drawn.
    await p.addInitScript(mock,{resetStore:true,meDelay:1200}); await p.goto(base); await p.waitForTimeout(1200);
    await p.evaluate(()=>document.querySelector('#open-settings').click());
    await p.waitForTimeout(250);
    const skel=await p.evaluate(()=>!!document.querySelector('#settings-body .skel'));
    ok('a skeleton is shown while prefs load',skel);
    await p.waitForTimeout(1500);
    const done=await p.evaluate(()=>!document.querySelector('#settings-body .skel')
      &&document.querySelectorAll('#screen-settings .switch').length===2);
    ok('and is replaced by the switches once they arrive',done);
    await ctx.close();
  }
  {
    const ctx=await br.newContext({viewport:{width:390,height:844}});
    // telegram-web-app.js would otherwise load for real and overwrite the mock's
    // window.Telegram — including colorScheme, which is how the first dark run
    // reported data-tg-scheme=light on a page that was visibly dark.
    await ctx.route('https://telegram.org/**',(r)=>r.fulfill({status:200,body:''}));
    const p=await ctx.newPage();
    await p.addInitScript(mock,{meFails:true,resetStore:true}); await p.goto(base); await p.waitForTimeout(1200);
    await openSettingsViaGear(p);
    const t=await p.evaluate(()=>document.querySelector('#settings-body').textContent);
    ok('a failed load says so instead of showing empty switches',/Не удалось загрузить настройки/.test(t),t.slice(0,80));
    ok('and draws no switches it cannot vouch for',(await rows(p)).length===0);
    await ctx.close();
  }
  {
    const ctx=await br.newContext({viewport:{width:390,height:844}});
    // telegram-web-app.js would otherwise load for real and overwrite the mock's
    // window.Telegram — including colorScheme, which is how the first dark run
    // reported data-tg-scheme=light on a page that was visibly dark.
    await ctx.route('https://telegram.org/**',(r)=>r.fulfill({status:200,body:''}));
    const p=await ctx.newPage();
    await p.addInitScript(mock,{prefsFails:true,resetStore:true}); await p.goto(base); await p.waitForTimeout(1200);
    await openSettingsViaGear(p);
    const was=(await rows(p))[0].checked;
    await p.evaluate(()=>document.querySelectorAll('#screen-settings input[type=checkbox]')[0].click());
    await p.waitForTimeout(900);
    const now=(await rows(p))[0].checked;
    ok('a rejected change snaps back rather than lying about what the server holds',
      now===was,`was ${was}, now ${now}`);
    await ctx.close();
  }

  /* ---- 7. dark ------------------------------------------------------ */
  console.log('\n[dark]');
  {
    const ctx=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
    // telegram-web-app.js would otherwise load for real and overwrite the mock's
    // window.Telegram — including colorScheme, which is how the first dark run
    // reported data-tg-scheme=light on a page that was visibly dark.
    await ctx.route('https://telegram.org/**',(r)=>r.fulfill({status:200,body:''}));
    const p=await ctx.newPage();
    const DARK={bg_color:'#17212b',secondary_bg_color:'#0e1621',text_color:'#ffffff',
      hint_color:'#7d8b99',link_color:'#6ab3f3',button_color:'#5288c1',button_text_color:'#ffffff'};
    // The app takes its palette from the --tg-theme-* custom properties that
    // telegram-web-app.js sets through the CSSOM, NOT from tg.themeParams.
    // Setting only themeParams renders LIGHT — which is what the first version
    // of this test did, so its dark assertions passed without a dark screen.
    await ctx.addInitScript((tp)=>{
      const apply=()=>{const root=document.documentElement;if(!root)return false;
        for(const [k,v] of Object.entries(tp))root.style.setProperty(`--tg-theme-${k.replace(/_/g,'-')}`,v);
        return true;};
      if(!apply())document.addEventListener('DOMContentLoaded',apply);
    },DARK);
    await p.addInitScript(mock,{resetStore:true,scheme:'dark',theme:DARK});
    await p.goto(base); await p.waitForTimeout(1400);
    const lum=(c)=>{const m=/rgba?\((\d+), ?(\d+), ?(\d+)/.exec(c);
      return m?(0.2126*+m[1]+0.7152*+m[2]+0.0722*+m[3])/255:null;};
    const scheme=await p.evaluate(()=>document.documentElement.getAttribute('data-tg-scheme'));
    ok('the document is actually in dark mode',scheme==='dark',String(scheme));
    const dark=await p.evaluate(()=>({body:getComputedStyle(document.body).backgroundColor,
      gear:getComputedStyle(document.querySelector('#open-settings')).color}));
    ok('the page background is dark, not the light theme in disguise',lum(dark.body)<0.35,
      `${dark.body} lum ${lum(dark.body)&&lum(dark.body).toFixed(2)}`);
    await openSettingsViaGear(p);
    const r=await rows(p);
    ok('both switches render in dark',r.length===2);
    const contrast=await p.evaluate(()=>{
      const w=document.querySelector('#screen-settings .switch');
      const card=w.closest('.card');
      return {card:getComputedStyle(card).backgroundColor,
        label:getComputedStyle(w.querySelector('*')).color};});
    ok('the settings card is a dark surface',lum(contrast.card)<0.4,contrast.card);
    ok('and its label is light text on it',lum(contrast.label)>lum(contrast.card),
      JSON.stringify(contrast));
    await p.screenshot({path:'/private/tmp/claude-501/-Users-xxx-Desktop-eSim/292faf93-883b-4959-b678-8b7cdaf41e6e/scratchpad/gear-settings-dark.png'});
    await ctx.close();
  }

  await br.close(); srv.close();
  console.log(bad?`\n${bad} FAILED`:'\nall notification-settings checks passed');
  process.exit(bad?1:0);
})();
