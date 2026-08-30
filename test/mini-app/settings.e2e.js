/**
 * Account settings.
 *
 * The screen exists to close one real gap: `POST /tma/identity/email/revoke` has
 * been implemented on the backend and open at the gateway since S13 shipped,
 * with no interface anywhere — a customer who connected a mailbox could not
 * disconnect it.
 *
 * It carries three things now, and pins all of them. The rule governing each is
 * the same one it has always been — a control here may not lie — and each
 * arrived only once that rule was satisfied.
 *
 * The notification switches were absent while every message the bot sent was a
 * reply to something the customer sent it; they exist because the delivery
 * engine does. The language picker was absent while the app had one language,
 * because a picker with one option offers a choice that does nothing; it exists
 * because there are two complete dictionaries. What these tests assert is that
 * each is WHOLE: a switch that moves only when the server agrees, and a
 * language that leaves no Russian behind on an English screen.
 *
 * The earlier revision of this file asserted the ABSENCE of both. Those
 * assertions were inverted rather than deleted — what they protected is still
 * worth protecting.
 *
 *   node test/mini-app/settings.e2e.js
 */
const http=require('http'),fs=require('fs'),path=require('path');
const pw=require('playwright');
const APP=path.join(__dirname,'..','..','app');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
let bad=0; const ok=(l,c,d='')=>{if(!c)bad++;console.log(`   ${c?'ok  ':'FAIL'} ${l}${d?'  — '+d:''}`);};

const RAW='buyer@example.com';

// The Russian settings screen, exactly as it renders.
//
// This is the oracle for "Russian did not change", and it is deliberately kept
// HERE rather than derived from app/locales.js: a test that builds its expected
// value out of the file under test asserts nothing. It was taken from the
// rendered screen, and against the screen as it stood before there were two
// languages it differs by exactly one thing — the six lines of the language
// block, which is what this change added. Every other byte is what shipped.
//
// Phase 2 edit: the hint lost its second sentence («Часть экранов пока только
// на русском»), because it is no longer true. That is the ONLY byte of this
// oracle Phase 2 moved — the whole point of the phase was to add English
// without touching the Russian screen, and this snapshot is where that claim
// is checked rather than asserted.
const RU_SETTINGS=`Настройки
Язык
Русский
English

Меняет язык приложения.

Почта

Покупки с сайта на эти адреса появляются в «Мои eSIM» автоматически.

b***r@example.com
подтверждён 19.08.2026
Отключить
Уведомления
Интернет заканчивается
При остатке 20% и 10%
Срок действия истекает
За 3 дня и за сутки

Приходят в этот чат. Данные eSIM и чек — на почту, указанную при покупке. Рекламных рассылок мы не отправляем.

Аккаунт
Вы с нами с
18.08.2026
Покупок
3
eSIM
1`;

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

      // There IS a language picker now, and this is the inverse of the
      // assertion that stood here — kept as an assertion rather than deleted,
      // because what it was protecting has not changed. The rule was never "no
      // picker"; it was "a control here may not lie". A picker with one option
      // lied by offering a choice that did nothing. A picker with two lies if
      // either option is incomplete, so what is pinned now is that it offers
      // exactly the languages that have a dictionary, and exactly one of them
      // is marked as the one in use.
      const langs=await p.$$eval('#settings-language [data-lang]',ns=>ns.map(n=>n.dataset.lang));
      ok('the language picker offers exactly the languages that have a dictionary',
        JSON.stringify(langs.slice().sort())==='["en","ru"]', JSON.stringify(langs));
      ok('and exactly one language is marked as the one in use',
        (await p.$$eval('#settings-language [data-lang][aria-checked="true"]',
          ns=>ns.map(n=>n.dataset.lang))).join()==='ru');
      // el() drops an attribute whose value is `false`, so an unselected option
      // built carelessly ships with no state at all and a screen reader
      // announces a radio that is neither on nor off.
      ok('and the unselected one says so, rather than saying nothing',
        (await p.$$eval('#settings-language [data-lang]',
          ns=>ns.map(n=>n.getAttribute('aria-checked')))).join()==='true,false');
      // Phase 2 localised every customer-facing screen, so the Phase 1 caveat
      // came out. Asserted as an absence for the same reason it was once
      // asserted as a presence: the sentence must match what the app does.
      ok('the picker no longer apologises for screens it does not change',
        /Меняет язык приложения\./.test(body) && !/пока только на русском/.test(body));

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
      // Element-level, not just document-level. The row that holds the masked
      // address overflowed its own column by 16px for a long time without ever
      // reaching the viewport, because .card__body's min-width:0 contained the
      // damage — so a document-level check called it clean. A grid item needs
      // min-width:0 of its own; this is what notices when it loses it again.
      const inner=await p.$$eval('#screen-settings *',ns=>ns
        .filter(n=>n.clientWidth>0&&n.scrollWidth>n.clientWidth+1)
        .map(n=>`${n.className||n.tagName} ${n.scrollWidth}>${n.clientWidth}`));
      ok('and nothing overflows its own box either', inner.length===0, inner.join(' / '));
      await p.screenshot({path:`/private/tmp/claude-501/-Users-xxx-Desktop-eSim/292faf93-883b-4959-b678-8b7cdaf41e6e/scratchpad/home/settings-${eng}-${scheme}.png`,fullPage:true});
      await ctx.close();
    }

    // ---- one revoke per intention -------------------------------------
    //
    // Two windows used to be open on this button: the request, and — worse —
    // the confirmation itself. There is one sheet element in the app and
    // openSheet closes whatever is open first, so a second entry while the
    // first confirmation was up tore out the DOM that the first promise
    // resolves from, and that promise then never settled at all.
    {
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openSettings(p);

      await p.click('#screen-settings .settings__act'); await p.waitForTimeout(300);
      ok('the button closes itself the moment it raises the question',
        await p.$eval('#screen-settings .settings__act',n=>n.disabled));

      // A second press while the dialog is up must do nothing at all — not
      // open a second dialog, and above all not strand the first one.
      await p.$eval('#screen-settings .settings__act',n=>n.click());
      await p.waitForTimeout(200);
      ok('and a second press raises no second dialog',
        (await p.$$('.sheetm')).length===1);

      await p.click('.sheetm__panel .btn--wide'); await p.waitForTimeout(900);
      const revokes=await p.evaluate(()=>window.__calls.filter(c=>/\/identity\/email\/revoke$/.test(c.url.split('?')[0])).length);
      ok('exactly one revoke reached the server', revokes===1, String(revokes));
      await ctx.close();
    }

    // ---- cancelling leaves the row usable ------------------------------
    {
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openSettings(p);

      await p.click('#screen-settings .settings__act'); await p.waitForTimeout(300);
      await p.click('.sheetm__scrim'); await p.waitForTimeout(300);
      ok('a dismissed confirmation gives the button back',
        !(await p.$eval('#screen-settings .settings__act',n=>n.disabled)));
      ok('and nothing was sent', (await p.evaluate(()=>window.__calls
        .filter(c=>/\/identity\/email\/revoke$/.test(c.url.split('?')[0])).length))===0);
      await ctx.close();
    }

    // ---- the second language is whole, or it is a lie ------------------
    //
    // This is where the intent of the deleted "NO language picker" assertion
    // lives on, in a stronger form. That one proved a control was absent; these
    // prove the control is not a lie — a key left untranslated, a string still
    // hardcoded in the paint, a hook never added to the markup, or «Отмена»
    // surviving inside the confirmation dialog all turn them red.
    {
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openSettings(p);

      const ru=await p.$eval('#screen-settings',n=>n.innerText);
      ok('the Russian screen still reads as it did before there were two languages',
        ru.trim()===RU_SETTINGS, ru.replace(/\n/g,' | ').slice(0,200));

      await p.click('#settings-language [data-lang="en"]'); await p.waitForTimeout(400);
      const en=await p.$eval('#screen-settings',n=>n.innerText);
      ok('choosing English changes the screen it is on, with no reload', en!==ru);
      ok('and leaves NO Russian behind on it', !/[Ѐ-ӿ]/.test(en.replace(/Русский/g,'')),
        (en.match(/[Ѐ-ӿ][^\n]*/)||[])[0]||'');
      ok('the document announces the language it is now in',
        (await p.evaluate(()=>document.documentElement.lang))==='en');
      ok('and the shell headline followed', (await p.$eval('#screen-settings h1',n=>n.innerText))==='Settings');

      // A dialog is part of the screen. Half-English is the same lie in a
      // smaller box: openSheet's title and cancel come from shared chrome.
      await p.click('#screen-settings .settings__act'); await p.waitForTimeout(350);
      ok('no Russian survives inside a dialog the screen can open',
        !/[Ѐ-ӿ]/.test(await p.$eval('.sheetm__panel',n=>n.innerText)));
      await p.click('.sheetm__scrim'); await p.waitForTimeout(250);

      // The requirement is that the choice outlives the app, not the render.
      await p.reload(); await p.waitForTimeout(2200); await openSettings(p);
      ok('the choice survives a restart of the app',
        !/[Ѐ-ӿ]/.test((await p.$eval('#screen-settings',n=>n.innerText)).replace(/Русский/g,'')));

      await p.click('#settings-language [data-lang="ru"]'); await p.waitForTimeout(400);
      ok('and switching back restores the Russian screen exactly',
        (await p.$eval('#screen-settings',n=>n.innerText)).trim()===RU_SETTINGS);

      const off=await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
      ok('neither language takes the page sideways', !off);
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
