// The English support page of the international website — /en/support/ (English only; no twin in another language).
//
// ONE source for the page; seo/build-locale-pages.mjs renders it for English in the frame of the legal pages (hero,
// «On this page», one card per section). EVERY SENTENCE RESTATES A PUBLISHED DOCUMENT — the Terms of Service
// (seo/terms-en.mjs), the Refund Policy (seo/refund-en.mjs) or the Privacy Policy (seo/privacy-en.mjs); the section and
// its source are named in the comment above each block. Nothing here may add a channel, an hour, a reply time, a phone
// number or a refund the documents do not state; when a document changes, re-read this page against it.
// seo/test-en-support-page.mjs pins the page: the address, the three documents, the guides, no Telegram, no forbidden claim.
import { EN_GUIDES } from './guides-en.mjs';

export const SUPPORT_PATH = '/en/support/';
const ADDRESS = 'support@magicesim.store';
const MAIL = `<a href="mailto:${ADDRESS}">${ADDRESS}</a>`;

/* The link to this page in the English footer, after the legal links (seo/build-locale-pages.mjs). English only: the
 * other languages' tests compare their markup with the English pages' after removing exactly this string. */
export const SUPPORT_FOOTER_LINK = ` · <a href="${SUPPORT_PATH}">Support</a>`;

// The guides, in the order of the guide list, by their own titles (seo/guides-en.mjs).
const GUIDE_LIST = EN_GUIDES.map((g) => `        <li><a href="/en/guides/${g.slug}/">${g.h1}</a></li>`).join('\n');

export const SUPPORT = Object.freeze({
  title: 'Support — Magic eSIM',
  description: 'Contact Magic eSIM support by email: help with installing an eSIM, connection problems and refunds. International payments are currently unavailable.',
  h1: 'Support',
  crumb: 'Support',
  lead: 'How to reach us, what to put in your message, and where to find help with installing and using an eSIM.',
  sections: [
    {
      // Terms §11.1, §11.2 (contact, reply times); Terms «About these Terms» (scope); Terms §1 (seller);
      // Privacy «applies … when you contact our support team».
      id: 'contact-support', h2: 'Contact Support', html: `
      <p>Email: ${MAIL}. You can email us at any time, 24 hours a day, 7 days a week.</p>
      <p>We reply on business days and aim to send a first reply within 1–2 business days, usually sooner.</p>
      <p>This page is about the Magic eSIM international website. The Russian-language website magicesim.store is governed by separate terms published there.</p>
      <p>Plans on this website are sold by Individual Entrepreneur ALEKSANDR KHARIN, registered in Georgia, trading as Magic eSIM (<a href="/en/terms/#who-we-are">Terms of Service, section 1</a>). How we handle the information you send us is described in our <a href="/en/privacy/">Privacy Policy</a>.</p>`,
    },
    {
      // Terms «About these Terms» and §6.2 (payments unavailable); §2.1 (one-off payment); §7.1–§7.3 (delivery, resend);
      // Refund Policy §2 (duplicate payment, charge in error).
      id: 'order-and-payment-issues', h2: 'Order & Payment Issues', html: `
      <p><strong>International payments are currently unavailable.</strong> You can browse plans and get an exact price on this website, but you cannot place an order or pay.</p>
      <p>Our <a href="/en/terms/">Terms of Service</a> describe how ordering works when international checkout becomes available:</p>
      <ul class="list">
        <li>Each purchase is a one-off payment for one package. It is not a subscription and does not renew automatically.</li>
        <li>Delivery is electronic, by email to the address you entered. The eSIM is usually delivered within a few minutes after the payment is confirmed.</li>
        <li>If you have not received it within 1 hour, check your spam folder and write to us.</li>
        <li>We resend the eSIM to the address used for the order on request.</li>
        <li>A duplicate payment, or any amount charged in error, is refunded in full (<a href="/en/refund/">Refund Policy</a>, section 2).</li>
      </ul>`,
    },
    {
      // Terms §4.1–§4.2 (compatibility); §8.1–§8.4 (installation, one device, start of validity, activation period).
      id: 'esim-installation-and-activation', h2: 'eSIM Installation & Activation', html: `
      <p>Your device must support eSIM and must not be locked to a mobile operator. Please check compatibility before you buy; if you are unsure, contact us first.</p>
      <p>Our guides explain each step:</p>
      <ul class="list">
${GUIDE_LIST}
      </ul>
      <ul class="list">
        <li>You need an internet connection, for example Wi-Fi, to install the eSIM.</li>
        <li>An eSIM can normally be installed only once and only on one device. It cannot be moved to another device.</li>
        <li><strong>Do not delete an installed eSIM.</strong> A deleted eSIM usually cannot be restored.</li>
        <li>When the validity period starts is set for each plan. Depending on the plan, it is the installation of the eSIM, its first connection to a network, its first use of data, or the purchase.</li>
        <li>An eSIM that is not activated within its plan’s activation period expires unused. If you do not intend to install the eSIM soon after buying it, ask us for the period of your plan before you pay.</li>
      </ul>`,
    },
    {
      // Terms §2.2 (data only), §2.4 (coverage and speed), §2.5 (data roaming), §2.6 (roaming connection),
      // §9.4 (identity registration), §9.5 (device rules), §10.1–§10.2 (if something goes wrong).
      id: 'connectivity-and-roaming-issues', h2: 'Connectivity & Roaming Issues', html: `
      <ul class="list">
        <li>Data roaming usually has to be switched on for the Magic eSIM line. Switch it on <strong>for the Magic eSIM line only</strong>.</li>
        <li>To avoid charges from your home mobile operator, keep data roaming switched off for your other SIM and choose the Magic eSIM line for mobile data.</li>
        <li>Plans connect to partner networks in the destination as a roaming connection, and your connection may be routed through another country. Websites and apps may therefore see an IP address or location outside the country you are in.</li>
        <li>Coverage, speed and availability depend on the local operator’s network, your location, your device and its settings, and network load.</li>
        <li>Plans provide mobile data. They do not include a phone number, voice calls or SMS unless the product card says so.</li>
        <li>In some destinations the law or the network operator requires users of certain plans to register their identity. The plan may not work until registration is complete.</li>
        <li>Some countries require a device brought from abroad to be registered after a period of stay. An unregistered device may be blocked by the local networks, whichever eSIM it uses.</li>
      </ul>
      <p>If your plan does not connect, start with the checks in <a href="/en/guides/troubleshooting/">eSIM not working — what to check</a>. If it still does not work, write to us. Please do not delete the eSIM while we are helping you. We try to fix the problem, for example by guiding you through settings, reissuing installation details or providing a replacement eSIM.</p>`,
    },
    {
      // Refund Policy «About this policy» (applies once checkout is available; the general rule; statutory rights),
      // §1 (summary), §2 (errors and non-delivery), §3.3 (technical faults).
      id: 'refunds', h2: 'Refunds', html: `
      <p>Our <a href="/en/refund/">Refund Policy</a> is part of our Terms of Service. It applies to plans bought once international checkout becomes available.</p>
      <p>Paid purchases are not refundable or exchangeable except as required by the law that applies to your purchase or as expressly provided in the Refund Policy:</p>
      <ul class="list">
        <li>A duplicate payment, or any amount charged in error, is refunded in full.</li>
        <li>If we could not deliver the eSIM you paid for, or we cancel your order, we refund the full amount paid.</li>
        <li>For a technical fault that our support has confirmed and cannot fix, we offer a replacement eSIM or a full or partial refund.</li>
        <li>Your statutory rights, including the right of withdrawal where the law gives it, are always honoured.</li>
      </ul>
      <p>For any other reason — you chose the wrong plan, your device is not compatible, your trip changed, you did not use the eSIM — there is no voluntary refund. The <a href="/en/refund/">Refund Policy</a> sets out the details.</p>`,
    },
    {
      // Terms §10.1 (order reference, device model, screenshots); §7.3 (the address used for the order);
      // Refund Policy §3.2 (a description of the problem); §6.2 and §7.4 (card details; keep the eSIM private).
      id: 'information-needed-for-support', h2: 'Information Needed for Support', html: `
      <p>To help us find your order and look into the problem, please include in your message:</p>
      <ul class="list">
        <li>your order reference;</li>
        <li>the email address used for the order;</li>
        <li>your device model and its operating system version;</li>
        <li>the destination where you use, or plan to use, the eSIM;</li>
        <li>a short description of the problem and, if possible, screenshots of the error.</li>
      </ul>
      <p><strong>Never send us</strong> a card number or security code, a password, or the eSIM’s QR code or installation details. We never receive or store your full card number or security code. The QR code and installation details give access to your plan. Do not share them.</p>`,
    },
  ],
});
