/**
 * Account settings.
 *
 * The screen exists to close one real gap: `POST /tma/identity/email/revoke` has
 * been implemented on the backend and open at the gateway since S13 shipped,
 * with no interface anywhere — a customer who connected a mailbox could not
 * disconnect it.
 *
 * It deliberately does NOT contain a language picker or a notifications toggle,
 * and these tests pin that. The app has no localisation at all (every string is
 * a Russian literal; the only `locale` in the codebase is a sort comparator),
 * and every message the client bot sends is a reply — there is no proactive
 * push to a customer anywhere in this system. A control over either would be a
 * control that lies, which is the same rule that keeps a greyed-out top-up
 * button off an eSIM that has none.
 *
 *   node test/mini-app/settings.e2e.js
 */
const http=require('http'),fs=require('fs'),path=require('path');
const pw=require('playwright');
const APP=path.join(__dirname,'..','..','app');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
let bad=0; const ok=(l,c,d='')=>{if(!c)bad++;console.log(`   ${c?'ok  ':'FAIL'} ${l}${d?'  — '+d:''}`);};

const RAW='buyer@example.com';

function mock(cfg){
  window.__calls=[];
  window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',initDataUnsafe:{},
    ready(){},expand(){},close(){},colorScheme:cfg.scheme||'light',platform:'ios',themeParams:cfg.theme||{},
    setBackgroundColor(){},setHeaderColor(){},onEvent(){},
    BackButton:{show(){},hide(){},onClick(){},offClick(){}},
    HapticFeedback:{impactOccurred(){},notificationOccurred(){}},openLink(u){window.__opened=u;}}};

  window.__prefCalls=[];
  const store={prefs:cfg.prefs||{low_data:true,expiry:true},emails:cfg.emails===undefined
    ? [{id:'11111111-2222-4333-8444-555555555555',masked:'b***r@example.com',verified_at:'2026-08-19T08:54:02.000Z'}]
    : cfg.emails};

  const j=(b,s=200)=>Promise.resolve(new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json'}}));
  window.fetch=(u,o)=>{u=String(u);const p=u.split('?')[0];
    const body=o&&o.body?JSON.parse(o.body):null;
    window.__calls.push({url:u,method:(o&&o.method)||'GET',body});
    if(u.includes('catalog.json'))return j({schema_version:1,generated_at:'x',package_count:0,packages:[]});
    if(u.includes('/tma/session'))return j({session_token:'m',expires_in:1800});
    if(u.includes('/retail/packages'))return j({status:'success',count:0,currency:'RUB',data:[]});
    if(/\/identity\/email\/revoke$/.test(p)){
      if(cfg.revokeFails)return j({error:'INTERNAL_ERROR',message:'нет'},500);
      store.emails=store.emails.filter((e)=>e.id!==(body&&body.identity_id));
      return j({ok:true,revoked:true});
    }
    if(/\/notifications\/prefs$/.test(p)){
      if(cfg.prefsFails)return j({error:'INTERNAL_ERROR',message:'нет'},500);
      // Only the field that was sent changes — exactly what the server does.
      if(body&&typeof body.low_data==='boolean')store.prefs.low_data=body.low_data;
      if(body&&typeof body.expiry==='boolean')store.prefs.expiry=body.expiry;
      window.__prefCalls.push(body);
      return j({...store.prefs});
    }
    if(/\/tma\/me$/.test(p))return j({customer:{created_at:'2026-08-18T00:00:00.000Z'},
      emails:store.emails,counts:{orders:3,active_orders:0,esims:1},
      notifications:{...store.prefs}});
    if(u.includes('/tma/esims'))return j({items:[]});
    if(u.includes('/me/orders'))return j({items:[]});
    return j({items:[]});};
}

(async()=>{
const s=http.createServer((q,r)=>{const u=q.url.split('?')[0];const n=u==='/'?'/index.html':u;
const root=n.startsWith('/assets/')?path.join(APP,'..'):APP;
fs.readFile(path.join(root,n),(e,b)=>{if(e)return r.writeHead(404).end();r.writeHead(200,{'content-type':T[path.extname(n)]||'text/plain'});r.end(b);});});
await new Promise(r=>s.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${s.address().port}/index.html`;

const openSettings=async(p)=>{
  await p.tap('#nav-help'); await p.waitForTimeout(500);
  await p.getByRole('button',{name:'Настройки',exact:true}).click();
  await p.waitForTimeout(700);
};

for (const eng of ['webkit','chromium']) {
  for (const scheme of ['light','dark']) {
    const br=await pw[eng].launch();
    console.log(`\n── ${eng} · ${scheme} · 390px ──`);
    const ctxFor=async(cfg)=>{
      const ctx=await br.newContext({...pw.devices['iPhone 13'],colorScheme:scheme});
      await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
      await ctx.addInitScript(mock,{scheme,...cfg});
      return ctx;
    };

    // ---- reachable, and correct -------------------------------------
    {
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);

      await p.tap('#nav-help'); await p.waitForTimeout(500);
      ok('settings is reachable from «Помощь»',
        (await p.$$eval('#screen-help button',ns=>ns.map(n=>n.innerText.trim()))).includes('Настройки'));
      ok('the tab bar still has exactly four tabs', (await p.$$('.tabbar .tab')).length===4);

      await p.getByRole('button',{name:'Настройки',exact:true}).click(); await p.waitForTimeout(700);
      const screen=(await p.$$eval('.screen[data-active]',n=>n.map(x=>x.id)))[0];
      ok('and it opens its own screen', screen==='screen-settings', screen);

      const body=await p.$eval('#screen-settings',n=>n.innerText);
      ok('the proven address is shown MASKED', /b\*+r@example\.com/.test(body), body.split('\n').slice(0,6).join(' / '));
      ok('the raw address is nowhere on the page', !body.includes(RAW));
      ok('and it says when it was proven', /подтверждён/i.test(body));
      ok('with an explanation of what the address does', /автоматически/i.test(body));

      // NO language picker, still. The app has no second language: a picker
      // with one option that changes nothing is a control that lies.
      ok('NO language picker — the app has no second language',
        !/язык|language/i.test(body), (body.match(/язык[^\n]*/i)||[])[0]||'');

      // The notification switches, on the other hand, are REAL now — there is a
      // delivery engine behind them. When this screen first shipped they were
      // deliberately absent, because there was not.
      ok('the two notification switches exist',
        (await p.$$('#screen-settings input[type=checkbox]')).length===2);
      ok('and each says what it governs',
        /Интернет заканчивается/.test(body)&&/20% и 10%/.test(body)
        &&/Срок действия истекает/.test(body)&&/За 3 дня и за сутки/.test(body));
      ok('it still says where things arrive',
        /на почту, указанную при покупке/i.test(body)&&/в этот чат/i.test(body));
      ok('and that there is no marketing to switch off',
        /Рекламных рассылок мы не отправляем/i.test(body));

      ok('account facts come from the server, not invented',
        /Покупок/.test(body)&&/3/.test(body)&&/eSIM/.test(body));

      const of=await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
      ok('no horizontal overflow', !of);
      await p.screenshot({path:`/private/tmp/claude-501/-Users-xxx-Desktop-eSim/292faf93-883b-4959-b678-8b7cdaf41e6e/scratchpad/home/settings-${eng}-${scheme}.png`,fullPage:true});
      await ctx.close();
    }

    // ---- the switches actually switch ---------------------------------
    {
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openSettings(p);

      const low=p.locator('#notify-low_data');
      const exp=p.locator('#notify-expiry');
      ok('[switch] both start ON — service messages default to on',
        (await low.isChecked())&&(await exp.isChecked()));

      await low.click(); await p.waitForTimeout(700);
      ok('[switch] turning one off sticks', (await low.isChecked())===false);
      ok('[switch] and the other is untouched', (await exp.isChecked())===true);

      const calls=await p.evaluate(()=>window.__prefCalls);
      ok('[switch] ONLY the changed field is sent',
        calls.length===1&&calls[0].low_data===false&&!('expiry' in calls[0]),
        JSON.stringify(calls[0]));

      // Reopen: the server's answer is what survives, not the tap.
      await p.tap('#nav-home'); await p.waitForTimeout(400);
      await openSettings(p);
      ok('[switch] the state survives a reload of the screen',
        (await p.locator('#notify-low_data').isChecked())===false
        &&(await p.locator('#notify-expiry').isChecked())===true);
      await ctx.close();
    }

    // ---- a refused write must not lie ---------------------------------
    {
      const ctx=await ctxFor({prefsFails:true}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openSettings(p);

      const low=p.locator('#notify-low_data');
      await low.click(); await p.waitForTimeout(800);

      ok('[switch] a failed save puts the switch BACK', (await low.isChecked())===true);
      ok('[switch] and says so', (await p.$$('.toast')).length===1);
      await ctx.close();
    }

    // ---- disconnecting ----------------------------------------------
    {
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openSettings(p);

      await p.getByRole('button',{name:'Отключить'}).click(); await p.waitForTimeout(350);
      const warn=await p.$eval('.sheetm__panel',n=>n.innerText);
      ok('disconnecting asks first', /Отключить этот адрес/i.test(warn));
      ok('and is EXACT about what survives — already-added purchases stay',
        /останутся/i.test(warn)&&/новые/i.test(warn), warn.replace(/\n/g,' ').slice(0,110));

      await p.getByRole('button',{name:'Отмена'}).click(); await p.waitForTimeout(400);
      ok('cancelling sends nothing',
        (await p.evaluate(()=>window.__calls.filter(c=>/revoke$/.test(c.url.split('?')[0])))).length===0);

      await p.getByRole('button',{name:'Отключить'}).click(); await p.waitForTimeout(350);
      await p.getByRole('button',{name:'Отключить',exact:true}).last().click(); await p.waitForTimeout(1000);

      const call=(await p.evaluate(()=>window.__calls.filter(c=>/revoke$/.test(c.url.split('?')[0]))))[0];
      ok('revoke is a POST carrying the identity id in the body',
        call.method==='POST'&&call.body.identity_id==='11111111-2222-4333-8444-555555555555'
        &&!call.url.includes('11111111'));

      const after=await p.$eval('#screen-settings',n=>n.innerText);
      ok('the list refreshes without a restart', !/b\*+r@example\.com/.test(after));
      ok('and the empty state offers the way back',
        /Подтверждённых адресов нет/i.test(after)&&/Добавить покупки с сайта/.test(after));
      await ctx.close();
    }

    // ---- no addresses at all ----------------------------------------
    {
      const ctx=await ctxFor({emails:[]}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openSettings(p);
      const body=await p.$eval('#screen-settings',n=>n.innerText);
      ok('[none] the empty state explains what connecting a mailbox is for',
        /Подтверждённых адресов нет/i.test(body)&&/покупки с сайта/i.test(body));
      ok('[none] and «Уведомления» still says where things arrive',
        /на почту, указанную при покупке/i.test(body));
      await p.getByRole('button',{name:'Добавить покупки с сайта'}).click(); await p.waitForTimeout(500);
      ok('[none] and it leads to the S13 flow',
        (await p.$$eval('.screen[data-active]',n=>n.map(x=>x.id)))[0]==='screen-claim');
      await ctx.close();
    }

    // ---- a long masked address ---------------------------------------
    {
      // The address is the thing the row exists to show, so it must be readable
      // WHOLE. First attempt at fixing the truncation swung the other way and
      // pushed the page sideways; this pins both ends.
      const ctx=await ctxFor({emails:[
        {id:'a',masked:'b***r@example.com',verified_at:'2026-08-19T08:54:02.000Z'},
        {id:'b',masked:'v***y.surname@some-long-provider.example.org',verified_at:'2026-08-20T08:00:00.000Z'},
      ]}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openSettings(p);

      const m=await p.evaluate(()=>{
        const rows=[...document.querySelectorAll('.settings__row')];
        return {rows:rows.map((r)=>{const t=r.querySelector('.card__title');
          const lh=parseFloat(getComputedStyle(t).lineHeight)||16;
          return {clipped:t.scrollWidth>t.clientWidth+1,
            lines:Math.round(t.getBoundingClientRect().height/lh),
            btn:Math.round(r.querySelector('button').getBoundingClientRect().width),
            w:Math.round(t.getBoundingClientRect().width)};}),
          overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1};
      });

      ok('[long] no address is truncated', m.rows.every((r)=>!r.clipped),
        JSON.stringify(m.rows.map((r)=>r.clipped)));
      ok('[long] a long one wraps instead of ellipsing', m.rows[1].lines>1, `${m.rows[1].lines} lines`);
      ok('[long] and never a one-character tower', m.rows.every((r)=>r.lines<=3&&r.w>120),
        JSON.stringify(m.rows.map((r)=>`${r.w}px/${r.lines}`)));
      ok('[long] the button takes its own width, not the row\'s',
        m.rows.every((r)=>r.btn<150), `${m.rows[0].btn}px`);
      ok('[long] the page does not scroll sideways', !m.overflow);
      await ctx.close();
    }

    // ---- a failure is not silent ------------------------------------
    {
      const ctx=await ctxFor({revokeFails:true}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openSettings(p);
      await p.getByRole('button',{name:'Отключить'}).click(); await p.waitForTimeout(350);
      await p.getByRole('button',{name:'Отключить',exact:true}).last().click(); await p.waitForTimeout(900);
      ok('a failed disconnect says so and keeps the address',
        (await p.$$('.toast')).length===1
        && /b\*+r@example\.com/.test(await p.$eval('#screen-settings',n=>n.innerText)));
      await ctx.close();
    }

    await br.close();
  }
}
s.close();
console.log(bad?`\n${bad} FAILED`:'\nall settings checks passed');
process.exit(bad?1:0);
})();
