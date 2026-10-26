// The English Terms of Service of the international website — PRE-LAUNCH version (LEGAL-3).
//
// ONE source for /en/terms/ (built by seo/build-locale-pages.mjs for English only, in the frame of /en/privacy/). The text is
// the owner-approved pre-launch edition (2026-10-23) of the LEGAL-2 final document, word for word: international payments
// are unavailable, no payment provider or Merchant of Record is named, no telephone number. Typography only: curly quotes;
// layout only: tables become lists so every block reads on a 320 px phone. The Refund Policy (seo/refund-en.mjs) is part of these Terms.
// seo/test-en-legal-docs.mjs pins what it states and what it must never state. A wording change is the owner's decision.
// 0.9.1 (LEGAL-4, owner's word 2026-10-23): §6.1 no longer says «our Merchant of Record» — taxes «may be calculated and added at checkout».
// 0.9.2 (LEGAL-5, owner's task 2026-10-26): §2.1 a one-off purchase of a prepaid package, no subscription, no renewal, and
// what the card and the checkout really show; §8.3–8.4 the start of validity, the counting of days and the activation
// period only as far as the providers state them; §5.5 and §15 the permanent copy of every version (seo/legal-archive.mjs).
// 0.9.3 (LEGAL-6, owner's task 2026-10-26): §1 separates the sales model of today (no sales; we would be the seller) from a
// possible later one through Paddle as Merchant of Record — conditional, never presented as running; §10.2 points to it.

export const TERMS_VERSION = '0.9.3 (pre-launch)';
export const TERMS_EFFECTIVE = '26 October 2026';
export const TERMS_EFFECTIVE_ISO = '2026-10-26';

export const TERMS = Object.freeze({
  title: "Terms of Service — Magic eSIM",
  description: "The terms for using the Magic eSIM international website and buying eSIM data plans in US dollars. International payments are currently unavailable.",
  h1: "Terms of Service",
  lead: "The terms for using the Magic eSIM international website and for eSIM data plans bought on it in US dollars.",
  crumb: "Terms of Service",
  sections: [
    {
      id: 'about-these-terms', h2: "About these Terms", html: `
      <p>These Terms govern:</p>
      <ul class="list">
        <li>your use of the Magic eSIM international website at magicesim.store/en/ and its other non-Russian language versions (the <strong>Website</strong>); and</li>
        <li>every eSIM data plan you buy on the Website in US dollars.</li>
      </ul>
      <p>The Russian-language website magicesim.store, purchases in Russian roubles and the Magic eSIM Telegram Mini App are governed by separate terms published there.</p>
      <p><strong>International payments are currently unavailable.</strong> You can browse plans and get an exact price on the Website, but you cannot place an order or pay, and no contract is formed. These Terms describe how ordering and payment work when international checkout becomes available.</p>
      <p>Please read these Terms, our <strong>Refund Policy</strong> and our <strong>Privacy Policy</strong> before you pay. The Refund Policy is part of these Terms. You accept these Terms by ticking the acceptance box at checkout and confirming your payment.</p>`,
    },
    {
      id: 'who-we-are', h2: "1. Who we are", html: `
      <p>Every plan on the Website is sold by:</p>
      <ul class="list">
        <li><strong>Seller:</strong> Individual Entrepreneur ALEKSANDR KHARIN (ინდივიდუალური მეწარმე), registered in Georgia</li>
        <li><strong>Identification number in the Registry of Entrepreneurs:</strong> 305887261</li>
        <li><strong>Registered address:</strong> Georgia, Tbilisi, Saburtalo district, Bakhtrioni str. N22, Apt. 75</li>
        <li><strong>Trading name:</strong> Magic eSIM</li>
        <li><strong>Website:</strong> <a href="/en/">https://magicesim.store/en/</a></li>
        <li><strong>Email:</strong> <a href="mailto:support@magicesim.store">support@magicesim.store</a></li>
      </ul>
      <p>“<strong>We</strong>”, “<strong>us</strong>” and “<strong>our</strong>” mean the seller named above. “<strong>You</strong>” means the person who uses the Website or buys a plan.</p>
      <p><strong>How plans are sold — today and possibly later.</strong></p>
      <ul class="list">
        <li><strong>Today:</strong> no plan can be bought on the Website. No payment provider and no reseller sells our plans.</li>
        <li><strong>Later, if we sell directly:</strong> we are the seller, as these Terms describe.</li>
        <li><strong>Later, if we sell through Paddle:</strong> we may sell through Paddle.com acting as online reseller and Merchant of Record. This is not the case today. If it happens, these Terms will be updated before such sales begin. For an order that Paddle processes, Paddle is the seller of record and handles payment and billing; Paddle’s own buyer terms also apply; refunds are decided and paid by Paddle (Refund Policy, section 8); and we remain responsible for providing the eSIM and technical support.</li>
      </ul>`,
    },
    {
      id: 'what-we-sell', h2: "2. What we sell", html: `
      <p>2.1. <strong>Prepaid eSIM data plans for travel.</strong></p>
      <ul class="list">
        <li>We sell prepaid mobile data packages for use abroad, delivered as an eSIM profile — a digital SIM that you install on a compatible phone or tablet.</li>
        <li>Each purchase is a <strong>one-off payment for one package</strong>. It is not a subscription and does not renew automatically. We charge you again only if you place a new order.</li>
        <li>Before you buy, each plan’s product card shows:
          <ul class="list">
          <li>the destinations covered;</li>
          <li>the data allowance, or the daily allowance for daily plans;</li>
          <li>the validity period, or the number of days you choose;</li>
          <li>the network generation, where our eSIM service provider states it;</li>
          <li>the price in USD;</li>
          <li>for daily plans, the speed after the day’s high-speed allowance is used, where our eSIM service provider states it;</li>
          <li>when the validity period starts, where our eSIM service provider states it.</li>
          </ul>
        </li>
        <li>Before you pay, the checkout shows the plan’s main terms again, including when the validity period starts or that our eSIM service provider does not state it, and the period for activating the eSIM (section 8.4).</li>
      </ul>
      <p>2.2. <strong>Data only.</strong> Plans provide mobile data. They do not include a phone number, voice calls or SMS unless the product card says so. <strong>A plan cannot be used to call emergency services.</strong></p>
      <p>2.3. <strong>We are a reseller, not a mobile network operator.</strong></p>
      <ul class="list">
        <li>The networks are run by mobile operators in each destination.</li>
        <li>Plans are supplied to us by third-party eSIM service providers (our connectivity partners). Activation and network availability depend on their technical infrastructure and on the third-party network operators they work with. This does not change our responsibility to you under these Terms.</li>
        <li>We do not own or control the networks.</li>
      </ul>
      <p>2.4. <strong>Coverage and speed.</strong></p>
      <ul class="list">
        <li>Coverage, speed and availability depend on the local operator’s network, your location, your device and its settings, and network load.</li>
        <li>Speed can be lower than the network generation allows.</li>
        <li>Coverage is listed by country and is not promised for every place within a country.</li>
        <li>We do not guarantee any particular speed or uninterrupted service.</li>
        <li>This does not limit your rights if a plan does not work as described (section 10 and the Refund Policy).</li>
      </ul>
      <p>2.5. <strong>Fair use and data roaming.</strong></p>
      <ul class="list">
        <li>Some plans, especially unlimited and daily plans, have a fair-usage policy. After a stated amount of high-speed data, the speed may be reduced. The product card says so where our eSIM service provider publishes it.</li>
        <li>Data roaming usually has to be switched on for the Magic eSIM line. Switch it on <strong>for the Magic eSIM line only</strong>. To avoid charges from your home mobile operator, keep data roaming switched off for your other SIM and choose the Magic eSIM line for mobile data. Charges from your home operator are not part of our plan.</li>
      </ul>
      <p>2.6. <strong>Roaming connection.</strong></p>
      <ul class="list">
        <li>Plans connect to partner networks in the destination as a roaming connection. You pay only the price of the plan; we add no roaming charges. Your connection may be routed through another country.</li>
        <li>Websites and apps may therefore see an IP address or location outside the country you are in. Some may show content, language or prices for another country, or limit access.</li>
        <li>We do not promise access to any particular website, app or service. Their availability depends on the network, the service itself and local law.</li>
      </ul>`,
    },
    {
      id: 'who-can-buy', h2: "3. Who can buy", html: `
      <p>3.1. You must be at least 18 years old and legally able to enter into a contract.</p>
      <p>3.2. <strong>Personal use only.</strong> You buy plans for your own use or for people you travel with. Commercial use or resale requires our prior written agreement.</p>
      <p>3.3. <strong>Destinations and sanctions.</strong></p>
      <ul class="list">
        <li>We do not sell plans for use in Russia, Ukraine or Belarus.</li>
        <li>We do not sell to persons or for uses subject to sanctions under the laws of Georgia, the United Nations, the European Union, the United Kingdom or the United States.</li>
        <li>We refuse or cancel, with a full refund, any order that would breach these restrictions.</li>
      </ul>`,
    },
    {
      id: 'device-compatibility', h2: "4. Device compatibility", html: `
      <p>4.1. Your device must:</p>
      <ul class="list">
        <li>support eSIM;</li>
        <li>not be locked to a mobile operator (carrier-locked or SIM-locked);</li>
        <li>be compatible with the plan’s network technology.</li>
      </ul>
      <p>Our guides explain how to check this.</p>
      <p>4.2. Please check compatibility before you buy; you confirm it at checkout. If you are unsure, contact us first. If the device is not compatible, the plan cannot work. The Refund Policy explains what happens then.</p>`,
    },
    {
      id: 'how-to-order', h2: "5. How to order", html: `
      <p>5.1. <strong>Ordering steps:</strong></p>
      <ol class="list">
        <li>Choose a plan and, for daily plans, the number of days.</li>
        <li>Get the exact price. We hold it for 30 minutes.</li>
        <li>Enter your email address.</li>
        <li>Tick the required boxes.</li>
        <li>Press the payment button.</li>
        <li>Complete the payment.</li>
      </ol>
      <p>5.2. <strong>Before you pay</strong> you can review the plan, the number of days and the total price, and correct any detail, including your email address.</p>
      <ul class="list">
        <li>The button that completes the order states that it involves an obligation to pay, for example “Pay $12.99”.</li>
      </ul>
      <p>5.3. <strong>At checkout we ask you to:</strong></p>
      <ul class="list">
        <li>(a) accept these Terms and the Refund Policy;</li>
        <li>(b) read the Privacy Policy, which is linked at checkout;</li>
        <li>(c) confirm that your device is compatible;</li>
        <li>(d) request immediate supply of the eSIM and acknowledge its effect on your right of withdrawal (Refund Policy, section 4).</li>
      </ul>
      <p>We keep a record of what you accepted and when.</p>
      <p>5.4. <strong>Formation of the contract.</strong></p>
      <ul class="list">
        <li>The contract is formed when the payment provider confirms your payment to us.</li>
        <li>If the payment is not confirmed, no contract is formed and you are not charged.</li>
      </ul>
      <p>5.5. <strong>Confirmation email.</strong> Promptly after payment we email you:</p>
      <ul class="list">
        <li>an order confirmation;</li>
        <li>the eSIM;</li>
        <li>the main terms of the plan;</li>
        <li>the statements you made at checkout;</li>
        <li>links to the permanent copies of the versions of these Terms, the Refund Policy and the Privacy Policy in force on the day of your order (section 15).</li>
      </ul>
      <p>5.6. <strong>Language.</strong></p>
      <ul class="list">
        <li>The contract is concluded in English.</li>
        <li>We also publish these Terms, the Refund Policy and the Privacy Policy in Spanish, German, French, Simplified Chinese and Korean for your convenience. If a translation and the English version differ, the English version applies, unless the mandatory law that applies to you requires otherwise.</li>
        <li>This does not limit your statutory rights as a consumer, including any rule of that law that an unclear term is interpreted in your favour.</li>
      </ul>`,
    },
    {
      id: 'prices-and-payment', h2: "6. Prices and payment", html: `
      <p>6.1. <strong>Price.</strong></p>
      <ul class="list">
        <li>Plan prices are shown in US dollars. They include all our charges; we add no fees of our own.</li>
        <li>You pay once for each order. There is no subscription, recurring charge or automatic renewal.</li>
        <li>International payments are currently unavailable. When international checkout becomes available, applicable taxes may be calculated and added at checkout. The total amount payable, including any applicable taxes, will be displayed before you confirm the payment.</li>
      </ul>
      <p>6.2. <strong>Payment.</strong></p>
      <ul class="list">
        <li>International payments are currently unavailable on the Website.</li>
        <li>When international checkout becomes available, the payment methods offered are shown at checkout, and payments are processed by a third-party payment service.</li>
        <li>We never receive or store your full card number or security code.</li>
      </ul>
      <p>6.3. <strong>Currency conversion.</strong> If your card account is not in US dollars, your bank may charge conversion or foreign-transaction fees. Those fees are set by your bank.</p>`,
    },
    {
      id: 'delivery', h2: "7. Delivery", html: `
      <p>7.1. <strong>How.</strong></p>
      <ul class="list">
        <li>Delivery is electronic, by email to the address you entered.</li>
        <li>The email contains a QR code, the details for installing the eSIM manually, and installation instructions.</li>
        <li>Delivery is free.</li>
      </ul>
      <p>7.2. <strong>When.</strong></p>
      <ul class="list">
        <li>The eSIM is usually delivered within a few minutes after the payment is confirmed.</li>
        <li>If our eSIM service provider does not confirm the eSIM straight away, we check the order manually and then either deliver the eSIM or refund you in full.</li>
        <li>If you have not received it within 1 hour, check your spam folder and write to us.</li>
      </ul>
      <p>7.3. <strong>Your email address.</strong></p>
      <ul class="list">
        <li>Please enter your email address carefully.</li>
        <li>We resend the eSIM to the address used for the order on request.</li>
      </ul>
      <p>7.4. <strong>Keep the eSIM private.</strong> The QR code and installation details give access to your plan. Do not share them.</p>`,
    },
    {
      id: 'installation-activation-and-validity', h2: "8. Installation, activation and validity", html: `
      <p>8.1. Install the eSIM by following the instructions. You need an internet connection, for example Wi-Fi.</p>
      <p>8.2. <strong>One device; do not delete it.</strong></p>
      <ul class="list">
        <li>An eSIM can normally be installed only once and only on one device. It cannot be moved to another device.</li>
        <li><strong>Do not delete an installed eSIM.</strong> A deleted eSIM usually cannot be restored.</li>
      </ul>
      <p>8.3. <strong>Start of validity and how days are counted.</strong></p>
      <ul class="list">
        <li>When the validity period starts is set by our eSIM service provider for each plan. Depending on the plan, it is the installation of the eSIM, its first connection to a network, its first use of data, or the purchase.</li>
        <li>Where our eSIM service provider states it, the product card shows it. Where it does not, the checkout says so before you pay; please ask us before installing the eSIM.</li>
        <li>For daily plans, the network operator or our eSIM service provider sets how a day is counted: depending on the plan, either 24 hours from the first connection or a calendar day that ends at midnight in the operator’s time zone. We cannot always tell you in advance which applies, so the daily allowance may renew at a different time of day from your first connection.</li>
      </ul>
      <p>8.4. <strong>Activation period.</strong></p>
      <ul class="list">
        <li>Our eSIM service provider sets a period within which an eSIM must be installed or activated. An eSIM that is not activated within it expires unused.</li>
        <li>The period differs between plans and can be short — for some plans about one month after purchase. Our product cards do not show it at present, and the checkout says so before you pay.</li>
        <li>If you do not intend to install the eSIM soon after buying it, ask us for the period of your plan before you pay.</li>
      </ul>
      <p>8.5. <strong>End of the plan.</strong></p>
      <ul class="list">
        <li>A plan ends when its validity period ends or its data allowance is used up, whichever comes first.</li>
        <li>Unused data and days are not carried over or paid out, except as the Refund Policy or the law provides.</li>
      </ul>
      <p>8.6. <strong>Top-ups.</strong> Top-ups are not currently offered for plans bought on the Website. When they become available, these Terms will describe them.</p>`,
    },
    {
      id: 'acceptable-use', h2: "9. Acceptable use", html: `
      <p>9.1. <strong>You must not:</strong></p>
      <ul class="list">
        <li>use a plan in a router, dongle, Internet-of-Things or machine-to-machine device, or for automated or unattended data traffic;</li>
        <li>share a plan’s connection with many users, or use it in breach of the fair-usage rules that apply to the plan;</li>
        <li>resell, rent or distribute plans without our written agreement;</li>
        <li>use the Website or a plan for fraud or unlawful purposes, or to harm networks or other users;</li>
        <li>use a plan in breach of the laws of the country where you use it, including laws on access to online content and on the use of VPNs or similar tools;</li>
        <li>pay with a payment method you are not authorised to use;</li>
        <li>interfere with the Website, probe it for vulnerabilities without permission, or use automated means to place orders or copy its content.</li>
      </ul>
      <p>9.2. <strong>Hotspot.</strong> Occasional personal tethering from your phone is not guaranteed and may be restricted by the operator.</p>
      <p>9.3. <strong>If these rules are breached.</strong></p>
      <ul class="list">
        <li>Our eSIM service provider or a network operator may restrict, slow down or suspend a plan, in some cases without notice.</li>
        <li>We may refuse further orders where we have good reason to believe these rules were breached.</li>
        <li>If a plan is restricted for a reason not attributable to you, the Refund Policy applies.</li>
      </ul>
      <p>9.4. <strong>Identity registration.</strong></p>
      <ul class="list">
        <li>In some destinations the law or the network operator requires users of certain plans to register their identity.</li>
        <li>Where we know that a plan requires this, the product card says so before you pay, together with the information required and who processes it. The plan may not work until registration is complete.</li>
        <li>If a plan unexpectedly requires a registration that the product card did not mention, and you do not wish to complete it, the Refund Policy applies as for a plan that does not work as described.</li>
      </ul>
      <p>9.5. <strong>Long stays and device rules.</strong></p>
      <ul class="list">
        <li>Plans are intended for travel. Operators may limit or end roaming for a line used abroad for a long continuous period.</li>
        <li>Some countries require a device brought from abroad to be registered after a period of stay. An unregistered device may be blocked by the local networks, whichever eSIM it uses. Please check the official rules before a long stay.</li>
      </ul>`,
    },
    {
      id: 'if-something-goes-wrong', h2: "10. If something goes wrong", html: `
      <p>10.1. <strong>Contact us.</strong></p>
      <ul class="list">
        <li>If your plan does not install, connect or work as described, write to us with your order reference, your device model and, if possible, screenshots.</li>
        <li>Please do not delete the eSIM while we are helping you.</li>
      </ul>
      <p>10.2. <strong>What we do.</strong></p>
      <ul class="list">
        <li>We try to fix the problem, for example by guiding you through settings, reissuing installation details or providing a replacement eSIM.</li>
        <li>If we cannot make the plan work as described, the Refund Policy applies. For an order made through Paddle as Merchant of Record (not available yet), refunds are made by Paddle (Refund Policy, section 8).</li>
      </ul>
      <p>10.3. <strong>Your legal rights.</strong> These steps do not limit the remedies the law gives you if a plan does not conform to the contract.</p>`,
    },
    {
      id: 'support', h2: "11. Support", html: `
      <p>11.1. <strong>How to contact us.</strong></p>
      <ul class="list">
        <li>Email: <a href="mailto:support@magicesim.store">support@magicesim.store</a>. You can email us at any time, 24 hours a day, 7 days a week.</li>
      </ul>
      <p>11.2. <strong>When we reply.</strong> We reply on business days and aim to send a first reply within 1–2 business days, usually sooner.</p>`,
    },
    {
      id: 'liability', h2: "12. Liability", html: `
      <p>12.1. <strong>What we are responsible for.</strong> We are responsible for supplying the plan you bought as described on its product card and in these Terms.</p>
      <p>12.2. <strong>What we are not responsible for.</strong></p>
      <ul class="list">
        <li>Losses caused by events outside our reasonable control, such as an outage, damage or restriction of a local network, or an act of a public authority.</li>
        <li>The consequences of using an incompatible or locked device, or of deleting an installed eSIM.</li>
        <li>Indirect losses, unless the law makes us responsible for them.</li>
      </ul>
      <p>12.3. <strong>Cap.</strong> Our total liability for one order is limited to the price you paid for it, except as stated in 12.4.</p>
      <p>12.4. <strong>Nothing in these Terms excludes or limits:</strong></p>
      <ul class="list">
        <li>liability for death or personal injury caused by negligence;</li>
        <li>liability for fraud, intent or gross negligence;</li>
        <li>any other liability that cannot be limited by law;</li>
        <li>your statutory rights as a consumer, including your rights under the Australian Consumer Law (including the consumer guarantees, which cannot be excluded), New Zealand’s Consumer Guarantees Act 1993 and Fair Trading Act 1986, or similar laws of the country where you live.</li>
      </ul>
      <p>Where such a law applies to your purchase, sections 12.2 and 12.3 apply only to the extent that law allows.</p>`,
    },
    {
      id: 'cancellation-by-us', h2: "13. Cancellation by us", html: `
      <p>We may cancel an order and refund it in full where:</p>
      <ul class="list">
        <li>the payment is suspected to be unauthorised;</li>
        <li>the sale would breach sanctions or other law; or</li>
        <li>the product card contained an obvious error, such as a clearly wrong price.</li>
      </ul>
      <p>We tell you the reason unless the law prevents it.</p>`,
    },
    {
      id: 'intellectual-property', h2: "14. Intellectual property", html: `
      <p>The Website, its content and the Magic eSIM name and logo belong to us or our licensors. You may use the Website only to learn about and buy plans for yourself.</p>`,
    },
    {
      id: 'changes-to-these-terms', h2: "15. Changes to these Terms", html: `
      <ul class="list">
        <li>We may change these Terms for future orders.</li>
        <li><strong>Your order is governed by the version you accepted at checkout.</strong></li>
        <li>The current version and its effective date are always on this page.</li>
        <li>Every version of these Terms, the Refund Policy and the Privacy Policy is kept unchanged at its own permanent address, linked at the top of each document — for example, magicesim.store/en/terms/v0.9.2/ — so that you can save or print the version you accepted. The list of all versions is at magicesim.store/en/legal-versions.json. You can also ask us for a copy.</li>
      </ul>`,
    },
    {
      id: 'governing-law-and-disputes', h2: "16. Governing law and disputes", html: `
      <p>16.1. <strong>Governing law.</strong></p>
      <ul class="list">
        <li>These Terms are governed by the laws of Georgia.</li>
        <li>If you are a consumer, you also keep the protection of the mandatory consumer-protection rules of the country where you live, where that law applies to your purchase.</li>
      </ul>
      <p>16.2. <strong>Contact us first.</strong> Please contact us first so that we can try to solve the problem. This is not a condition of any legal right.</p>
      <p>16.3. <strong>Courts.</strong></p>
      <ul class="list">
        <li>Disputes may be brought before the competent courts of Georgia.</li>
        <li>If you are a consumer, you may also bring a claim in the courts of the country where you live, where the law gives you that right.</li>
      </ul>
      <p>16.4. <strong>No arbitration.</strong> We do not require arbitration and do not restrict your right to take legal action, individually or as the law otherwise allows.</p>
      <p>16.5. <strong>Out-of-court resolution.</strong> We do not take part in an out-of-court consumer dispute resolution scheme. You may contact the consumer protection authority of your country.</p>`,
    },
    {
      id: 'general', h2: "17. General", html: `
      <p>17.1. <strong>Severability.</strong> If a provision of these Terms is invalid, the rest remains in force.</p>
      <p>17.2. <strong>Transfer.</strong> We may transfer our rights and obligations to another person who will continue the service, without reducing your rights.</p>
      <p>17.3. <strong>The contract.</strong></p>
      <ul class="list">
        <li>The contract consists of these Terms, the Refund Policy, the product card and the order confirmation.</li>
        <li>You can request a copy of your order record.</li>
      </ul>`,
    },
  ],
});
