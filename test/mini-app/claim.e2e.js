/**
 * S13 · connecting purchases made on the website.
 *
 * The five steps a customer walks, in a real browser, on a phone viewport, in
 * both themes and both engines. No mail is sent and no backend is contacted:
 * the endpoints are faked at the network edge.
 *
 *   node test/mini-app/claim.e2e.js
 */
const http=require('http'),fs=require('fs'),path=require('path');
const pw=require('playwright');
const APP=path.join(__dirname,'..','..','app');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
let bad=0; const ok=(l,c,d='')=>{if(!c)bad++;console.log(`   ${c?'ok  ':'FAIL'} ${l}${d?'  — '+d:''}`);};

function mock(cfg){
  window.__requests=[];
  window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
    initDataUnsafe:cfg.startParam?{start_param:cfg.startParam}:{},
    ready(){},expand(){},close(){},colorScheme:cfg.scheme||'light',
    themeParams:cfg.scheme==='dark'?{bg_color:'#17212b'}:{},
    setBackgroundColor(){},setHeaderColor(){},onEvent(){},
    BackButton:{show(){},hide(){},onClick(){},offClick(){}},
    HapticFeedback:{impactOccurred(){},notificationOccurred(){}},openLink(){}}};
  const j=(b,s=200)=>Promise.resolve(new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json'}}));
  const PKG=[{package_id:'p1',name:'Turkey 3GB 15Days',data_gb:3,validity_days:15,country_code:'TR',price:400,coverage_country_codes:['TR'],coverage_flags:'🇹🇷'}];
  window.fetch=(u,o)=>{u=String(u);
    const body=o&&o.body?JSON.parse(o.body):null;
    window.__requests.push({url:u,body});
    if(u.includes('catalog.json'))return j({schema_version:1,generated_at:'2026-08-19T00:00:00Z',package_count:1,packages:PKG});
    if(u.includes('/tma/session'))return j({session_token:'m',expires_in:1800});
    if(u.includes('/retail/packages'))return j({status:'success',count:1,currency:'RUB',data:PKG});
    if(u.includes('/identity/email/request'))
      return cfg.alreadyVerified
        ? j({status:'already_verified',message:'Этот адрес уже подтверждён. Мы обновили список ваших покупок.'})
        : j({status:'sent',message:'Если этот адрес использовался при покупке, мы отправили на него код.'});
    if(u.includes('/identity/email/confirm')){
      const step=cfg.confirm||{ok:true};
      if(step.fail)return j({error:step.fail,message:step.message,attempts_left:step.attempts_left},step.status||400);
      return j({ok:true,email_masked:'b***r@example.com',linked_count:step.linked??2,
        already_linked_count:step.already??0,esims_attached:step.linked??2,
        purchases:(step.linked??2)===0?[]:[
          {public_order_token:'t1',package_name:'Turkey 3GB 15Days',country_code:'TR',data_gb:3,validity_days:15,created_at:'2026-07-01T00:00:00Z',has_esim:true},
          {public_order_token:'t2',package_name:'Best World 10 GB',country_code:'AL',data_gb:10,validity_days:30,created_at:'2026-06-01T00:00:00Z',has_esim:false}]});
    }
    if(/\/tma\/esims\/[^/?]+\/topups$/.test(u.split('?')[0]))return j({topup_available:false,topup_options:[],purchase_enabled:false});
    if(u.includes('/tma/esims'))return j({items:cfg.esims||[]});
    if(u.includes('/me/orders'))return j({items:[]});
    return j({items:[]});};
}

(async()=>{
const s=http.createServer((q,r)=>{const u=q.url.split('?')[0];const n=u==='/'?'/index.html':u;
const root=n.startsWith('/assets/')?path.join(APP,'..'):APP;
fs.readFile(path.join(root,n),(e,b)=>{if(e)return r.writeHead(404).end();r.writeHead(200,{'content-type':T[path.extname(n)]||'text/plain'});r.end(b);});});
await new Promise(r=>s.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${s.address().port}/index.html`;

const openClaim = async (p) => {
  // By id, like the other suites: the tab's accessible name comes from a
  // nested span, so getByRole does not see it.
  await p.tap('#nav-esims');
  await p.waitForTimeout(600);
  await p.getByRole('button',{name:/Добавить покупки с сайта/}).click();
  await p.waitForTimeout(300);
};

for (const eng of ['webkit','chromium']) {
  for (const scheme of ['light','dark']) {
    const br=await pw[eng].launch();
    console.log(`\n── ${eng} · ${scheme} ──`);

    // --- the happy path, five steps -------------------------------------
    {
      const ctx=await br.newContext({...pw.devices['iPhone 13'],colorScheme:scheme});
      await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
      await ctx.addInitScript(mock,{scheme,esims:[]});
      const p=await ctx.newPage(); await p.goto(base); await p.waitForTimeout(2000);

      await openClaim(p);
      const screen=(await p.$$eval('.screen[data-active]',n=>n.map(x=>x.id)))[0];
      ok('the empty list offers the site purchases, and it opens', screen==='screen-claim', screen);

      const intro=await p.$eval('#screen-claim',n=>n.innerText);
      ok('it speaks the customer\'s language, not ours',
        !/identity|retail|customer|link|token/i.test(intro), intro.slice(0,50).replace(/\n/g,' '));

      // The email field must not fight a phone.
      const attrs=await p.$eval('#claim-email',n=>({
        type:n.type,ac:n.getAttribute('autocapitalize'),cor:n.getAttribute('autocorrect'),
        im:n.getAttribute('inputmode'),comp:n.getAttribute('autocomplete')}));
      ok('the email field is set up for a phone',
        attrs.ac==='none'&&attrs.cor==='off'&&attrs.im==='email'&&attrs.comp==='email', JSON.stringify(attrs));

      await p.fill('#claim-email','buyer@example.com');
      await p.getByRole('button',{name:/Отправить код/}).click();
      await p.waitForTimeout(400);

      const codeAttrs=await p.$eval('#claim-code',n=>({
        im:n.getAttribute('inputmode'),comp:n.getAttribute('autocomplete'),max:n.getAttribute('maxlength'),
        size:getComputedStyle(n).fontSize}));
      ok('the code field asks for digits and accepts the one-time code',
        codeAttrs.im==='numeric'&&codeAttrs.comp==='one-time-code'&&codeAttrs.max==='6', JSON.stringify(codeAttrs));
      ok('and it is at least 16px, so iOS does not zoom the page',
        parseFloat(codeAttrs.size)>=16, codeAttrs.size);

      await p.fill('#claim-code','123456');
      await p.getByRole('button',{name:/Подтвердить/}).click();
      await p.waitForTimeout(600);

      const done=await p.$eval('#screen-claim',n=>n.innerText);
      ok('it says how many purchases were added', /Нашли 2 покупки/.test(done), done.slice(0,60).replace(/\n/g,' '));
      ok('and names the destinations properly', /Турция/.test(done)&&/Весь мир/.test(done));
      ok('no raw code or internal id on screen', !/t1|t2|AL\b/.test(done));

      await p.getByRole('button',{name:/Открыть «Мои eSIM»/}).click();
      await p.waitForTimeout(400);
      ok('and it lands on the refreshed list',
        (await p.$$eval('.screen[data-active]',n=>n.map(x=>x.id)))[0]==='screen-esims');
      ok('no horizontal scroll anywhere in the flow',
        await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
      await ctx.close();
    }

    // --- a wrong code, and no purchases ---------------------------------
    for (const sc of [
      {name:'a wrong code says so and counts down',
       confirm:{fail:'INVALID_CODE',message:'Код неверный. Проверьте и попробуйте ещё раз.',attempts_left:3},
       expect:/Код неверный/, extra:/Осталось попыток: 3/},
      {name:'attempts exhausted sends you back for a new code',
       confirm:{fail:'ATTEMPTS_EXHAUSTED',message:'Слишком много попыток. Запросите новый код.',attempts_left:0},
       expect:/Слишком много попыток/},
      {name:'a proven address with no purchases is not an error',
       confirm:{ok:true,linked:0,already:0}, expect:/Покупок с него не нашлось/},
    ]) {
      const ctx=await br.newContext({...pw.devices['iPhone 13'],colorScheme:scheme});
      await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
      await ctx.addInitScript(mock,{scheme,esims:[],confirm:sc.confirm});
      const p=await ctx.newPage(); await p.goto(base); await p.waitForTimeout(2000);
      await openClaim(p);
      await p.fill('#claim-email','buyer@example.com');
      await p.getByRole('button',{name:/Отправить код/}).click();
      await p.waitForTimeout(400);
      await p.fill('#claim-code','000000');
      await p.getByRole('button',{name:/Подтвердить/}).click();
      await p.waitForTimeout(600);
      const txt=await p.$eval('#screen-claim',n=>n.innerText);
      ok(sc.name, sc.expect.test(txt), txt.slice(0,60).replace(/\n/g,' '));
      if (sc.extra) ok('  and shows the attempts left', sc.extra.test(txt));
      await ctx.close();
    }

    // --- the address never leaves as anything but what was typed ---------
    {
      const ctx=await br.newContext({...pw.devices['iPhone 13'],colorScheme:scheme});
      await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
      await ctx.addInitScript(mock,{scheme,esims:[]});
      const p=await ctx.newPage(); await p.goto(base); await p.waitForTimeout(2000);
      await openClaim(p);
      await p.fill('#claim-email','buyer@example.com');
      await p.getByRole('button',{name:/Отправить код/}).click();
      await p.waitForTimeout(400);
      const reqs=await p.evaluate(()=>window.__requests.filter(r=>r.url.includes('identity')));
      ok('the address goes in the POST body, never in the URL',
        reqs.length===1&&reqs[0].body.email==='buyer@example.com'&&!reqs[0].url.includes('buyer'),
        reqs[0]&&reqs[0].url.split('/api')[1]);
      await ctx.close();
    }

    // --- an address already proven does NOT strand them on the code screen
    //
    // The dead end this replaced: the server denied the request (nothing left
    // to prove), answered "мы отправили код", sent none, and the app painted
    // the code screen. The customer waited for a mail that was never coming.
    {
      const ctx=await br.newContext({...pw.devices['iPhone 13'],colorScheme:scheme});
      await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
      await ctx.addInitScript(mock,{scheme,esims:[],alreadyVerified:true});
      const p=await ctx.newPage(); await p.goto(base); await p.waitForTimeout(2000);
      await openClaim(p);
      await p.fill('#claim-email','buyer@example.com');
      await p.getByRole('button',{name:/Отправить код/}).click();
      await p.waitForTimeout(500);

      const title=await p.$eval('#claim-title',n=>n.textContent);
      ok('an already-proven address never asks for a code', title==='Адрес уже подтверждён', title);
      ok('there is no code field to wait at', (await p.$('#claim-code'))===null);

      const body=await p.$eval('#claim-body',n=>n.innerText);
      ok('it says the list was refreshed', /обновили список/i.test(body), body.split('\n')[0]);
      ok('and offers the way on', /Открыть «Мои eSIM»/.test(body));

      // The list is refreshed BEFORE the screen paints, so tapping through
      // lands on something already correct.
      const esimCalls=await p.evaluate(()=>window.__requests.filter(r=>/\/tma\/esims(\?|$)/.test(r.url)).length);
      ok('the eSIM list was re-read before showing the result', esimCalls>=2, `${esimCalls} reads`);
      await ctx.close();
    }

    // --- arriving from the purchase email --------------------------------
    //
    // `startapp=e_<ref>` is a HINT about which screen to open. It proves
    // nothing, and the two branches below are the whole of what it can do.
    {
      // Owner: the eSIM is already theirs, so land on the list.
      const ctx=await br.newContext({...pw.devices['iPhone 13'],colorScheme:scheme});
      await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
      await ctx.addInitScript(mock,{scheme,startParam:'e_abc123',esims:[
        {id:'e1',status:'ready',package_name:'Turkey 3GB 15Days',country_code:'TR',data_gb:3,validity_days:15}]});
      const p=await ctx.newPage(); await p.goto(base); await p.waitForTimeout(2500);

      const screen=(await p.$$eval('.screen[data-active]',n=>n.map(x=>x.id)))[0];
      ok('the email button lands on «Мои eSIM», not the catalogue', screen==='screen-esims', screen);
      await ctx.close();
    }
    {
      // Stranger, or an owner who has not proven the mailbox: the list is
      // empty, so open the one thing that can help — proving it properly.
      const ctx=await br.newContext({...pw.devices['iPhone 13'],colorScheme:scheme});
      await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
      await ctx.addInitScript(mock,{scheme,startParam:'e_abc123',esims:[]});
      const p=await ctx.newPage(); await p.goto(base); await p.waitForTimeout(2500);

      const screen=(await p.$$eval('.screen[data-active]',n=>n.map(x=>x.id)))[0];
      ok('nothing owned -> the claim screen, not a dead end', screen==='screen-claim', screen);

      // And the arrival granted nothing: no eSIM appeared, and the app asked
      // for no ownership beyond the session it already had.
      const claimed=await p.evaluate(()=>window.__requests.some(r=>/link|claim|attach|own/i.test(r.url)));
      ok('the deep link asserts no ownership of its own', !claimed);
      await ctx.close();
    }
    await br.close();
  }
}
s.close();
console.log(bad?`\n${bad} FAILED`:'\nall S13 checks passed');
process.exit(bad?1:0);
})();
