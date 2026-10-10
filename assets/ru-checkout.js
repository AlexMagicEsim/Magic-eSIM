/* assets/ru-checkout.js — the Russian checkout (Platega: SBP / Russian card,
 * promo, email, consent, idempotency, attribution, price confirmation for a
 * card shown from the cached catalogue).
 *
 * Moved VERBATIM out of index.html's inline script (2026-10-10, RU↔EN parity,
 * migration PR A), so the country pages can open the same checkout later
 * (PR B). Nothing in it changed: the IIFE below is byte-identical to the block
 * that ended the inline script.
 *
 * It is a CLASSIC, SYNCHRONOUS script loaded right after the inline one, so it
 * runs at the same moment the block used to run and sees the same top-level
 * names the inline script declares (catalogSource, allLandingPackages,
 * activeCountry, renderPackages, renderCountryChips, hideCatalogNotice,
 * catalogNoticeEl, retryLiveCatalog, checkoutDataLabel…) and the globals of
 * the earlier scripts (MagicNet, MagicCatalog, magicMetrikaGoal). Never load it
 * with defer/async or as a module: either would change when it runs, and a
 * module would not see those names. Versioned by seo/stamp-assets.mjs. */
// ===== On-site checkout modal (оформление заказа; оплата — заглушка до подключения платёжной системы) =====
(function(){
  const overlay=document.getElementById('checkoutModal');
  if(!overlay)return;
  const byId=(id)=>document.getElementById(id);
  let submitting=false;
  // ---- Promo code (Phase 2). Backend is authoritative: the client only sends the
  // code + package; the discount/final are always recomputed server-side. ----
  let appliedPromo=null;      // { code, original, discount, final }
  let promoDisabled=false;    // backend reported PROMO_CODES_DISABLED -> hide the field
  let quoting=false;
  const PROMO_MSG={PROMO_CODES_DISABLED:'Промокоды сейчас недоступны.',PROMO_CODE_INVALID:'Проверьте формат промокода.',PROMO_CODE_NOT_FOUND:'Промокод не найден.',PROMO_CODE_NOT_ACTIVE:'Промокод недоступен.',PROMO_CODE_NOT_STARTED:'Промокод ещё не действует.',PROMO_CODE_EXPIRED:'Срок действия промокода истёк.',PROMO_CODE_LIMIT_REACHED:'Лимит использований промокода исчерпан.',PROMO_CODE_EMAIL_LIMIT_REACHED:'Этот промокод уже использован для этого email.',PROMO_CODE_FIRST_PURCHASE_ONLY:'Промокод действует только для первой покупки.',PROMO_CODE_MIN_ORDER:'Сумма заказа меньше необходимой для этого промокода.',PROMO_CODE_NOT_APPLICABLE:'Этот промокод нельзя применить к выбранному тарифу.',PROMO_CODE_NOT_AVAILABLE:'Этот промокод недоступен.',RATE_LIMITED:'Слишком много попыток. Попробуйте чуть позже.'};
  const rub=(n)=>`${Number(n).toLocaleString('ru-RU')} ₽`;
  function basePrice(){const p=overlay.dataset.priceRub;return (p!==''&&isFinite(Number(p)))?Number(p):null;}
  function currentPrice(){return appliedPromo?appliedPromo.final:basePrice();}
  function promoMsg(text,kind){const m=byId('coPromoMsg');if(!m)return;if(!text){m.hidden=true;m.textContent='';return;}m.textContent=text;m.className='co-promo-msg'+(kind?(' '+kind):'');m.hidden=false;}
  // Single source of truth for the promo rows: shown ONLY when a promo is really
  // applied with a positive discount. Toggle inline display (not just [hidden]) because
  // .checkout-rows>div / .co-promo-applied set display:flex, which would otherwise
  // override [hidden] and leave a stale "−115 ₽" row / applied block on screen.
  function showRow(el,visible){ if(!el)return; el.hidden=!visible; el.style.display=visible?'':'none'; }
  function renderPrice(){
    const base=basePrice(),summary=overlay.querySelector('.checkout-summary');
    const origRow=byId('coOrigRow'),discRow=byId('coDiscRow'),applied=byId('coPromoApplied');
    const promoActive=!!(appliedPromo && Number(appliedPromo.discount)>0);
    if(promoActive){
      byId('coOrigPrice').textContent=rub(appliedPromo.original);
      byId('coDiscAmount').textContent='−'+rub(appliedPromo.discount);
      byId('coPrice').textContent=rub(appliedPromo.final);
      byId('coPromoAppliedText').textContent=`Промокод ${appliedPromo.code} применён`;
      showRow(origRow,true); showRow(discRow,true); showRow(applied,true);
      if(summary)summary.classList.add('co-has-promo');
    }else{
      showRow(origRow,false); showRow(discRow,false); showRow(applied,false);
      byId('coPrice').textContent=(base!=null)?rub(base):'—';
      if(summary)summary.classList.remove('co-has-promo');
    }
  }
  // Drop any applied promo and force a fresh quote (package/email change, or a
  // rejected order-create). Never leaves a stale discount on screen.
  function resetPromo(msg){appliedPromo=null;const inp=byId('coPromoInput');if(inp&&msg==null)inp.value='';const btn=byId('coPromoApply');if(btn){btn.disabled=false;btn.textContent='Применить';}promoMsg(msg||'',msg?'co-err':null);renderPrice();}
  async function applyPromo(){
    if(quoting||promoDisabled)return;
    const inp=byId('coPromoInput');const code=((inp&&inp.value)||'').trim().toUpperCase();
    const pkgId=(overlay.dataset.packageId||'').trim();
    if(inp)inp.value=code;
    if(!code){promoMsg('Введите промокод.','co-err');return;}
    if(!pkgId){promoMsg('Сначала выберите тариф.','co-err');return;}
    const btn=byId('coPromoApply');quoting=true;if(btn){btn.disabled=true;btn.textContent='Проверяем…';}
    promoMsg('',null);
    try{
      const emailEl=byId('coEmail');const email=(emailEl&&/.+@.+\..+/.test(emailEl.value.trim()))?emailEl.value.trim():undefined;
      /* A POST, but semantically a READ: the server computes a preview and the
         only row it writes is a funnel attempt for analytics. So it carries the
         read timeout and may be re-asked on the second endpoint — the worst a
         repeat can cost is one extra analytics row. The discount itself is
         still whatever the SERVER says; nothing here recomputes a price. */
      const resp=await MagicNet.request('/api/v1/retail/promo/quote',{
        method:'POST',kind:'read',idempotent:true,
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({promo_code:code,package_id:pkgId,payment_type:selectedMethod,email:email})});
      const data=resp.body||{};
      if(resp.ok&&data&&data.valid){
        appliedPromo={code:data.promo_code||code,original:Number(data.original_amount_rub),discount:Number(data.discount_amount_rub),final:Number(data.final_amount_rub)};
        renderPrice();
        try{magicMetrikaGoal('promo_apply_success',{country_code:(typeof activeCountry!=='undefined'?activeCountry:''),package_id:(overlay&&overlay.dataset?overlay.dataset.packageId:undefined),promo_code:appliedPromo?appliedPromo.code:undefined,discount_amount:(appliedPromo&&isFinite(Number(appliedPromo.discount)))?Number(appliedPromo.discount):undefined});}catch(e){}
      }else if(data&&data.error==='PROMO_CODES_DISABLED'){
        promoDisabled=true;const w=byId('coPromoWrap');if(w)w.hidden=true;resetPromo();
      }else{
        appliedPromo=null;renderPrice();
        promoMsg((data&&(PROMO_MSG[data.error]||data.message))||'Не удалось применить промокод.','co-err');
        try{magicMetrikaGoal('promo_apply_error',{country_code:(typeof activeCountry!=='undefined'?activeCountry:''),package_id:(overlay&&overlay.dataset?overlay.dataset.packageId:undefined)});}catch(e){}
      }
    }catch(e){promoMsg('Не удалось проверить промокод. Попробуйте позже.','co-err');}
    finally{quoting=false;if(btn){btn.disabled=false;btn.textContent='Применить';}}
  }
  // Silent re-validation of the ALREADY-applied promo (e.g. after the email changes,
  // since per-email/first-purchase limits depend on it). Keeps the discount if still
  // valid; removes it with a clear message if the email makes it ineligible. On a
  // network error we keep the current promo — the backend re-validates again at
  // order creation, so the charged amount can never disagree with a stale UI.
  async function revalidatePromo(){
    if(!appliedPromo||quoting||promoDisabled)return;
    const code=appliedPromo.code;
    const pkgId=(overlay.dataset.packageId||'').trim();
    if(!pkgId)return;
    const emailEl=byId('coEmail');const email=(emailEl&&/.+@.+\..+/.test(emailEl.value.trim()))?emailEl.value.trim():undefined;
    try{
      const resp=await MagicNet.request('/api/v1/retail/promo/quote',{
        method:'POST',kind:'read',idempotent:true,
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({promo_code:code,package_id:pkgId,payment_type:selectedMethod,email:email})});
      const data=resp.body||{};
      if(resp.ok&&data&&data.valid){
        appliedPromo={code:data.promo_code||code,original:Number(data.original_amount_rub),discount:Number(data.discount_amount_rub),final:Number(data.final_amount_rub)};
        promoMsg('',null);renderPrice();
      }else if(data&&data.error==='PROMO_CODES_DISABLED'){
        promoDisabled=true;const w=byId('coPromoWrap');if(w)w.hidden=true;resetPromo();
      }else{
        // Ineligible for this email (per-email limit / first-purchase): drop the
        // discount + show why. The code stays in the field, so the pay guard blocks
        // checkout until the user removes it or fixes the email.
        resetPromo((data&&(PROMO_MSG[data.error]||data.message))||'Промокод недоступен для этого email.');
      }
    }catch(e){/* network error: keep the applied promo; backend re-validates at payment */}
  }
  /**
   * Что стоит в строке «Интернет».
   *
   * У дневного тарифа data_gb равен NULL — это не пропуск, а модель: объём
   * задан на СУТКИ, и общий объём зависит от выбранного срока, поэтому
   * колонка пуста намеренно. Сводка читала только data_gb и показывала «—»
   * там, где дневной объём прекрасно известен.
   *
   * Формат берётся из общего модуля, а не собирается здесь: «500 МБ в день»
   * на карточке и в чеке должны читаться одинаково, и 0.49 ГБ поставщика
   * округляет один и тот же код.
   */
  function checkoutDataLabel(d){
    if(d&&d.planType==='DAILY'){
      const D=dailyCopy();
      const gb=Number(d.dailyGb);
      if(D&&isFinite(gb)&&gb>0) return `${D.formatAllowance(gb)} в день`;
      return '—';
    }
    return d&&d.data?`${d.data} GB`:'—';
  }

  function openCheckout(d){
    byId('coPlanName').textContent=d.name||'eSIM-тариф';
    byId('coCoverage').textContent=d.coverage||'—';
    byId('coData').textContent=checkoutDataLabel(d);
    byId('coDays').textContent=d.days?`${d.days} дн.`:'—';
    byId('coPrice').textContent=d.price?`${Number(d.price).toLocaleString('ru-RU')} ₽`:'—';
    overlay.dataset.packageId=d.packageId||'';
    overlay.dataset.priceRub=(d.price!=null&&d.price!=='')?String(Number(d.price)):'';
    // Срок хранится только для тарифов с дневным лимитом; у обычного пакета
    // его нет, и в заказ он не уедет.
    overlay.dataset.days=d.planType==='DAILY'&&d.days?String(d.days):'';
    coIdemNewSession(); // a freshly opened checkout is a NEW intent, never a replay
    resetPromo();  // package changed -> drop any prior promo, show base price
    magicMetrikaGoal('checkout_open',{country_code:(typeof activeCountry!=='undefined'?activeCountry:''),package_id:d.packageId,price_rub:d.price});
    byId('coError').hidden=true;
    byId('coResult').hidden=true;
    submitting=false;
    const pay=byId('coPay');if(pay)pay.disabled=false;setMethod('sbp'); // reset to default method on open
    overlay.hidden=false;
    document.body.style.overflow='hidden';
    setTimeout(()=>{const e=byId('coEmail');if(e)e.focus();},40);
  }
  function closeCheckout(){overlay.hidden=true;document.body.style.overflow='';}
  document.addEventListener('click',async (ev)=>{
    const b=ev.target.closest('.js-buy');
    if(!b)return;
    ev.preventDefault();
    magicMetrikaGoal('tariff_buy_click',{country_code:(typeof activeCountry!=='undefined'?activeCountry:''),package_id:b.dataset.packageId,price_rub:b.dataset.price,data_gb:b.dataset.data,validity_days:b.dataset.days,tariff_type:b.closest('#regionalGrid')?'regional':'local'});

    const d={packageId:b.dataset.packageId,name:b.dataset.name,coverage:b.dataset.coverage,data:b.dataset.data,dailyGb:b.dataset.dailyGb,days:b.dataset.days,price:b.dataset.price,planType:b.dataset.planType};

    // A card rendered from the live API is already current — open as before.
    if(catalogSource!=='cache'){openCheckout(d);return;}

    /* From the cache the price and availability are provisional, so confirm both
       against the backend before anything can be paid. No cache fallback here on
       purpose: if the backend cannot be reached, an order cannot be created, so
       checkout must not open at all. The catalogue itself stays on screen. */
    const label=b.textContent;
    b.disabled=true;b.textContent='Проверяем цену…';
    try{
      const check=await window.MagicCatalog.revalidatePackage(d.packageId,Number(d.price));
      if(!check.ok){
        showCheckoutBlocked(check.reason);
        return;
      }
      // The live list came back with this request — take the whole thing, so the
      // page stops being stale the moment the network recovers.
      allLandingPackages=check.packages;
      window.allLandingPackages=allLandingPackages;
      catalogSource='live';
      catalogGeneratedAt=null;
      hideCatalogNotice();
      renderCountryChips();
      renderPackages();

      d.price=String(check.pkg.price);
      d.name=check.pkg.name||d.name;
      openCheckout(d);
      if(check.priceChanged)showPriceChanged(check.previousPrice,Number(check.pkg.price));
    }finally{
      b.disabled=false;b.textContent=label;
    }
  });

  /* Checkout could not be opened. Says which of the two things went wrong rather
     than a generic failure, and never claims the tariff does not exist. */
  function showCheckoutBlocked(reason){
    const el=(typeof catalogNoticeEl==='function')?catalogNoticeEl():null;
    const msg=reason==='gone'
      ? 'Этот тариф больше недоступен. Обновите каталог и выберите другой — мы не начали оформление.'
      : 'Оформление сейчас недоступно: нет связи с сервером. Попробуйте другую сеть, включите VPN или повторите позже.';
    if(el){
      el.innerHTML='';
      const t=document.createElement('span');t.className='catalog-notice-text';t.textContent=msg;
      const btn=document.createElement('button');btn.type='button';btn.className='btn secondary catalog-notice-btn';btn.id='catalogRetryBtn';btn.textContent='Повторить загрузку';
      btn.addEventListener('click',retryLiveCatalog);
      el.appendChild(t);el.appendChild(btn);el.hidden=false;
      el.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
    try{magicMetrikaGoal('catalog_load_failed',{page_type:'landing',error_type:reason==='gone'?'package_gone':'checkout_unreachable'});}catch(e){}
  }

  /* The cached figure differed from the server's. The user sees the real amount
     in the checkout before paying; this only explains why it moved. */
  function showPriceChanged(oldPrice,newPrice){
    const err=byId('coError');
    if(!err)return;
    err.textContent=`Цена этого тарифа изменилась: было ${Number(oldPrice).toLocaleString('ru-RU')} ₽, актуальная — ${Number(newPrice).toLocaleString('ru-RU')} ₽. К оплате будет актуальная сумма.`;
    err.hidden=false;
  }
  const x=byId('checkoutClose');if(x)x.addEventListener('click',closeCheckout);
  overlay.addEventListener('click',(ev)=>{if(ev.target===overlay)closeCheckout();});
  document.addEventListener('keydown',(ev)=>{if(ev.key==='Escape'&&!overlay.hidden)closeCheckout();});
  function allowedRedirect(u){
    try{const url=new URL(u);const host=url.host;return url.protocol==='https:'&&(/(^|\.)platega\.io$/i.test(host)||/(^|\.)magicesim\.store$/i.test(host));}catch(e){return false;}
  }
  /* Checkout idempotency key (TD-08). One purchase INTENT -> one key: a double
     tap, a network timeout and a retry after an error all resend the SAME key,
     so the backend returns the first order instead of creating a second one.
     The key is regenerated when the intent itself changes — a different
     package, payment method, email or promo (exactly the fields the backend
     fingerprints) — and when the checkout modal is opened fresh, so buying the
     same tariff twice ON PURPOSE is two intents, not one replay.
     The key is random, never derived from the email or anything personal. */
  let coIdem=null; // {tuple, key} for the current modal session
  function coIdemNewSession(){coIdem=null;}
  function coIdemKeyFor(pkgId,method,email,promo,days){
    // `days` входит в кортеж, и это не украшение: два срока одного тарифа —
    // два разных заказа на разные суммы. Без него выбор 30 дней после 7
    // переиспользовал бы ключ первого намерения, и бэкенд справедливо вернул
    // бы первый заказ вместо нового.
    const tuple=[pkgId,method,String(email||'').trim().toLowerCase(),String(promo||'').trim().toUpperCase(),String(days||'')].join('|');
    if(!coIdem||coIdem.tuple!==tuple){
      let key='';
      try{if(window.crypto&&crypto.randomUUID)key=crypto.randomUUID();}catch(e){}
      if(!key){
        const a=new Uint8Array(16);
        try{crypto.getRandomValues(a);}catch(e){for(let i=0;i<16;i++)a[i]=Math.floor(Math.random()*256);}
        for(let i=0;i<a.length;i++)key+=(a[i]+256).toString(16).slice(1);
      }
      coIdem={tuple,key};
    }
    return coIdem.key;
  }
  // Two payment methods (СБП / карта). payment_type is resolved server-side to a
  // whitelisted Platega method; the client never sends a numeric method or amount.
  /* The first-touch record, shaped for the order body. Total by construction:
     a blocked or empty sessionStorage produces {} and the order goes out with
     no attribution, exactly as it does today. Analytics never fails a sale. */
  function _coAttribution(){
    try{
      var a=JSON.parse(sessionStorage.getItem('magic_attr')||'{}')||{};
      if(typeof a!=='object'||Array.isArray(a))return {};
      return {
        utm_source:a.utm_source,utm_medium:a.utm_medium,utm_campaign:a.utm_campaign,
        referrer:a.referrer,entry:a.entry
      };
    }catch(e){return {};}
  }
  async function coStartPayment(paymentType, btn){
    if(submitting)return;                                  // guard against double click (both buttons)
    const email=byId('coEmail'),consent=byId('coConsent'),err=byId('coError');
    const pkgId=(overlay.dataset.packageId||'').trim();
      // Выбранный срок, если тариф продаётся по дням. Пусто для обычных пакетов.
      const coDays=overlay.dataset.days||'';
    if(!email||!/.+@.+\..+/.test(email.value.trim())){err.textContent='Укажите корректный email для получения eSIM.';err.hidden=false;if(email)email.focus();return;}
    if(consent&&!consent.checked){err.textContent='Подтвердите согласие с пользовательским соглашением и политикой конфиденциальности.';err.hidden=false;return;}
    if(!pkgId){err.textContent='Тариф не выбран. Закройте окно и выберите тариф заново.';err.hidden=false;return;}
    // Block checkout if a promo code is sitting in the field but is NOT applied
    // (e.g. it was just dropped by an email re-validation, or typed without pressing
    // «Применить»). Prevents paying the base price while a code looks entered.
    const _pi=byId('coPromoInput');const _pending=((_pi&&_pi.value)||'').trim();
    if(_pending&&!appliedPromo&&!promoDisabled){err.textContent='Промокод введён, но не применён. Нажмите «Применить» или удалите его, затем оплатите.';err.hidden=false;if(_pi)_pi.focus();return;}
    err.hidden=true;
    submitting=true;
    // Analytics (safe wrapper; no PII). Fires once per initiation — the submitting
    // guard above prevents a double click from creating a second goal.
    //
    // The bridge to the same-origin result pages carries what the order status API
    // does not return: package, promo, payment method. It deliberately holds no
    // email, no contact, no order token — only the 6-char order reference, added
    // below once the server answers. price_rub is the amount we *expect*; the
    // result page ignores it for revenue and uses the server's own figure.
    try{
      const _pr=(currentPrice()!=null)?String(currentPrice()):overlay.dataset.priceRub;
      magicMetrikaGoal(paymentType==='sbp'?'payment_sbp_click':'payment_card_click',{country_code:(typeof activeCountry!=='undefined'?activeCountry:''),package_id:pkgId,price_rub:_pr});
      sessionStorage.setItem('magic_pay_ctx',JSON.stringify({
        payment_type:(paymentType==='sbp'||paymentType==='card')?paymentType:undefined,
        price_rub:(_pr!==''&&isFinite(Number(_pr)))?Number(_pr):undefined,
        country_code:(typeof activeCountry!=='undefined'&&activeCountry)?activeCountry:undefined,
        package_id:pkgId||undefined,
        promo_code:appliedPromo?appliedPromo.code:undefined,
        discount_amount:(appliedPromo&&isFinite(Number(appliedPromo.discount)))?Number(appliedPromo.discount):undefined,
        _ts:Date.now()
      }));
    }catch(e){}
    let redirected=false;
    const payBtn=byId('coPay'),mSbp=byId('coMethodSbp'),mCard=byId('coMethodCard');
    const label=payBtn?payBtn.querySelector('.pay-label'):null;   // loading swaps only the label text, the logo stays
    const oldText=label?label.textContent:'';
    if(payBtn)payBtn.disabled=true; if(mSbp)mSbp.disabled=true; if(mCard)mCard.disabled=true;   // block during flight
    if(label)label.textContent='Создаём платёж…';
    try{
      /* THE ONE REQUEST THAT MUST NOT BE SENT TWICE AS TWO PURCHASES.
         The body — including idempotency_key — is built ONCE, here, and the
         same string is handed to both roads. MagicNet forwards it byte for
         byte and never regenerates anything: a new key between primary and
         fallback is the single mistake that would turn a network blip into two
         orders. Proven safe in
         test/integration/crossOriginIdempotency.test.js — a retry under the
         same key through the other origin returns the FIRST order (200,
         idempotent_replay), leaving one retail order and one payment. */
      const orderBody=JSON.stringify({
          package_id:pkgId,
          // Только для тарифов с дневным лимитом. Сервер проверяет срок по
          // своему же списку и сам считает сумму — здесь это выбор человека,
          // а не цена: браузер по-прежнему ничего не считает.
          days:coDays||undefined,
          email:email.value.trim(),
          termsAccepted:true,
          payment_type:paymentType,                                    // "sbp" | "card"
          promo_code:appliedPromo?appliedPromo.code:undefined,         // code only; server recomputes
          // Same key across retries of this same intent; new key when the
          // intent (package/method/email/promo) or the modal session changes.
          idempotency_key:coIdemKeyFor(pkgId,paymentType,email.value,appliedPromo?appliedPromo.code:'',coDays),
          /* Where this visit came from, captured on the FIRST page of the
             session — see the capture block at the top of this file and the
             identical one in assets/country-tariffs.js.

             Marketing metadata, and the server treats it as such: it decides
             the source itself from these observations rather than accepting a
             claim, and a page cannot assert `findmini` about itself. Nothing
             here reaches Platega or a provider; the order body goes to our own
             backend only.

             It is NOT part of the idempotency fingerprint (scope, package,
             payment type, promo, hashed email, term), so adding it cannot
             change replay behaviour: a retry under the same key still returns
             the first order, with the attribution the first attempt carried. */
          attribution:_coAttribution()
      });
      const resp=await MagicNet.request('/api/v1/public/retail-orders',{
        method:'POST',kind:'write',idempotent:true,
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:orderBody});
      const data=resp.body||{};
      if(resp.ok&&data.redirect_url&&allowedRedirect(data.redirect_url)){
        // Bind the bridge to this exact order so a result page can tell a fresh
        // context from one left over by an earlier attempt. Only the last 6 chars
        // are kept — the reference the partner portal already shows — never the
        // full token, which still reads order status.
        try{
          const _tok=String(data.public_order_token||'');
          if(_tok){
            const _c=JSON.parse(sessionStorage.getItem('magic_pay_ctx')||'{}')||{};
            _c.order_ref=_tok.slice(-6);
            sessionStorage.setItem('magic_pay_ctx',JSON.stringify(_c));
          }
        }catch(e){}
        redirected=true;
        /* The step the audit found unmeasured: the moment we hand the customer
           to Platega. Between `payment_*_click` and `payment_success` there was
           nothing, so «pressed pay» and «actually reached the payment page»
           were the same number — and the 30-minute timeouts that make up most
           of our cancellations were invisible.

           Fired BEFORE the assign and deliberately not awaited: magicMetrikaGoal
           is synchronous, wrapped and silent, and Metrika's own transport
           survives the navigation. If it did not, the goal would be lost — and
           that is the correct trade. Nothing may sit between a customer and the
           payment page.

           Carries the method and the package only. No amount, no email, no
           order token: a third-party analytics service has no need of them, and
           the amount is already booked from the server's own record on the
           success page. */
        try{magicMetrikaGoal('payment_redirect',{country_code:(typeof activeCountry!=='undefined'?activeCountry:''),package_id:pkgId,payment_method:paymentType});}catch(e){}
        window.location.assign(data.redirect_url);         // go to Platega payment page
        return;
      }
      // Promo rejected at order-create (disabled/expired/limit/margin/etc.): drop the
      // discount, revert to the base price and require an explicit re-confirm — never
      // auto-redirect on a stale amount.
      if(data&&typeof data.error==='string'&&data.error.indexOf('PROMO')===0){
        resetPromo();
        err.textContent=(PROMO_MSG[data.error]||data.message||'Промокод недоступен. Проверьте итоговую сумму и повторите оплату.');
      }else if(resp.transportFailure){
        /* Neither road reached a verdict. Say so plainly rather than inventing a
           reason — and do NOT claim the payment failed, because a request that
           reached no verdict may still have been received. Retrying is safe:
           the same key comes back, and the backend replays the first order. */
        err.textContent='Сервис оплаты сейчас не отвечает. Подождите минуту и нажмите «Оплатить» ещё раз — повторное нажатие не создаст второй заказ.';
      }else{
        err.textContent=(data&&data.message)?data.message:'Не удалось создать платёж. Попробуйте позже или напишите в поддержку support@magicesim.store.';
      }
      err.hidden=false;
    }catch(e){
      err.textContent='Не удалось связаться с сервером. Проверьте соединение и попробуйте снова.';
      err.hidden=false;
    }finally{
      if(!redirected){submitting=false;if(payBtn)payBtn.disabled=false;if(mSbp)mSbp.disabled=false;if(mCard)mCard.disabled=false;if(label)label.textContent=oldText;}
    }
  }
  // Payment method selector = single source of truth for payment_type. The promo
  // quote uses the selected method's rate; changing the method invalidates an applied
  // promo (it must be re-quoted for the new method's margin).
  let selectedMethod='sbp';
  function setMethod(m){
    if(m!=='sbp'&&m!=='card')return;
    const changed=(m!==selectedMethod);selectedMethod=m;
    const sb=byId('coMethodSbp'),cb=byId('coMethodCard');
    if(sb)sb.setAttribute('aria-checked',String(m==='sbp'));
    if(cb)cb.setAttribute('aria-checked',String(m==='card'));
    const lab=byId('coPayLabel'),ico=byId('coPayIco');
    if(lab)lab.textContent=(m==='sbp'?'Оплатить по СБП':'Оплатить российской картой');
    if(ico)ico.src=(m==='sbp'?'assets/payment/sbp.svg':'assets/payment/mir.svg');
    if(changed&&appliedPromo)resetPromo('Способ оплаты изменён — примените промокод заново.');
  }
  const mSbpEl=byId('coMethodSbp'),mCardEl=byId('coMethodCard');
  if(mSbpEl)mSbpEl.addEventListener('click',()=>setMethod('sbp'));
  if(mCardEl)mCardEl.addEventListener('click',()=>setMethod('card'));
  const payEl=byId('coPay'); if(payEl)payEl.addEventListener('click',()=>coStartPayment(selectedMethod));
  // Promo controls: Apply / Remove / Enter-to-apply (never submits the form). Email
  // change drops an applied promo (email affects per-email / first-purchase limits).
  const paBtn=byId('coPromoApply'); if(paBtn)paBtn.addEventListener('click',applyPromo);
  const prBtn=byId('coPromoRemove'); if(prBtn)prBtn.addEventListener('click',()=>{resetPromo();try{magicMetrikaGoal('promo_removed',{country_code:(typeof activeCountry!=='undefined'?activeCountry:''),package_id:(overlay&&overlay.dataset?overlay.dataset.packageId:undefined)});}catch(e){}});
  const piEl=byId('coPromoInput'); if(piEl)piEl.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();applyPromo();}});
  // Email affects per-email / first-purchase promo limits. Instead of dropping the
  // applied promo (forcing a manual re-apply), silently re-validate it against the
  // new email: keep the discount if still valid, or remove it with a clear message
  // if the email makes it ineligible. Debounced; skipped when no promo is applied.
  let revalTimer=null;
  const scheduleReval=()=>{ if(!appliedPromo)return; if(revalTimer)clearTimeout(revalTimer); revalTimer=setTimeout(revalidatePromo,350); };
  const emEl=byId('coEmail'); if(emEl){emEl.addEventListener('change',scheduleReval);emEl.addEventListener('blur',scheduleReval);}
  const coForm=byId('checkoutForm'); if(coForm)coForm.addEventListener('submit',(e)=>e.preventDefault());
})();
