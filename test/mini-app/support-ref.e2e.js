/**
 * «Написать в поддержку» on an eSIM hands the support bot the ORDER it came from.
 *
 * Found in production on 2026-10-17: the eSIM screen passed `supportButton(null)`,
 * so the link was the bare bot, the bot saw a plain /start and answered with its
 * greeting — the backend's ?start=order_<ref> lookup (backend #88) never ran.
 * The button now looks the order up in /me/orders (`esim_id` → public token) and
 * sends the last six characters, the same ref every other support link carries.
 *
 *   node test/mini-app/support-ref.e2e.js
 */
const http=require('http'),fs=require('fs'),path=require('path');
const pw=require('playwright');
const APP=path.join(__dirname,'..','..','app');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
let bad=0; const ok=(l,c,d='')=>{if(!c)bad++;console.log(`   ${c?'ok  ':'FAIL'} ${l}${d?'  — '+d:''}`);};
const BOT='https://t.me/magic_esim_support_bot';

function mock(cfg){
  window.__calls=[]; window.__opened=[];
  window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
    initDataUnsafe:{user:{language_code:cfg.lang||'ru'}},ready(){},expand(){},close(){},colorScheme:'light',platform:'ios',
    themeParams:{},setBackgroundColor(){},setHeaderColor(){},onEvent(){},
    BackButton:{show(){},hide(){},onClick(){},offClick(){}},
    HapticFeedback:{impactOccurred(){},notificationOccurred(){}},
    openLink(u){window.__opened.push(String(u));}}};
  const esims={
    e1:{id:'e1',status:'active',country_code:'TR',package_name:'Turkey 3GB 15Days',usage_state:'available',
        remaining_gb:2.1,total_gb:3,expires_at:'2026-12-01T00:00:00Z',last_usage_sync_at:'2026-10-17T09:00:00Z',display_name:null,hidden:false},
    e2:{id:'e2',status:'active',country_code:'TH',package_name:'Thailand 5GB 15Days',usage_state:'available',
        remaining_gb:4,total_gb:5,expires_at:'2026-11-01T00:00:00Z',last_usage_sync_at:'2026-10-17T09:00:00Z',display_name:null,hidden:false},
  };
  const orders=[
    {public_order_token:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaAB12cd',display_status:'completed',package_name:'Turkey 3GB 15Days',country_code:'TR',amount_rub:550,currency:'RUB',created_at:'2026-10-01T00:00:00Z',esim_id:'e1'},
    {public_order_token:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbZZ99zz',display_status:'canceled',package_name:'Best World 10 GB',country_code:'AL',amount_rub:5000,currency:'RUB',created_at:'2026-09-01T00:00:00Z',esim_id:null},
  ];
  const j=(b,s=200)=>Promise.resolve(new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json'}}));
  window.fetch=(u,o)=>{u=String(u); const p=u.split('?')[0];
    window.__calls.push({url:u,method:(o&&o.method)||'GET'});
    if(u.includes('catalog.json'))return j({schema_version:1,generated_at:'x',package_count:0,packages:[]});
    if(u.includes('/tma/session'))return j({session_token:'m',expires_in:1800});
    if(u.includes('/retail/packages'))return j({status:'success',count:0,currency:'RUB',data:[]});
    if(/\/me\/orders\/active$/.test(p))return j({items:[]});
    if(/\/me\/orders$/.test(p))return cfg.ordersFail?j({error:'INTERNAL',message:'x'},500):j({items:orders});
    if(/\/tma\/esims\/hidden$/.test(p))return j({items:[]});
    if(/\/tma\/esims\/[^/?]+\/topups$/.test(p))return j({topup_available:false,topup_options:[],purchase_enabled:false});
    const one=/\/tma\/esims\/([^/]+)$/.exec(p);
    if(one&&esims[one[1]])return j(esims[one[1]]);
    if(u.includes('/tma/esims'))return j({items:Object.values(esims)});
    return j({items:[]});};
}

(async()=>{
const s=http.createServer((q,r)=>{const u=q.url.split('?')[0];const n=u==='/'?'/index.html':u;
const root=n.startsWith('/assets/')?path.join(APP,'..'):APP;
fs.readFile(path.join(root,n),(e,b)=>{if(e)return r.writeHead(404).end();r.writeHead(200,{'content-type':T[path.extname(n)]||'text/plain'});r.end(b);});});
await new Promise(r=>s.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${s.address().port}/index.html`;

const openEsim=async(p,i)=>{
  await p.tap('#nav-esims'); await p.waitForTimeout(800);
  await p.locator('#esims-list button.card').nth(i).click(); await p.waitForTimeout(900);
};
const tapSupport=async(p)=>{
  await p.locator('#screen-esim').getByRole('button',{name:'Написать в поддержку'}).click(); await p.waitForTimeout(200);
  return p.evaluate(()=>window.__opened[window.__opened.length-1]);
};

for (const eng of ['webkit','chromium']) {
  const br=await pw[eng].launch();
  console.log(`\n── ${eng} · 390px ──`);
  const ctxFor=async(cfg={})=>{
    const ctx=await br.newContext({...pw.devices['iPhone 13']});
    await ctx.route('https://telegram.org/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    await ctx.addInitScript(mock,cfg);
    return ctx;
  };

  {
    const ctx=await ctxFor(); const p=await ctx.newPage();
    await p.goto(base); await p.waitForTimeout(2200);
    await openEsim(p,0);
    const url=await tapSupport(p);
    ok('the eSIM bought in an order opens the support bot WITH that order\'s ref', url===`${BOT}?start=order_AB12cd`, url);
    ok('only the last six characters travel, never the whole token', !String(url).includes('aaaaaaaa'), url);

    await openEsim(p,1);
    const plain=await tapSupport(p);
    ok('an eSIM with no order in the list opens the bot exactly as before', plain===BOT, plain);

    const calls=await p.evaluate(()=>window.__calls.filter(c=>/\/me\/orders$/.test(c.url.split('?')[0])).length);
    ok('the order list is read once per session, not per eSIM', calls===1, String(calls));
    await ctx.close();
  }

  {
    const ctx=await ctxFor({ordersFail:true}); const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(base); await p.waitForTimeout(2200);
    await openEsim(p,0);
    const url=await tapSupport(p);
    ok('if /me/orders fails, the button still opens the bot (without a ref)', url===BOT, url);
    ok('and nothing throws', errs.length===0, errs.join(' | '));
    await ctx.close();
  }
  await br.close();
}
s.close();
console.log(bad?`\n${bad} FAILED`:'\nall passed');
process.exit(bad?1:0);
})();
