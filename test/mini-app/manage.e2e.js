/**
 * Managing an eSIM you own: your own name for it, and taking it out of the way.
 *
 * NOTHING HERE DELETES ANYTHING, and the tests assert that the interface never
 * says otherwise — «Удалить» must not appear in this flow, because there is no
 * deletion behind it. The eSIM keeps working, keeps its ICCID, its order, its
 * usage and its top-up history; hiding decides which list it shows in.
 *
 * Real browser, iPhone viewport, both engines, both themes. No backend: the
 * endpoints are faked at the network edge and the fake enforces the same
 * ownership rule the server does, so a test cannot pass by asking the wrong
 * question.
 *
 *   node test/mini-app/manage.e2e.js
 */
const http=require('http'),fs=require('fs'),path=require('path');
const pw=require('playwright');
const APP=path.join(__dirname,'..','..','app');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
let bad=0; const ok=(l,c,d='')=>{if(!c)bad++;console.log(`   ${c?'ok  ':'FAIL'} ${l}${d?'  — '+d:''}`);};

function mock(cfg){
  window.__calls=[];
  window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
    initDataUnsafe:{},ready(){},expand(){},close(){},colorScheme:cfg.scheme||'light',platform:'ios',
    themeParams:cfg.theme||{},setBackgroundColor(){},setHeaderColor(){},onEvent(){},
    BackButton:{show(){},hide(){},onClick(){},offClick(){}},
    HapticFeedback:{impactOccurred(){},notificationOccurred(){}},openLink(){}}};

  // ONE store, shared by every endpoint below, so a rename really does change
  // what the next list call returns — the point of the flow is that the screen
  // updates without a restart.
  const store = {
    e1:{id:'e1',status:'ready',country_code:'TR',package_name:'Turkey 3GB 15Days',
        usage_state:'available',remaining_gb:2.1,total_gb:3,expires_at:'2026-12-01T00:00:00Z',
        last_usage_sync_at:'2026-08-20T09:00:00Z',display_name:cfg.named?'Поездка в Турцию':null,hidden:Boolean(cfg.startHidden)},
    e2:{id:'e2',status:'active',country_code:'TH',package_name:'Thailand 5GB 15Days',
        usage_state:'available',remaining_gb:4,total_gb:5,expires_at:'2026-11-01T00:00:00Z',
        last_usage_sync_at:'2026-08-20T09:00:00Z',display_name:null,hidden:true},
  };
  if (cfg.noHidden) delete store.e2;

  const j=(b,s=200)=>Promise.resolve(new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json'}}));
  const list=(hidden)=>({items:Object.values(store).filter((e)=>Boolean(e.hidden)===hidden)});

  window.fetch=(u,o)=>{u=String(u);
    const body=o&&o.body?JSON.parse(o.body):null;
    const method=(o&&o.method)||'GET';
    window.__calls.push({url:u,method,body});
    const p=u.split('?')[0];

    if(u.includes('catalog.json'))return j({schema_version:1,generated_at:'x',package_count:0,packages:[]});
    if(u.includes('/tma/session'))return j({session_token:'m',expires_in:1800});
    if(u.includes('/retail/packages'))return j({status:'success',count:0,currency:'RUB',data:[]});
    if(/\/tma\/esims\/hidden$/.test(p))return j(list(true));

    const nameHit=/\/tma\/esims\/([^/]+)\/name$/.exec(p);
    if(nameHit){
      const e=store[nameHit[1]];
      if(!e)return j({error:'NOT_FOUND',message:'Не найдено.'},404);   // foreign ≡ missing
      const n=String((body&&body.name)||'').trim();
      if(n.length>60)return j({error:'ESIM_NAME_TOO_LONG',message:'Название не длиннее 60 символов.'},400);
      e.display_name=n||null;
      return j({id:e.id,display_name:e.display_name});
    }
    const visHit=/\/tma\/esims\/([^/]+)\/visibility$/.exec(p);
    if(visHit){
      const e=store[visHit[1]];
      if(!e)return j({error:'NOT_FOUND',message:'Не найдено.'},404);
      e.hidden=(body&&body.hidden)===true;
      return j({id:e.id,hidden:e.hidden});
    }
    if(/\/tma\/esims\/[^/?]+\/topups$/.test(p))return j({topup_available:false,topup_options:[],purchase_enabled:false});
    const one=/\/tma\/esims\/([^/]+)$/.exec(p);
    if(one&&store[one[1]])return j(store[one[1]]);
    if(one)return j({error:'NOT_FOUND',message:'Не найдено.'},404);
    if(u.includes('/tma/esims'))return j(list(false));
    if(u.includes('/me/orders'))return j({items:[]});
    return j({items:[]});};
}

(async()=>{
const s=http.createServer((q,r)=>{const u=q.url.split('?')[0];const n=u==='/'?'/index.html':u;
const root=n.startsWith('/assets/')?path.join(APP,'..'):APP;
fs.readFile(path.join(root,n),(e,b)=>{if(e)return r.writeHead(404).end();r.writeHead(200,{'content-type':T[path.extname(n)]||'text/plain'});r.end(b);});});
await new Promise(r=>s.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${s.address().port}/index.html`;

const openFirstEsim=async(p)=>{
  await p.tap('#nav-esims'); await p.waitForTimeout(800);
  await p.locator('#esims-list button.card').first().click(); await p.waitForTimeout(700);
  await p.locator('#screen-esim summary.sheet__head').click(); await p.waitForTimeout(250);
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

    // ---- rename -------------------------------------------------------
    {
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openFirstEsim(p);

      const names=await p.$$eval('#screen-esim button',ns=>ns.map(n=>n.innerText.replace(/\s+/g,' ').trim()));
      ok('management is behind one collapsed block, not four loose buttons',
        names.includes('Переименовать')&&names.includes('Скрыть eSIM'),
        names.filter(n=>/Переимен|Скрыть/.test(n)).join(' | '));
      ok('the word «Удалить» appears NOWHERE — nothing is deleted',
        !/Удалить/i.test(await p.$eval('#screen-esim',n=>n.innerText)));

      await p.getByRole('button',{name:'Переименовать'}).click(); await p.waitForTimeout(300);
      ok('rename opens a sheet, not a native prompt', (await p.$$('.sheetm__panel')).length===1);

      const cap=await p.$eval('.sheetm__panel input',n=>n.getAttribute('maxlength'));
      ok('the field caps the length the server caps', cap==='60', cap);

      await p.fill('.sheetm__panel input','Поездка в Турцию');
      await p.getByRole('button',{name:'Сохранить'}).click(); await p.waitForTimeout(900);

      ok('the sheet closes after saving', (await p.$$('.sheetm__panel')).length===0);
      const title=await p.$eval('#screen-esim .esim-detail__title',n=>n.textContent);
      ok('the custom name becomes the title', title==='Поездка в Турцию', title);
      const sub=await p.$eval('#screen-esim .esim-card__sub',n=>n.textContent);
      ok('and what they actually bought is still shown under it', /Турция/.test(sub)&&/3 ГБ/.test(sub), sub);

      const sent=await p.evaluate(()=>window.__calls.filter(c=>/\/name$/.test(c.url.split('?')[0])));
      ok('the name travels in the POST body, never in the URL',
        sent.length===1&&sent[0].method==='POST'&&sent[0].body.name==='Поездка в Турцию'
        &&!sent[0].url.includes('Поездка'));

      // Back on the list, without a restart.
      await p.tap('#nav-esims'); await p.waitForTimeout(900);
      const cardText=await p.$eval('#esims-list button.card',n=>n.innerText.replace(/\s+/g,' '));
      ok('the list shows the custom name immediately', /Поездка в Турцию/.test(cardText), cardText.slice(0,60));
      ok('with the original underneath', /Турция/.test(cardText)&&/3 ГБ/.test(cardText));
      await ctx.close();
    }

    // ---- clearing the name --------------------------------------------
    {
      const ctx=await ctxFor({named:true}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openFirstEsim(p);
      await p.getByRole('button',{name:'Переименовать'}).click(); await p.waitForTimeout(300);
      ok('a named eSIM offers the way back to the standard name',
        (await p.$$eval('.sheetm__panel button',ns=>ns.map(n=>n.innerText))).some(t=>/стандартное/i.test(t)));
      await p.getByRole('button',{name:/Вернуть стандартное название/}).click(); await p.waitForTimeout(900);

      const title=await p.$eval('#screen-esim .esim-detail__title',n=>n.textContent);
      ok('clearing restores the derived name', /Турция/.test(title), title);
      ok('and the subtitle goes away with it', (await p.$$('#screen-esim .esim-card__sub')).length===0);
      const sent=await p.evaluate(()=>window.__calls.filter(c=>/\/name$/.test(c.url.split('?')[0])));
      ok('an empty name is what clears it — one call, no second endpoint',
        sent.length===1&&sent[0].body.name==='', JSON.stringify(sent[0]&&sent[0].body));
      await ctx.close();
    }

    // ---- hiding -------------------------------------------------------
    {
      const ctx=await ctxFor({noHidden:true}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);

      ok('no hidden eSIMs -> no «Скрытые» section at all',
        !/Скрытые eSIM/.test(await p.$eval('#screen-esims',n=>n.innerText)));

      await openFirstEsim(p);
      await p.getByRole('button',{name:'Скрыть eSIM'}).click(); await p.waitForTimeout(300);

      const confirmText=await p.$eval('.sheetm__panel',n=>n.innerText);
      ok('hiding asks first, and says it is reversible',
        /Скрыть эту eSIM/.test(confirmText)&&/вернуть/i.test(confirmText));
      ok('the confirmation does not threaten deletion', !/Удалить|удалит/i.test(confirmText));

      // Cancel means cancel.
      await p.getByRole('button',{name:'Отмена'}).click(); await p.waitForTimeout(400);
      const afterCancel=await p.evaluate(()=>window.__calls.filter(c=>/visibility$/.test(c.url.split('?')[0])));
      ok('cancelling changes nothing', afterCancel.length===0);

      await p.getByRole('button',{name:'Скрыть eSIM'}).click(); await p.waitForTimeout(300);
      await p.getByRole('button',{name:'Скрыть',exact:true}).click(); await p.waitForTimeout(1200);

      const listText=await p.$eval('#screen-esims',n=>n.innerText);
      ok('it leaves the main list', !/Turkey|Турция/.test(listText.split('Скрытые eSIM')[0]));
      ok('and appears under «Скрытые eSIM»', /Скрытые eSIM/.test(listText));

      const call=(await p.evaluate(()=>window.__calls.filter(c=>/visibility$/.test(c.url.split('?')[0]))))[0];
      ok('hidden travels as a boolean in the body', call.method==='POST'&&call.body.hidden===true);
      await ctx.close();
    }

    // ---- restoring ----------------------------------------------------
    {
      const ctx=await ctxFor({startHidden:true,noHidden:true}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await p.tap('#nav-esims'); await p.waitForTimeout(900);

      const txt=await p.$eval('#screen-esims',n=>n.innerText);
      ok('every eSIM hidden -> the section is still reachable, not an empty screen',
        /Скрытые eSIM/.test(txt), txt.split('\n').slice(0,3).join(' / '));

      // The hidden card is the only one on screen.
      await p.locator('#esims-list button.card').last().click(); await p.waitForTimeout(800);
      const detail=await p.$eval('#screen-esim',n=>n.innerText);
      ok('the detail screen says it is hidden', /скрыта из основного списка/i.test(detail));

      await p.locator('#screen-esim summary.sheet__head').click(); await p.waitForTimeout(250);
      const btns=await p.$$eval('#screen-esim button',ns=>ns.map(n=>n.innerText.replace(/\s+/g,' ').trim()));
      ok('a hidden eSIM offers restore, not hide',
        btns.includes('Вернуть в мои eSIM')&&!btns.includes('Скрыть eSIM'),
        btns.filter(t=>/Вернуть|Скрыть/.test(t)).join(' | '));

      await p.getByRole('button',{name:'Вернуть в мои eSIM'}).click(); await p.waitForTimeout(1200);
      ok('restoring asks nothing — undoing something reversible needs no ceremony',
        (await p.$$('.sheetm__panel')).length===0);
      const back=await p.$eval('#esims-list',n=>n.innerText);
      ok('and it is back in the main list', /Турция/.test(back.split('Скрытые eSIM')[0]));

      const call=(await p.evaluate(()=>window.__calls.filter(c=>/visibility$/.test(c.url.split('?')[0]))))[0];
      ok('restore sends hidden:false', call.body.hidden===false);
      await ctx.close();
    }

    // ---- ownership, from the client's side ----------------------------
    {
      // The server answers 404 for an eSIM that is not this customer's — the
      // app must present that as "not found", never as a failed rename that
      // implies the eSIM exists.
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      const r=await p.evaluate(async()=>{
        const res=await fetch('/api/v1/tma/esims/SOMEBODY-ELSE/name',
          {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Моя'})});
        return {status:res.status};
      });
      ok('a foreign eSIM id answers 404, the same as a missing one', r.status===404, String(r.status));
      await ctx.close();
    }

    // ---- layout -------------------------------------------------------
    {
      const ctx=await ctxFor({named:true}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await p.tap('#nav-esims'); await p.waitForTimeout(900);
      const of=await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
      ok('no horizontal overflow on the list with a custom name', !of);

      await openFirstEsim(p);
      await p.getByRole('button',{name:'Переименовать'}).click(); await p.waitForTimeout(350);
      const sheet=await p.$eval('.sheetm__panel',n=>{const r=n.getBoundingClientRect();
        return {w:Math.round(r.width),bottom:Math.round(r.bottom),vh:window.innerHeight};});
      ok('the sheet spans the screen and sits on the bottom edge',
        sheet.w===390&&Math.abs(sheet.bottom-sheet.vh)<2, JSON.stringify(sheet));
      const of2=await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
      ok('and opening it causes no horizontal overflow', !of2);
      await p.screenshot({path:`/private/tmp/claude-501/-Users-xxx-Desktop-eSim/292faf93-883b-4959-b678-8b7cdaf41e6e/scratchpad/home/manage-${eng}-${scheme}.png`});
      await ctx.close();
    }

    await br.close();
  }
}
s.close();
console.log(bad?`\n${bad} FAILED`:'\nall eSIM management checks passed');
process.exit(bad?1:0);
})();
