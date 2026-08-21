/**
 * Promo codes at checkout.
 *
 * THE ONE RULE THESE TESTS EXIST TO ENFORCE: the client never computes a price.
 * Every number on the screen is either the catalogue's own or one the SERVER
 * returned from /api/v1/retail/promo/quote — the same endpoint the website
 * calls, already allowlisted at the gateway, and the only place that knows about
 * validity windows, usage and per-email limits, first-purchase rules, country
 * and package restrictions and the minimum-margin guard.
 *
 * So the fake below answers quotes; it never lets the app decide what a code is
 * worth, and several cases hand the app a hostile or malformed answer to prove
 * it refuses rather than improvises.
 *
 *   node test/mini-app/promo.e2e.js
 */
const http=require('http'),fs=require('fs'),path=require('path');
const pw=require('playwright');
const APP=path.join(__dirname,'..','..','app');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
let bad=0; const ok=(l,c,d='')=>{if(!c)bad++;console.log(`   ${c?'ok  ':'FAIL'} ${l}${d?'  — '+d:''}`);};

function mock(cfg){
  window.__calls=[];
  window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',initDataUnsafe:{},
    ready(){},expand(){},close(){},colorScheme:cfg.scheme||'light',platform:'ios',themeParams:cfg.theme||{},
    setBackgroundColor(){},setHeaderColor(){},onEvent(){},
    BackButton:{show(){},hide(){},onClick(){},offClick(){}},
    HapticFeedback:{impactOccurred(){},notificationOccurred(){}},openLink(u){window.__opened=u;}}};

  const j=(b,s=200)=>Promise.resolve(new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json'}}));
  const PKG={package_id:'p1',name:'Turkey 3GB 15Days',data_gb:3,validity_days:15,country_code:'TR',
    price:750,coverage_country_codes:['TR'],coverage_flags:'',activation_policy:'first_use'};

  window.fetch=(u,o)=>{u=String(u);const p=u.split('?')[0];
    const body=o&&o.body?JSON.parse(o.body):null;
    window.__calls.push({url:u,method:(o&&o.method)||'GET',body});
    if(u.includes('catalog.json'))return j({schema_version:1,generated_at:'x',package_count:1,packages:[PKG]});
    if(u.includes('/tma/session'))return j({session_token:'m',expires_in:1800});
    if(u.includes('/retail/packages'))return j({status:'success',count:1,currency:'RUB',data:[PKG]});

    if(/\/retail\/promo\/quote$/.test(p)){
      const code=(body&&body.promo_code)||'';
      if(cfg.promoDisabled)return j({error:'PROMO_CODES_DISABLED',message:'off'},409);
      if(cfg.quoteThrows)return Promise.reject(new TypeError('offline'));
      // Per-email limit: the SAME code stops being valid once an address is
      // known. This is why the app re-quotes when the email changes.
      if(cfg.emailBlocks&&body&&body.email)return j({error:'PROMO_CODE_EMAIL_LIMIT_REACHED'},409);
      if(code==='FRIENDS10')return j({valid:true,promo_code:'FRIENDS10',
        original_amount_rub:750,discount_amount_rub:75,final_amount_rub:675});
      if(code==='BIG50')return j({valid:true,promo_code:'BIG50',
        original_amount_rub:750,discount_amount_rub:375,final_amount_rub:375});
      // A hostile answer: "valid" with no numbers. The app must not improvise.
      if(code==='HOSTILE')return j({valid:true,promo_code:'HOSTILE'});
      // Another: a "discount" that raises the price.
      if(code==='INVERTED')return j({valid:true,promo_code:'INVERTED',
        original_amount_rub:750,discount_amount_rub:75,final_amount_rub:900});
      if(code==='EXPIRED')return j({error:'PROMO_CODE_EXPIRED'},409);
      if(code==='WRONGPKG')return j({error:'PROMO_CODE_NOT_APPLICABLE'},409);
      return j({error:'PROMO_CODE_NOT_FOUND'},404);
    }

    if(/\/tma\/orders$/.test(p)&&(o&&o.method)==='POST')
      return j({public_order_token:'tok',redirect_url:'https://app.platega.io/pay/x',
        payment_type:body.payment_type,amount_rub:body.expected_amount_rub},201);
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

const openCheckout=async(p)=>{
  await p.locator('.tile').first().click(); await p.waitForTimeout(600);
  await p.locator('#country-list button.card').first().click(); await p.waitForTimeout(600);
  await p.getByRole('button',{name:/Оформить|Купить|Далее|Перейти/}).first().click().catch(async()=>{
    await p.locator('#tariff-body button').first().click();
  });
  await p.waitForTimeout(700);
};
const total=(p)=>p.$eval('.checkout-total strong',n=>n.textContent.replace(/\s| /g,''));
const apply=async(p,code)=>{
  const t=await p.$('.promo__toggle');
  if(t) { await t.click(); await p.waitForTimeout(200); }
  await p.fill('#checkout-promo-input',code);
  await p.getByRole('button',{name:'Применить'}).click();
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

    // ---- apply / remove / change --------------------------------------
    {
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openCheckout(p);

      ok('checkout opens on the plain price', (await total(p)).includes('750'), await total(p));
      ok('promo starts collapsed — one quiet line, not a field',
        (await p.$$('#checkout-promo-input')).length===0
        && (await p.$eval('#checkout-promo',n=>n.innerText)).includes('Есть промокод?'));

      await apply(p,'friends10');
      const t1=await total(p);
      ok('a valid code repriced the total from the SERVER answer', t1.includes('675'), t1);
      const sum=await p.$eval('#checkout-summary',n=>n.innerText.replace(/\s+/g,' '));
      ok('the summary shows tariff, discount and total', /Тариф/.test(sum)&&/−/.test(sum)&&/К оплате/.test(sum), sum.slice(0,90));
      ok('the applied block names the code and the discount',
        /Промокод применён/.test(await p.$eval('#checkout-promo',n=>n.innerText)));

      const sent=await p.evaluate(()=>window.__calls.filter(c=>/promo\/quote$/.test(c.url.split('?')[0])));
      ok('the code was normalised before it was sent', sent[0].body.promo_code==='FRIENDS10', sent[0].body.promo_code);
      ok('and NO amount, discount or rate was ever sent',
        !('final_amount_rub' in sent[0].body) && !('discount_amount_rub' in sent[0].body)
        && !('price' in sent[0].body) && !('amount_rub' in sent[0].body),
        JSON.stringify(sent[0].body));

      // Change to a different code.
      await p.getByRole('button',{name:'Удалить'}).click(); await p.waitForTimeout(400);
      ok('removing restores the catalogue price', (await total(p)).includes('750'), await total(p));
      await apply(p,'BIG50');
      ok('a different code reprices again', (await total(p)).includes('375'), await total(p));
      await ctx.close();
    }

    // ---- refusals, in the customer's words ----------------------------
    {
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openCheckout(p);

      for (const [code,want] of [
        ['NOPE','Промокод не найден.'],
        ['EXPIRED','Срок действия промокода истёк.'],
        ['WRONGPKG','Этот промокод нельзя применить к выбранному тарифу.'],
      ]) {
        await apply(p,code);
        const err=await p.$eval('#checkout-promo',n=>n.innerText);
        ok(`[${code}] says «${want}»`, err.includes(want), err.replace(/\n/g,' ').slice(0,70));
        ok(`[${code}] and the price is untouched`, (await total(p)).includes('750'), await total(p));
      }
      const body=await p.$eval('#screen-checkout',n=>n.innerText);
      ok('no raw backend code reaches the screen',
        !/PROMO_CODE_|409|404|Error/i.test(body), (body.match(/PROMO_CODE_\w+/)||[])[0]||'clean');
      await ctx.close();
    }

    // ---- the app refuses to improvise --------------------------------
    {
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openCheckout(p);

      await apply(p,'HOSTILE');
      ok('a "valid" answer with no numbers is NOT a discount', (await total(p)).includes('750'), await total(p));
      await apply(p,'INVERTED');
      ok('a "discount" that raises the price is refused', (await total(p)).includes('750'), await total(p));
      await ctx.close();
    }

    // ---- what actually gets paid --------------------------------------
    {
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openCheckout(p);
      await apply(p,'FRIENDS10');

      await p.fill('#checkout-email','buyer@example.com');
      await p.locator('#checkout-terms').check();
      await p.waitForTimeout(300);
      await p.getByRole('button',{name:/Оплатить/}).click();
      await p.waitForTimeout(1200);

      const order=(await p.evaluate(()=>window.__calls.filter(c=>/\/tma\/orders$/.test(c.url.split('?')[0]))))[0];
      ok('the order carries the CODE, not a discount',
        order.body.promo_code==='FRIENDS10' && !('discount_amount_rub' in order.body)
        && !('final_amount_rub' in order.body), JSON.stringify(order.body.promo_code));
      ok('and expected_amount_rub is the SERVER number, not ours',
        Number(order.body.expected_amount_rub)===675, String(order.body.expected_amount_rub));
      await ctx.close();
    }

    // ---- SBP and card, and the intent that must not be reused ---------
    {
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openCheckout(p);
      await apply(p,'FRIENDS10');

      const before=await p.evaluate(()=>window.__calls.filter(c=>/promo\/quote$/.test(c.url.split('?')[0])).length);
      await p.getByRole('radio',{name:'Карта'}).click(); await p.waitForTimeout(800);
      const after=await p.evaluate(()=>window.__calls.filter(c=>/promo\/quote$/.test(c.url.split('?')[0])).length);
      ok('switching rail re-prices the code', after>before, `${before} -> ${after}`);
      const last=(await p.evaluate(()=>window.__calls.filter(c=>/promo\/quote$/.test(c.url.split('?')[0])))).pop();
      ok('and the quote carries the new payment type', last.body.payment_type==='card', last.body.payment_type);
      ok('the discount survives the switch', (await total(p)).includes('675'), await total(p));

      await p.fill('#checkout-email','buyer@example.com');
      await p.locator('#checkout-terms').check(); await p.waitForTimeout(300);
      await p.getByRole('button',{name:/Оплатить/}).click(); await p.waitForTimeout(1200);
      const order=(await p.evaluate(()=>window.__calls.filter(c=>/\/tma\/orders$/.test(c.url.split('?')[0])))).pop();
      ok('card pays the discounted amount too',
        order.body.payment_type==='card'&&Number(order.body.expected_amount_rub)===675,
        `${order.body.payment_type}/${order.body.expected_amount_rub}`);
      await ctx.close();
    }

    // ---- the email can invalidate an applied code ---------------------
    {
      const ctx=await ctxFor({emailBlocks:true}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openCheckout(p);
      await apply(p,'FRIENDS10');
      ok('[email] applied with no address yet', (await total(p)).includes('675'), await total(p));

      await p.fill('#checkout-email','used@example.com');
      await p.locator('#checkout-terms').click();   // blur -> change
      await p.waitForTimeout(900);

      ok('[email] a per-email limit drops the discount before payment',
        (await total(p)).includes('750'), await total(p));
      ok('[email] and says why', /уже использован для этого email/i.test(
        await p.$eval('#checkout-promo',n=>n.innerText)));
      await ctx.close();
    }

    // ---- promo switched off entirely ---------------------------------
    {
      const ctx=await ctxFor({promoDisabled:true}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openCheckout(p);
      await apply(p,'FRIENDS10');
      await p.waitForTimeout(400);
      ok('[off] the whole promo block disappears rather than failing forever',
        (await p.$eval('#checkout-promo',n=>n.innerText.trim()))==='' , await p.$eval('#checkout-promo',n=>n.innerText.trim()));
      ok('[off] and the price is the catalogue price', (await total(p)).includes('750'));
      await ctx.close();
    }

    // ---- layout -------------------------------------------------------
    {
      const ctx=await ctxFor({}); const p=await ctx.newPage();
      await p.goto(base); await p.waitForTimeout(2200);
      await openCheckout(p);
      const t=await p.$('.promo__toggle'); if(t) await t.click();
      await p.waitForTimeout(250);
      const m=await p.evaluate(()=>{
        const row=document.querySelector('.promo__row');
        const inp=row&&row.querySelector('.input');
        const btn=row&&row.querySelector('button');
        return {inp:inp?Math.round(inp.getBoundingClientRect().width):0,
          btn:btn?Math.round(btn.getBoundingClientRect().width):0,
          fs:inp?getComputedStyle(inp).fontSize:'',
          overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1};
      });
      ok('the field keeps real width beside the button', m.inp>150, `${m.inp}px input / ${m.btn}px button`);
      ok('the field is at least 16px so iOS does not zoom the webview', parseFloat(m.fs)>=16, m.fs);
      ok('no horizontal overflow with the promo open', !m.overflow);
      await apply(p,'FRIENDS10');
      const of=await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
      ok('nor with a discount applied', !of);
      await p.screenshot({path:`/private/tmp/claude-501/-Users-xxx-Desktop-eSim/292faf93-883b-4959-b678-8b7cdaf41e6e/scratchpad/home/promo-${eng}-${scheme}.png`,fullPage:true});
      await ctx.close();
    }

    await br.close();
  }
}
s.close();
console.log(bad?`\n${bad} FAILED`:'\nall promo checks passed');
process.exit(bad?1:0);
})();
