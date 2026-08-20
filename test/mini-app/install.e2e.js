/**
 * S10 · the installation screen, on a phone.
 *
 * WHY THIS FILE EXISTS. On a real iPhone the SM-DP+ address and the activation
 * code rendered as tall narrow towers — one character per line. Measured at
 * 390px in both engines before the fix: the `code` box was 0px wide and 377px
 * tall for a twenty-character host, and 1285px tall for an LPA. Three CSS rules
 * had to meet for that (see the CopyField block in mini.css), and none of them
 * is visibly wrong on its own, which is exactly why a layout assertion has to
 * exist rather than a careful reading of the stylesheet.
 *
 * Everything here is measured in a real browser at a real width. No backend is
 * contacted; the endpoints are faked at the network edge.
 *
 *   node test/mini-app/install.e2e.js
 */
const http=require('http'),fs=require('fs'),path=require('path');
const pw=require('playwright');
const APP=path.join(__dirname,'..','..','app');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
let bad=0; const ok=(l,c,d='')=>{if(!c)bad++;console.log(`   ${c?'ok  ':'FAIL'} ${l}${d?'  — '+d:''}`);};

// Deliberately awkward values: a long provisioning host and a long activation
// code are the two that broke, and a short one must not regress either.
const SMDP='rsp-eu.simlessly.com';
const SMDP_LONG='rsp-provisioning-eu-central-1.consumer.simlessly-telecom.example.com';
const CODE='K2-1MRT4X-8QW3ZP9';
const CODE_LONG='K2-1MRT4X-8QW3ZP9-AA11BB22CC33DD44EE55FF66GG77HH88';
const LPA=`LPA:1$${SMDP}$${CODE}`;
const vals=(long)=>({smdp:long?SMDP_LONG:SMDP, code:long?CODE_LONG:CODE, lpa:LPA});

function mock(cfg){
  window.__requests=[];
  window.__clip=[];
  window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
    initDataUnsafe:{},ready(){},expand(){},close(){},colorScheme:cfg.scheme||'light',
    platform:cfg.platform||'ios',
    themeParams:cfg.scheme==='dark'?{bg_color:'#17212b'}:{},
    setBackgroundColor(){},setHeaderColor(){},onEvent(){},
    BackButton:{show(){},hide(){},onClick(){},offClick(){}},
    HapticFeedback:{impactOccurred(){},notificationOccurred(){}},openLink(u){window.__opened=u;}}};

  // The clipboard is permission-gated in a real WebView; record instead.
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
    writeText:(t)=>{window.__clip.push(t);return cfg.clipboardFails?Promise.reject(new Error('denied')):Promise.resolve();}}});

  const j=(b,s=200)=>Promise.resolve(new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json'}}));
  const ESIM={id:'e1',status:'ready',package_name:'Turkey 3GB 15Days',country_code:'TR',
    data_gb:3,validity_days:15,expires_at:'2026-12-01T00:00:00Z',
    total_volume_bytes:3221225472,used_volume_bytes:1073741824,
    remaining_volume_bytes:2147483648,usage_state:'known'};
  window.fetch=(u,o)=>{u=String(u);
    window.__requests.push({url:u,body:o&&o.body?JSON.parse(o.body):null});
    if(u.includes('catalog.json'))return j({schema_version:1,generated_at:'2026-08-20T00:00:00Z',package_count:0,packages:[]});
    if(u.includes('/tma/session'))return j({session_token:'m',expires_in:1800});
    if(u.includes('/retail/packages'))return j({status:'success',count:0,currency:'RUB',data:[]});
    if(/\/activation$/.test(u.split('?')[0]))return j({
      activation_policy:'first_use',
      // Values arrive through cfg: addInitScript serialises this function, so a
      // reference to a constant in the enclosing module would be undefined here
      // and the whole handler would throw where nobody was looking.
      smdp_address:cfg.smdp,
      activation_code:cfg.code,
      lpa:cfg.lpa, iccid:'8931080000000000123',
      qr_png_base64:null,
      install:cfg.install||{}});
    if(/\/tma\/esims\/[^/?]+\/topups$/.test(u.split('?')[0]))
      return j(cfg.topups||{topup_available:false,topup_options:[],purchase_enabled:false});
    if(/\/tma\/esims\/[^/?]+$/.test(u.split('?')[0]))return j(ESIM);
    if(u.includes('/tma/esims'))return j({items:[ESIM]});
    if(u.includes('/me/orders'))return j({items:[]});
    return j({items:[]});};
}

(async()=>{
const s=http.createServer((q,r)=>{const u=q.url.split('?')[0];const n=u==='/'?'/index.html':u;
const root=n.startsWith('/assets/')?path.join(APP,'..'):APP;
fs.readFile(path.join(root,n),(e,b)=>{if(e)return r.writeHead(404).end();r.writeHead(200,{'content-type':T[path.extname(n)]||'text/plain'});r.end(b);});});
await new Promise(r=>s.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${s.address().port}/index.html`;

const openInstall = async (p) => {
  await p.tap('#nav-esims');
  await p.waitForTimeout(800);
  // The list card is itself the button into S9; S10 is one more tap from there.
  await p.locator('#esims-list button.card').first().click();
  await p.waitForTimeout(800);
  await p.getByRole('button',{name:/Установка и QR/}).click();
  await p.waitForTimeout(800);
};

// The measurement that would have caught the towers. A field is HEALTHY when
// its value occupies one line and the page does not scroll sideways.
const measure = (p) => p.$$eval('.copyfield', (nodes) => nodes.map((n) => {
  const c = n.querySelector('code');
  const b = n.querySelector('button');
  const cs = getComputedStyle(c);
  const lh = parseFloat(cs.lineHeight) || 16;
  return {
    label: (n.previousElementSibling && n.previousElementSibling.textContent) || '',
    fieldW: Math.round(n.getBoundingClientRect().width),
    fieldH: Math.round(n.getBoundingClientRect().height),
    codeW: Math.round(c.getBoundingClientRect().width),
    lines: Math.round(c.getBoundingClientRect().height / lh),
    btnW: Math.round(b.getBoundingClientRect().width),
    whiteSpace: cs.whiteSpace,
    overflowWrap: cs.overflowWrap,
    wordBreak: cs.wordBreak,
    overflowX: cs.overflowX,
    scrollable: c.scrollWidth > c.clientWidth + 1,
  };
}));

for (const eng of ['webkit','chromium']) {
  for (const scheme of ['light','dark']) {
    const br=await pw[eng].launch();
    console.log(`\n── ${eng} · ${scheme} · 390px ──`);

    // ---- the layout, short values and long ones ------------------------
    for (const long of [false, true]) {
      const ctx=await br.newContext({...pw.devices['iPhone 13'],colorScheme:scheme});
      await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
      await ctx.addInitScript(mock,{scheme,long,...vals(long)});
      const p=await ctx.newPage(); await p.goto(base); await p.waitForTimeout(2000);
      await openInstall(p);

      const fields=await measure(p);
      const which = long ? 'long' : 'short';
      ok(`[${which}] the manual-entry fields are on screen`, fields.length>=3, `${fields.length} fields`);

      // THE regression. One line, always — never a tower.
      const towers=fields.filter(f=>f.lines>1);
      ok(`[${which}] every value is on ONE line`, towers.length===0,
        towers.map(f=>`${f.label.trim()}: ${f.lines} lines`).join(', ') || `all ${fields.length} single-line`);

      // A field that is one line but 0px wide is the same bug wearing a hat.
      const slivers=fields.filter(f=>f.codeW<120);
      ok(`[${which}] the value gets real width, not a sliver`, slivers.length===0,
        slivers.map(f=>`${f.label.trim()}: ${f.codeW}px`).join(', ') || `${(fields[0]||{}).codeW}px each`);

      // Compact: a one-line field on a phone is one row tall, not a block.
      const tall=fields.filter(f=>f.fieldH>60);
      ok(`[${which}] the fields are compact`, tall.length===0,
        tall.map(f=>`${f.fieldH}px`).join(', ') || `${(fields[0]||{}).fieldH}px each`);

      // The button must not claim the row — this is what `.btn { width:100% }`
      // used to do, and it is the root cause rather than a symptom.
      const greedy=fields.filter(f=>f.btnW>f.fieldW*0.5);
      ok(`[${which}] the copy button takes its own width, not the row's`, greedy.length===0,
        `button ${(fields[0]||{}).btnW}px of ${(fields[0]||{}).fieldW}px`);

      // The declarations themselves, so a future rule cannot quietly undo this.
      const wrong=fields.filter(f=>f.whiteSpace!=='nowrap'||f.overflowWrap==='anywhere'||f.wordBreak==='break-all');
      ok(`[${which}] no per-character break opportunity survives in the CSS`, wrong.length===0,
        wrong.map(f=>`${f.whiteSpace}/${f.overflowWrap}/${f.wordBreak}`).join(', ')
          || `${(fields[0]||{}).whiteSpace}/${(fields[0]||{}).overflowWrap}/${(fields[0]||{}).wordBreak}`);

      // The overflow is contained in the FIELD. That is the whole trade: the
      // value scrolls inside its box so the page never scrolls under it.
      const of=await p.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
      ok(`[${which}] the page has no horizontal overflow`, !of);
      if (long) {
        ok('[long] a value too wide to fit scrolls inside its own field',
          fields.some(f=>f.overflowX==='auto'&&f.scrollable));
      } else {
        // The stated requirement: a REAL SM-DP+ host — `rsp-eu.simlessly.com`,
        // twenty characters — must be readable whole, with nothing to scroll
        // and nothing cut off. Only a genuinely long value may scroll.
        const smdp=fields[0];
        ok('[short] a real SM-DP+ host fits entirely, with nothing to scroll',
          !smdp.scrollable, `${smdp.codeW}px field`);
      }

      await p.screenshot({path:`/private/tmp/claude-501/-Users-xxx-Desktop-eSim/292faf93-883b-4959-b678-8b7cdaf41e6e/scratchpad/ui/install-${eng}-${scheme}-${which}.png`,fullPage:true});
      await ctx.close();
    }

    // ---- copying ------------------------------------------------------
    {
      const ctx=await br.newContext({...pw.devices['iPhone 13'],colorScheme:scheme});
      await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
      await ctx.addInitScript(mock,{scheme,long:true,...vals(true)});
      const p=await ctx.newPage(); await p.goto(base); await p.waitForTimeout(2000);
      await openInstall(p);

      const btn=p.locator('.copyfield__copy').first();
      const before=await btn.textContent();
      await btn.click();
      await p.waitForTimeout(200);

      const clipped=await p.evaluate(()=>window.__clip);
      ok('the value is copied VERBATIM, whole', clipped.length===1&&clipped[0]===SMDP_LONG,
        JSON.stringify(clipped[0]||null));
      ok('it copies the value, not what the DOM wrapped', !/\s/.test(clipped[0]||' '));
      ok('the button says «Скопировано»', (await btn.textContent())==='Скопировано', before);

      await p.waitForTimeout(1700);
      ok('and goes back to «Копировать»', (await btn.textContent())==='Копировать');

      // A denied clipboard must not claim a copy that did not happen.
      await ctx.close();
      const ctx2=await br.newContext({...pw.devices['iPhone 13'],colorScheme:scheme});
      await ctx2.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
      await ctx2.addInitScript(mock,{scheme,clipboardFails:true,...vals(false)});
      const p2=await ctx2.newPage(); await p2.goto(base); await p2.waitForTimeout(2000);
      await openInstall(p2);
      const btn2=p2.locator('.copyfield__copy').first();
      await btn2.click(); await p2.waitForTimeout(200);
      ok('a refused clipboard does NOT say «Скопировано»', (await btn2.textContent())!=='Скопировано',
        await btn2.textContent());
      await ctx2.close();
    }

    // ---- every action on the screen is a real control -------------------
    {
      const ctx=await br.newContext({...pw.devices['iPhone 13'],colorScheme:scheme});
      await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
      await ctx.addInitScript(mock,{scheme,...vals(false),
        install:{ios_url:'https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=PROVIDER',
                 android_url:'https://esimsetup.android.com/esim_qrcode_provisioning?carddata=PROVIDER'}});
      const p=await ctx.newPage(); await p.goto(base); await p.waitForTimeout(2000);
      await openInstall(p);

      const names=await p.$$eval('#screen-install button',ns=>ns.map(n=>n.innerText.replace(/\s+/g,' ').trim()));
      ok('the device picker is two real buttons', names.some(n=>/iPhone/.test(n))&&names.some(n=>/Android/.test(n)),
        names.filter(n=>/iPhone|Android/.test(n)).join(' | '));
      ok('one-click install is a button', names.some(n=>/Установить на этом/.test(n)),
        names.find(n=>/Установить/.test(n))||'');
      ok('support is a button, not a line of text', names.some(n=>/поддержку/i.test(n)));
      ok('every copy field has its own button', (await p.$$('.copyfield__copy')).length>=3);

      // It must open the PROVIDER's link, not one we assembled.
      await p.getByRole('button',{name:/Установить на этом/}).click();
      await p.waitForTimeout(200);
      const opened=await p.evaluate(()=>window.__opened);
      ok('one-click uses the provider\'s own URL when there is one',
        String(opened).includes('carddata=PROVIDER'), String(opened).slice(0,60));

      // Instructions are steps, and both sets are reachable.
      await p.getByRole('radio',{name:/Android/}).click();
      await p.waitForTimeout(300);
      const steps=await p.$$eval('#screen-install .steps li',ns=>ns.length);
      ok('Android instructions are a numbered list', steps>=4, `${steps} steps`);
      await p.getByRole('radio',{name:/iPhone/}).click();
      await p.waitForTimeout(300);
      ok('iPhone instructions come back', (await p.$$eval('#screen-install .steps li',ns=>ns.length))>=4);

      // Nothing raw leaks onto the screen.
      //
      // NOT a check for the string "LPA:" — the LPA is the value a customer
      // types into their phone by hand, and it belongs here. What must never
      // appear is a placeholder that escaped: an empty binding, a stringified
      // object, or an internal identifier with no label around it.
      const body=await p.$eval('#screen-install',n=>n.innerText);
      ok('no placeholder or stringified object leaked onto the screen',
        !/\bnull\b|\bundefined\b|\[object |NaN/i.test(body),
        (body.match(/\bnull\b|\bundefined\b|\[object |NaN/i)||[])[0]||'clean');
      ok('every value on screen carries a label', (await p.$$eval('.copyfield',ns=>ns.every(
        n=>n.previousElementSibling&&n.previousElementSibling.textContent.trim().length>0))));
      await ctx.close();
    }

    // ---- no provider link, and no LPA: nothing is invented ---------------
    {
      const ctx=await br.newContext({...pw.devices['iPhone 13'],colorScheme:scheme});
      await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
      await ctx.addInitScript(mock,{scheme,platform:'android',install:{},...vals(false)});
      const p=await ctx.newPage(); await p.goto(base); await p.waitForTimeout(2000);
      await openInstall(p);
      await p.getByRole('radio',{name:/Android/}).click();
      await p.waitForTimeout(300);
      const names=await p.$$eval('#screen-install button',ns=>ns.map(n=>n.innerText.replace(/\s+/g,' ').trim()));
      ok('no provider link on Android -> no invented one-click button',
        !names.some(n=>/Установить на этом Android/.test(n)),
        names.filter(n=>/Установить/.test(n)).join(' | ')||'none, correct');
      await ctx.close();
    }

    await br.close();
  }
}
s.close();
console.log(bad?`\n${bad} FAILED`:'\nall S10 install checks passed');
process.exit(bad?1:0);
})();
