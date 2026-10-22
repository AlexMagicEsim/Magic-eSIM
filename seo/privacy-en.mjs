// The English Privacy Policy of the international website — PRE-LAUNCH version (LEGAL-1).
//
// ONE source for /en/privacy/ (built by seo/build-locale-pages.mjs for English only). The text is the owner-approved
// LEGAL-0 final edition «01 Privacy Policy — pre-launch (EN)», with the support-mail route stated only as far as public
// DNS proves it (MX → ImprovMX; sending → Proton). It describes what the international website does TODAY: no orders,
// no payments, no cookies, no analytics. When international sales open, this text is replaced by the full version —
// never describe a process here before it runs. seo/test-en-privacy.mjs pins the facts it states.
//
// Written for the page: plain HTML fragments, English typography (curly quotes, en dashes), no tables — every
// list reads on a 320 px phone without horizontal scrolling.

export const PRIVACY_VERSION = '0.9 (pre-launch)';
export const PRIVACY_EFFECTIVE = '22 October 2026';
export const PRIVACY_EFFECTIVE_ISO = '2026-10-22';

export const PRIVACY = Object.freeze({
  title: 'Privacy Policy — Magic eSIM',
  description: 'How Magic eSIM handles personal data on its international website before online purchases open: no account, no cookies, no analytics.',
  h1: 'Privacy Policy',
  lead: 'How we handle personal data when you visit the Magic eSIM international website or write to our support team.',
  crumb: 'Privacy Policy',
  sections: [
    {
      id: 'scope', h2: 'About this policy', html: `
      <p>This Privacy Policy applies when you visit the Magic eSIM international website — magicesim.store/en/ and its other non-Russian language versions — and when you contact our support team.</p>
      <p><strong>Online purchases are not yet available on the international website.</strong> Before they become available, we will publish an updated Privacy Policy that covers orders, payments and the delivery of eSIMs.</p>
      <p>The Russian-language version of the website has its own privacy policy, which applies when you use that version.</p>`,
    },
    {
      id: 'who-we-are', h2: '1. Who we are', html: `
      <p>The controller of your personal data is:</p>
      <ul class="list">
        <li><strong>Individual Entrepreneur ALEKSANDR KHARIN</strong>, registered in Georgia, trading as <strong>Magic eSIM</strong></li>
        <li>Identification number: 305887261</li>
        <li>Address: Georgia, Tbilisi, Saburtalo district, Bakhtrioni str. N22, Apt. 75</li>
        <li>Email for privacy questions: <a href="mailto:support@magicesim.store">support@magicesim.store</a></li>
      </ul>`,
    },
    {
      id: 'data', h2: '2. What data we process and why', html: `
      <p>We do not require you to create an account. We do not ask for your name, telephone number, identity documents or payment details.</p>
      <h3>When you browse the website</h3>
      <ul class="list">
        <li><strong>Data:</strong> your IP address, browser and device information, the pages you request and when you request them.</li>
        <li><strong>Why:</strong> to show you the website and to protect it against misuse.</li>
        <li><strong>Legal basis:</strong> our legitimate interest in running a secure website.</li>
      </ul>
      <h3>When you ask for the exact price of a plan</h3>
      <ul class="list">
        <li><strong>Data:</strong> the plan and the number of days you chose, together with your IP address and technical data.</li>
        <li><strong>Why:</strong> to calculate the current price and hold it for 30 minutes.</li>
        <li><strong>Legal basis:</strong> our legitimate interest, and steps you ask us to take before a possible purchase.</li>
      </ul>
      <p>Our server uses your IP address only briefly, in memory, to stop excessive requests; it does not save it with the price request. The saved price record contains no personal data.</p>
      <h3>When you enter an email address in the order preview</h3>
      <p>Nothing is sent to us. While purchases are unavailable, the address stays in your browser.</p>
      <h3>When you write to support</h3>
      <ul class="list">
        <li><strong>Data:</strong> your email address, your message and any attachments.</li>
        <li><strong>Why:</strong> to answer you.</li>
        <li><strong>Legal basis:</strong> our legitimate interest in answering enquiries, and steps you ask us to take before a possible purchase.</li>
      </ul>
      <h3>Logs</h3>
      <p>Our hosting provider keeps technical logs of requests to our server for a limited period (see section 6). These logs may include IP addresses and, occasionally, parts of requests that our server could not process.</p>
      <h3>What we do not do</h3>
      <p>We do not sell personal data, we do not use it for advertising or profiling, and we do not send marketing emails.</p>`,
    },
    {
      id: 'cookies', h2: '3. Cookies and local storage', html: `
      <p>The international website uses <strong>no cookies</strong> and <strong>no analytics, advertising or tracking tools</strong>.</p>
      <p>It stores only two small values in your browser:</p>
      <ul class="list">
        <li><code>mesim.site.lang</code> (local storage) remembers the language you chose, until you clear it.</li>
        <li><code>me-logo</code> (session storage) plays the logo animation once per visit, until you close the tab.</li>
      </ul>
      <p>These values only make the website display as you asked; they are not sent to us. If we ever add an analytics or similar tool, we will first update this policy and ask for your consent where the law requires it.</p>`,
    },
    {
      id: 'providers', h2: '4. Service providers who process data for us', html: `
      <p>To run the website and our support, we use the following service providers. Each processes data only to provide its service.</p>
      <h3>GitHub, Inc., with its network provider Fastly, Inc.</h3>
      <p>Hosts the website’s pages. GitHub also logs visitors’ IP addresses for its own security purposes, under its own privacy statement. <em>Data:</em> IP address and technical data of your visit. <em>Where:</em> United States; global network.</p>
      <h3>Render Services, Inc., with its network provider Cloudflare, Inc.</h3>
      <p>Runs the server that answers price requests. <em>Data:</em> IP address, technical data, and the plan and number of days requested. <em>Where:</em> a United States company; data may be processed in the United States and in other countries where Render and its providers operate.</p>
      <h3>ImprovMX Incorporated</h3>
      <p>Receives emails sent to support@magicesim.store and forwards them to our mailbox. It keeps delivery logs for 7 days and holds the message content only until it is delivered. <em>Data:</em> your email address, the message headers and the message content in transit. <em>Where:</em> a United States company; its receiving servers are in France, and forwarding may pass through the United States.</p>
      <h3>Our email service providers</h3>
      <p>Our support mailbox is held by an email service provider, and our replies are sent through Proton AG, Switzerland. <em>Data:</em> your email address and the messages exchanged with us.</p>
      <p>We may also disclose data where the law requires it, or where it is necessary to establish or defend legal claims.</p>`,
    },
    {
      id: 'international', h2: '5. International processing of data', html: `
      <p>We are based in Georgia, but our service providers are international companies. As a result, your data may be processed outside Georgia — in the United States, in member states of the European Economic Area, in Switzerland and in other countries where these providers or their own providers operate.</p>
      <p>Some of these countries, including the United States, do not offer the same level of data protection as Georgia or the European Union. Authorities there may be able to access data in circumstances that would not be allowed in Georgia or the EU.</p>
      <p>What we do to protect your data:</p>
      <ul class="list">
        <li>We collect very little data: no account, no analytics or tracking, no payment data.</li>
        <li>We use established providers that publish data protection terms for their customers. Render’s data processing terms include the European Union’s Standard Contractual Clauses, and Render and GitHub take part in the EU–U.S. Data Privacy Framework.</li>
        <li>Data travelling to and from our website and server is encrypted (HTTPS).</li>
      </ul>
      <p>You can ask us for more information about these safeguards by writing to support@magicesim.store.</p>`,
    },
    {
      id: 'retention', h2: '6. How long we keep data', html: `
      <p>When a period ends, we delete the data or make it anonymous. If data is needed for a dispute or a legal claim, we keep it until the matter is closed.</p>
      <ul class="list">
        <li><strong>Support emails:</strong> 3 years after the last message, so that we can deal with follow-up questions and claims.</li>
        <li><strong>Records of privacy requests and our answers:</strong> 3 years after the request is closed.</li>
        <li><strong>Price records</strong> (no personal data): 90 days.</li>
        <li><strong>Hosting logs of our server:</strong> 7 to 30 days, depending on the hosting plan (set by Render).</li>
        <li><strong>Email forwarding logs:</strong> 7 days (set by ImprovMX).</li>
        <li><strong>Website visitor logs:</strong> as stated in GitHub’s privacy statement.</li>
      </ul>`,
    },
    {
      id: 'rights', h2: '7. Your rights', html: `
      <p>You can ask us:</p>
      <ul class="list">
        <li>whether we process your data, and for a copy of it;</li>
        <li>to correct inaccurate data;</li>
        <li>to delete your data, unless we must keep it by law or for a legal claim;</li>
        <li>to block (restrict) the processing of your data;</li>
        <li>to give you your data in a portable format;</li>
        <li>to stop processing your data on the basis of our legitimate interests;</li>
        <li>to withdraw any consent you have given.</li>
      </ul>
      <p>To make a request, write to <a href="mailto:support@magicesim.store">support@magicesim.store</a> from the email address the request concerns. We may ask you to confirm your identity before we act. Requests are free of charge.</p>
      <p>We answer within 10 working days; where the law allows, we may extend this once and will tell you why. We block data within 3 working days of a justified request.</p>
      <p>You can complain to the State Audit Office of Georgia (sao.ge) or to a court. If you are in the European Union, you can also complain to the data protection authority of your country.</p>`,
    },
    {
      id: 'security', h2: '8. Security', html: `
      <p>We use encrypted connections (HTTPS), limit access to the people who need it, and do not collect payment data. No method of transmission or storage is completely secure.</p>`,
    },
    {
      id: 'children', h2: '9. Children', html: `
      <p>The international website is not intended for people under 18.</p>`,
    },
    {
      id: 'changes', h2: '10. Changes to this policy', html: `
      <p>When we change this policy, we publish the new version on this page with its effective date. Before online purchases open on the international website, we will publish a new version that covers orders and payments.</p>`,
    },
    {
      id: 'contact', h2: '11. Contact', html: `
      <p>Individual Entrepreneur ALEKSANDR KHARIN (Magic eSIM), Georgia<br>
      <a href="mailto:support@magicesim.store">support@magicesim.store</a></p>`,
    },
  ],
});
