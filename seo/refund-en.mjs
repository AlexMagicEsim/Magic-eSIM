// The English Refund Policy of the international website — PRE-LAUNCH version (LEGAL-3).
//
// ONE source for /en/refund/ (built by seo/build-locale-pages.mjs for English only, in the frame of /en/privacy/). The text is
// the owner-approved pre-launch edition (2026-10-23) of the LEGAL-2 final document, word for word: international payments
// are unavailable, no payment provider or Merchant of Record is named, no telephone number. Typography only: curly quotes;
// layout only: tables become lists so every block reads on a 320 px phone. It is part of the Terms of Service (seo/terms-en.mjs).
// seo/test-en-legal-docs.mjs pins what it states and what it must never state. A wording change is the owner's decision.
// 0.9.1 (LEGAL-5, owner's task 2026-10-26): §3.4(c) and §4.3 — the period of an unlimited plan is counted in hours, so a
// day that has started is no longer counted as fully used; §3.4(g) says what the providers' records can and cannot show.

export const REFUND_VERSION = '0.9.1 (pre-launch)';
export const REFUND_EFFECTIVE = '26 October 2026';
export const REFUND_EFFECTIVE_ISO = '2026-10-26';

export const REFUND = Object.freeze({
  title: "Refund Policy — Magic eSIM",
  description: "When you can get money back for an eSIM plan bought in US dollars on the Magic eSIM international website. Your statutory rights come first.",
  h1: "Refund Policy",
  lead: "When you can get money back for an eSIM plan bought in US dollars on the Magic eSIM international website.",
  crumb: "Refund Policy",
  sections: [
    {
      id: 'about-this-policy', h2: "About this policy", html: `
      <p>This policy explains when you can get money back for an eSIM plan bought in US dollars on the Magic eSIM international website. The seller is Individual Entrepreneur ALEKSANDR KHARIN (Georgia). This policy is part of our Terms of Service.</p>
      <p><strong>International payments are currently unavailable</strong>, so no plan can be bought on the international website yet. This policy applies to plans bought once international checkout becomes available.</p>
      <p><strong>Your statutory rights come first.</strong> This policy describes what we offer voluntarily. It does not remove or reduce any right you have under mandatory consumer law. Where the law gives you more, you receive what the law gives you (section 4).</p>`,
    },
    {
      id: 'summary', h2: "1. Summary", html: `
      <ul class="list">
        <li><strong>Duplicate charge or charge in error:</strong> Full refund of the extra or wrong amount (section 2)</li>
        <li><strong>We could not deliver your eSIM:</strong> Full refund (section 2)</li>
        <li><strong>We cancelled your order:</strong> Full refund (section 2)</li>
        <li><strong>Technical fault that our support cannot fix:</strong> We offer a replacement or a refund of the unused part (section 3). If the eSIM never worked, or no data was used on a plan with a fixed data allowance, we refund 100 %</li>
        <li><strong>You chose the wrong country or plan:</strong> Not covered by our voluntary refunds. Your statutory rights remain (sections 4 and 5)</li>
        <li><strong>Your device does not support eSIM or is locked:</strong> Not covered by our voluntary refunds. Your statutory rights remain (sections 4 and 5)</li>
        <li><strong>You changed your mind, or your trip changed:</strong> Not covered by our voluntary refunds. Your statutory rights remain (sections 4 and 5)</li>
        <li><strong>You did not use the eSIM:</strong> Not using it does not by itself give you a refund. Your statutory rights remain (sections 4 and 5)</li>
      </ul>`,
    },
    {
      id: 'errors-and-non-delivery-always-refunded', h2: "2. Errors and non-delivery — always refunded", html: `
      <p>We refund the full amount paid:</p>
      <ul class="list">
        <li>for a <strong>duplicate payment</strong>, or any amount charged <strong>in error</strong>;</li>
        <li>if we <strong>could not deliver</strong> the eSIM you paid for;</li>
        <li>if we <strong>delivered a different plan</strong> from the one you paid for and you do not want the correct plan instead;</li>
        <li>if <strong>we cancel</strong> your order (Terms of Service, section 13).</li>
      </ul>`,
    },
    {
      id: 'technical-faults', h2: "3. Technical faults", html: `
      <p>3.1. <strong>When this section applies.</strong> It applies when all of these are true:</p>
      <ul class="list">
        <li>the eSIM cannot be installed, does not connect, or does not provide data as described on its product card;</li>
        <li>the cause is not your device, its settings, or a breach of our acceptable-use rules;</li>
        <li>our support has confirmed the fault.</li>
      </ul>
      <p>3.2. <strong>What you do.</strong></p>
      <ul class="list">
        <li>Contact us as soon as you can.</li>
        <li>Give us your order reference, your device model, a description of the problem and, if possible, screenshots.</li>
        <li><strong>Do not delete the eSIM</strong> while we are working on the problem. A deleted eSIM usually cannot be restored, and we may then be unable to confirm the fault.</li>
      </ul>
      <p>3.3. <strong>What we do.</strong></p>
      <ol class="list">
        <li>We first try to fix the problem with you.</li>
        <li>If it cannot be fixed within a reasonable time, we offer you either a <strong>replacement</strong> eSIM for the same destination and plan, or a <strong>refund</strong>.</li>
        <li>If the replacement also does not work, we refund you under section 3.4, counting the data and days used on the original eSIM and on the replacement together.</li>
      </ol>
      <p>3.4. <strong>How much we refund.</strong> We refund the price of the part of the plan you could not use. All measurements are made <strong>at the time you first reported the fault to us</strong>, so time taken by our support does not reduce your refund. Use of the plan after your report is dealt with in section 3.6. Amounts are rounded to the cent <strong>in your favour</strong>.</p>
      <p>(a) <strong>Plans with a fixed data allowance</strong> — for example, 20 GB for 30 days.</p>
      <blockquote>
        <p><strong>Refund = Amount paid × (Remaining data ÷ Total data)</strong></p>
      </blockquote>
      <ul class="list">
        <li>Example: you paid $20 for a 20 GB plan, used 5 GB and had 15 GB left. We refund $20 × 15 ÷ 20 = <strong>$15</strong>.</li>
        <li>If no data was used, we refund <strong>100 %</strong>.</li>
        <li>Remaining data is taken from our eSIM service provider’s usage record for your eSIM.</li>
      </ul>
      <p>(b) <strong>Daily plans</strong> — a set amount of data per day for a number of days.</p>
      <blockquote>
        <p><strong>Refund = Amount paid × (Unused days ÷ Days paid)</strong></p>
      </blockquote>
      <ul class="list">
        <li>Days that had not started when you reported the fault count as unused.</li>
        <li>The day of your report is counted according to your actual use that day:
          <ul class="list">
          <li>if no data was used that day, it counts as an unused day;</li>
          <li>if part of that day’s allowance was used, we refund the unused share of that day;</li>
          <li>if the use on that day cannot be established, section 3.4(f) applies.</li>
          </ul>
        </li>
      </ul>
      <p>(c) <strong>Unlimited plans for a set period</strong> — plans with no data allowance, total or daily. A plan with a daily high-speed allowance is a daily plan, and (b) applies to it.</p>
      <blockquote>
        <p><strong>Refund = Amount paid × (Remaining validity ÷ Total validity)</strong></p>
      </blockquote>
      <ul class="list">
        <li>Remaining validity is the time from your report to the end of the plan’s validity period.</li>
        <li>It is counted in hours, and an hour that has started counts as remaining. A day that has started is not counted as used: only the time that has actually passed is.</li>
        <li>The end of the validity period is taken from our eSIM service provider’s record for your eSIM. If the record does not show it, we count it from the start of validity and the validity period shown on the product card.</li>
      </ul>
      <p>(d) <strong>Validity has not started.</strong></p>
      <ul class="list">
        <li>If the plan’s validity has not started — the plan has not been activated or connected — we refund <strong>100 %</strong>, but only if:
          <ul class="list">
          <li>the technical fault is confirmed; or</li>
          <li>the law requires a refund.</li>
          </ul>
        </li>
        <li>A plan whose validity has not started is not refunded for any other reason (section 5).</li>
      </ul>
      <p>(e) <strong>eSIM never worked.</strong></p>
      <ul class="list">
        <li>If the eSIM could not be installed, or never connected to a network, because of a fault that our support has confirmed, we refund <strong>100 %</strong>, for any plan type.</li>
        <li>Please report it within the period in section 3.5, and tell us what happened when you tried — for example, the error message shown or a screenshot, and your device model. Where the fault itself prevents installation or connection, a description of what you saw is enough; we do not ask for anything your device cannot show.</li>
        <li>We confirm the fault by checking the eSIM’s status and records with our eSIM service provider, and by the steps we take with you under section 3.3.</li>
        <li>An eSIM that was simply not installed or not used is not a fault (section 5).</li>
      </ul>
      <p>(f) <strong>Usage cannot be established.</strong></p>
      <ul class="list">
        <li>If our eSIM service provider does not give us a usage record, we check the other technical data available, for example the eSIM’s status, its connection history and the information you send us.</li>
        <li>A missing record is not treated as proof that no data was used.</li>
        <li>If usage still cannot be established, we decide individually and always respect your statutory rights.</li>
      </ul>
      <p>(g) <strong>What the records show.</strong></p>
      <ul class="list">
        <li>Our eSIM service providers report the total data used on an eSIM and, where they report them, when the plan was installed or activated and when it ends. They do not report the data used on each day.</li>
        <li>Their usage records are not updated in real time and may be a few hours behind.</li>
        <li>Where a calculation in this section depends on use on a particular day, we use these records, the information you send us and the steps under section 3.3; where that use still cannot be established, (f) applies.</li>
      </ul>
      <p><strong>Payment method and statutory rights.</strong></p>
      <ul class="list">
        <li>Refunds under this section are paid only to the original payment method (section 6).</li>
        <li>If the law gives you a higher amount, for example a full refund, the law prevails over these rules (section 4).</li>
      </ul>
      <p>3.5. <strong>When to report a fault.</strong></p>
      <ul class="list">
        <li>Please report a fault during the plan’s validity period, or within 14 days after it ends.</li>
        <li>If the plan’s validity has not started, please report a fault within 14 days after you first tried to install or use the eSIM, and in any case before its activation period ends (Terms of Service, section 8.4).</li>
        <li>A later report does not take away your statutory rights. However, the fault may then be impossible to confirm.</li>
      </ul>
      <p>3.6. <strong>After a refund.</strong></p>
      <ul class="list">
        <li>A refund under this section ends the plan. We may deactivate the eSIM once the refund is approved.</li>
        <li>Please stop using the eSIM after your report — switch off mobile data for the Magic eSIM line — while we look into the fault.</li>
        <li>Use that our support asks you to make to test the eSIM, and use of a replacement eSIM we provide, is not deducted under this section; it is counted only once, under section 3.3.</li>
        <li>For other data used after your report, we deduct: for plans with a fixed data allowance, the data used; for daily plans, the share of each further day’s allowance used; for unlimited plans, each further day on which data was used.</li>
        <li>The final refund is the amount calculated under section 3.4, less any such deduction.</li>
      </ul>`,
    },
    {
      id: 'your-statutory-rights', h2: "4. Your statutory rights", html: `
      <p>4.1. <strong>Statutory rights apply.</strong></p>
      <ul class="list">
        <li>Depending on where you live and which law applies to your purchase, you may have rights in addition to sections 2 and 3. Examples are the law of Georgia, of a country of the European Union or of the United Kingdom, the Australian Consumer Law and New Zealand’s Consumer Guarantees Act 1993.</li>
        <li>We honour every statutory right that applies to your purchase, including where section 5 says that no voluntary refund is given.</li>
      </ul>
      <p>4.2. <strong>Right of withdrawal (in the United Kingdom: right to cancel).</strong></p>
      <ul class="list">
        <li>If the law gives you this right — for example if you live in the European Union or the United Kingdom — you may withdraw from your purchase within <strong>14 days after the day you place your order</strong>, without giving a reason.</li>
        <li>So that your plan can start straight away, at checkout we ask you to tick a separate box. It is never pre-ticked. The box reads:</li>
      </ul>
      <blockquote>
        <p>“I ask Magic eSIM to start providing my eSIM plan now, within the 14-day withdrawal period. I understand that I lose my right of withdrawal once the plan has been fully provided (its data is used up or its validity has ended), and that if I withdraw before then I will pay for the part of the plan provided up to the time I tell you.”</p>
      </blockquote>
      <ul class="list">
        <li>We repeat this text, with the date and time you ticked the box, in your order confirmation email.</li>
      </ul>
      <p>4.3. <strong>What we refund if you withdraw.</strong> If you validly withdraw:</p>
      <ul class="list">
        <li>if <strong>no part of the plan has been provided</strong> — the plan’s validity has not started and no data has been used — we refund the full price;</li>
        <li>otherwise we refund the price <strong>less the value of the part of the plan provided</strong> up to the time you told us you are withdrawing, where the law allows us to keep it. We calculate that value in the same way as in section 3.4, by type of plan:
          <ul class="list">
          <li>plans with a fixed data allowance — in proportion to the data used;</li>
          <li>daily plans — in proportion to the days used, counting the day of your notice by the share of that day’s allowance you used;</li>
          <li>unlimited plans — in proportion to the time of validity that has passed up to your notice, counted in hours as in section 3.4(c), so a day that has started is not counted as fully provided;</li>
          </ul>
        </li>
        <li>where the law requires a full refund, for example because we did not inform you properly, we refund in full;</li>
        <li>when you withdraw, the plan ends. If you continue to use it after your notice, we deduct the value of that later use, where the law allows.</li>
      </ul>
      <p>4.4. <strong>If a plan does not work as described.</strong></p>
      <ul class="list">
        <li>The law gives you rights if a plan does not conform to the contract. Depending on the applicable law, these can include having the problem fixed, a price reduction, or ending the contract with a refund.</li>
        <li>Section 3 is how we handle such cases in practice. It does not limit those rights.</li>
      </ul>
      <p>4.5. <strong>How to withdraw.</strong></p>
      <ul class="list">
        <li>Tell us clearly by email to <a href="mailto:support@magicesim.store">support@magicesim.store</a>. You can use a model form below or your own words.</li>
        <li>It is enough to send your message before the withdrawal period ends.</li>
        <li>We confirm receipt by email.</li>
      </ul>
      <blockquote>
        <p><strong>Model withdrawal form</strong> (European Union)</p>
        <p>(complete and return this form only if you wish to withdraw from the contract)</p>
        <p>— To: Individual Entrepreneur ALEKSANDR KHARIN (Magic eSIM), Bakhtrioni str. N22, Apt. 75, Saburtalo district, Tbilisi, Georgia, <a href="mailto:support@magicesim.store">support@magicesim.store</a>:<br>
        — I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of the following goods (*)/for the provision of the following service (*),<br>
        — Ordered on (*)/received on (*),<br>
        — Name of consumer(s),<br>
        — Address of consumer(s),<br>
        — Signature of consumer(s) (only if this form is notified on paper),<br>
        — Date</p>
        <p>(*) Delete as appropriate.</p>
      </blockquote>
      <blockquote>
        <p><strong>Model cancellation form</strong> (United Kingdom)</p>
        <p>To: Individual Entrepreneur ALEKSANDR KHARIN (Magic eSIM), Bakhtrioni str. N22, Apt. 75, Saburtalo district, Tbilisi, Georgia, <a href="mailto:support@magicesim.store">support@magicesim.store</a>:</p>
        <p>I/We [*] hereby give notice that I/We [*] cancel my/our [*] contract of sale of the following goods [*]/for the supply of the following service [*],<br>
        Ordered on [*]/received on [*],<br>
        Name of consumer(s),<br>
        Address of consumer(s),<br>
        Signature of consumer(s) (only if this form is notified on paper),<br>
        Date</p>
        <p>[*] Delete as appropriate.</p>
      </blockquote>
      <p>To help us find your order, you may add your order reference and the email address used for the order. If you write to us by email, your name and postal address are optional; your order reference and the email address used for the order are enough.</p>
      <p>4.6. <strong>Customers in Australia and New Zealand.</strong></p>
      <p><strong>Australia.</strong> Our services come with guarantees that cannot be excluded under the Australian Consumer Law. For major failures with the service, you are entitled:</p>
      <ul class="list">
        <li>to cancel your service contract with us; and</li>
        <li>to a refund for the unused portion, or to compensation for its reduced value.</li>
      </ul>
      <p>You are also entitled to be compensated for any other reasonably foreseeable loss or damage. If the failure does not amount to a major failure, you are entitled to have problems with the service rectified in a reasonable time and, if this is not done, to cancel your contract and obtain a refund for the unused portion of the contract.</p>
      <p>The benefits we give you under section 3 are in addition to other rights and remedies you have under a law in relation to our services.</p>
      <p><strong>New Zealand.</strong> Nothing in our Terms of Service or in this policy limits your rights under the Consumer Guarantees Act 1993 or the Fair Trading Act 1986, including your rights if a plan is not supplied with reasonable care and skill or is not fit for a purpose you made known to us.</p>`,
    },
    {
      id: 'what-our-voluntary-refunds-do-not-cover', h2: "5. What our voluntary refunds do not cover", html: `
      <p>Unless section 2 or 3 applies, or the law gives you a right (section 4), we do not refund when:</p>
      <ul class="list">
        <li>you chose the <strong>wrong country, region or plan</strong>;</li>
        <li>your <strong>device does not support eSIM</strong>, is <strong>carrier-locked</strong>, or is not compatible with the plan’s network;</li>
        <li>you <strong>changed your mind</strong>, or your trip was cancelled or changed;</li>
        <li>you <strong>did not use</strong> the eSIM. Not using a plan does not by itself give a right to a refund;</li>
        <li>the eSIM was <strong>deleted</strong>, or the device was reset, lost or replaced after installation;</li>
        <li>the plan’s <strong>validity has ended</strong> or its <strong>data allowance has been used up</strong>;</li>
        <li>speed was reduced under a stated <strong>fair-usage limit</strong>, or because of normal network conditions;</li>
        <li>the plan was restricted because of a breach of our <strong>acceptable-use rules</strong>.</li>
      </ul>
      <p>Please check your device and the plan before you buy, and contact us if you are unsure.</p>`,
    },
    {
      id: 'how-to-ask-for-a-refund', h2: "6. How to ask for a refund", html: `
      <p>6.1. <strong>How to ask.</strong></p>
      <ul class="list">
        <li>Write to <a href="mailto:support@magicesim.store">support@magicesim.store</a>. Include your order reference, the email address used for the order, and the reason for your request.</li>
        <li>You can email us at any time. We reply on business days and aim to send a first reply within <strong>1–2 business days</strong>, usually sooner.</li>
      </ul>
      <p>6.2. <strong>How you are refunded.</strong></p>
      <ul class="list">
        <li>Approved refunds are made to the <strong>original payment method</strong>; we do not send refunds to another card, account or person.</li>
        <li>If a refund to the original payment method cannot be completed — for example, because the card account has been closed — we will contact you and agree, at no cost to you, how to return the money to you.</li>
        <li>After approval, the money usually arrives within <strong>5–10 banking days</strong>, depending on the payment provider and your bank.</li>
        <li>For a statutory withdrawal, we send the refund no later than <strong>14 days</strong> after receiving your notice.</li>
      </ul>
      <p>6.3. <strong>Amount and currency.</strong></p>
      <ul class="list">
        <li>We refund the amount you actually paid, in US dollars, without a refund fee.</li>
        <li>If your card account is in another currency, your bank’s exchange rate and fees apply.</li>
      </ul>`,
    },
    {
      id: 'payment-disputes', h2: "7. Payment disputes", html: `
      <ul class="list">
        <li>You can contact your bank or card issuer at any time. This policy does not limit that right.</li>
        <li>We encourage you to contact us first, because we can usually solve a problem faster.</li>
        <li>If you open a dispute, we will give the payment provider the information about your order.</li>
        <li>If you receive a refund from us and also through a dispute for the same payment, we may ask you to return the duplicate amount.</li>
      </ul>`,
    },
    {
      id: 'contact', h2: "8. Contact", html: `
      <p>Individual Entrepreneur ALEKSANDR KHARIN (Magic eSIM), Bakhtrioni str. N22, Apt. 75, Saburtalo district, Tbilisi, Georgia<br>
      Email: <a href="mailto:support@magicesim.store">support@magicesim.store</a></p>`,
    },
  ],
});
