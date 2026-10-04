// The English guides: /en/guides/<slug>/. Data only; seo/build-en-pages.mjs
// renders them (build-all runs it, so a rebuild never skips them — unlike the
// Russian build-guides.mjs, which build-all does NOT run).
//
// FACT POLICY — every rule below exists because the Russian corpus broke it once.
//
//   * Menu paths are TYPICAL and are said to vary by OS version and brand. No
//     path is quoted as exact.
//   * Nothing about what Magic eSIM will deliver, or how. GLOBAL cannot sell
//     yet (no order, no payment, no delivery email exists for it), so a guide
//     may say «your eSIM's QR code» and never «the email we send you».
//   * NO pointer to a card row the English pages do not show. The Russian
//     guides send readers to the «Начало срока» row; the English plan cards
//     have no such row. So the start-of-term advice is the one that is SAFE
//     WHATEVER the rule: install on the day you travel, over Wi-Fi.
//   * No network-quality promise in a place, no hotspot / APN / calls / SMS /
//     2FA guarantee, no device-model list, no payment method.
//   * No claim that a QR code can be reused: it «may be single-use».
//
// SOURCES — every menu label and path below was checked against the vendor's
// own documentation on 2026-10-04; a label not found there was removed:
//   Apple   support.apple.com/en-us/118669 (Set up eSIM on iPhone: Camera →
//           «Cellular Plan Detected» → Continue → Add Cellular Plan; iOS 17.4+
//           touch and hold → Add eSIM; Settings → Cellular or Mobile Data → Add
//           Cellular Plan → Enter Details Manually), 118227 (travel eSIM; Carrier
//           Lock «No SIM Restrictions» in Settings → General → About; Cellular →
//           Cellular Data), 109317 (Dual SIM with eSIM: data roaming per number;
//           Cellular Plan Label).
//   Google  support.google.com/pixelphone/answer/16115470 (Network & internet →
//           SIMs → Add SIM → Set up an eSIM), 9449293 (Mobile network → Use this
//           SIM; SIMs → Mobile data), 2926415 (Roaming, Network, APN settings
//           exist), 7107188 (SIM-locked phones), 10402530 (EID in About phone →
//           SIM status; «To use an eSIM, a phone also needs an EID»).
//   Samsung samsung.com/uk/support/mobile-devices/how-to-use-an-esim-with-your-
//           galaxy-phone/ (Connections → SIM card manager → Add mobile plan →
//           Add using QR code / Add using activation code), .../how-do-i-turn-
//           international-data-roaming-on-or-off-on-my-samsung-galaxy-device/
//           (Connections → Mobile Networks → Data Roaming).
//   NOT found in any of them, so NOT stated: the *#06# check, the names
//   «SM-DP+ address» and «activation code» on iPhone/Pixel, «Download a SIM».
//
// seo/test-en-guides.mjs enforces these on the rendered pages.

export const EN_GUIDES = [
  // ------------------------------------------------------------------ iPhone
  {
    slug: 'iphone',
    nav: 'iPhone',
    title: 'How to install an eSIM on iPhone — step by step | Magic eSIM',
    description: 'Install a travel eSIM on iPhone with a QR code or by entering the details manually, then switch on data for the trip.',
    h1: 'How to install an eSIM on iPhone',
    blurb: 'By QR code or by hand, and what to switch on when you land.',
    lead: 'Installing takes a few minutes and needs an internet connection — Wi-Fi is easiest. Below is the whole path: checking that your iPhone supports eSIM, installing the profile, and turning on mobile data at your destination.',
    sections: [
      { h2: 'Check that your iPhone supports eSIM', html: `
        <p>Open <strong>Settings → Cellular</strong> (called <strong>Mobile Data</strong> in some regions). If you see <strong>Add eSIM</strong> or <strong>Add Cellular Plan</strong>, your iPhone supports eSIM.</p>
        <p>Your iPhone must also not be locked to one carrier. See <a href="/en/guides/compatibility/">how to check compatibility</a>.</p>` },
      { h2: 'Option 1 — scan the QR code', html: `
        <ol class="steps">
          <li>Show your eSIM's QR code on another screen: a computer, a tablet or a second phone.</li>
          <li>On the iPhone, open the <strong>Camera</strong> app and scan the QR code.</li>
          <li>When the <strong>Cellular Plan Detected</strong> notification appears, tap it.</li>
          <li>Tap <strong>Continue</strong>, then <strong>Add Cellular Plan</strong>. If you are asked for a confirmation code, enter the one provided with your eSIM.</li>
          <li>Give the line a clear name, such as «Travel», so you do not mix it up with your main SIM.</li>
        </ol>
        <p class="note">With iOS 17.4 or later, if the QR code is in an email or on a web page on the iPhone itself, touch and hold the code, then tap <strong>Add eSIM</strong>.</p>` },
      { h2: 'Option 2 — enter the details manually', html: `
        <ol class="steps">
          <li>Find the details for manual installation that come with your eSIM.</li>
          <li>Open <strong>Settings → Cellular</strong> (or <strong>Mobile Data</strong>) and tap <strong>Add Cellular Plan</strong>.</li>
          <li>Tap <strong>Enter Details Manually</strong> and type in those details.</li>
          <li>Confirm, and wait until the installation finishes.</li>
        </ol>
        <p class="note">Useful when there is no QR code to scan.</p>` },
      { h2: 'At your destination — turn on data', html: `
        <ol class="steps">
          <li>In <strong>Settings → Cellular</strong>, make sure the eSIM line is turned on.</li>
          <li>Tap <strong>Cellular Data</strong> and choose the eSIM line. Your main SIM can stay on for calls and texts.</li>
          <li>Open the eSIM line and turn on <strong>Data Roaming</strong>. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.</li>
          <li>If you do not want charges from your home operator, turn off data roaming on your main SIM.</li>
          <li>Give the phone a minute or two to register on a local network.</li>
        </ol>
        <p class="note">Menu names can differ slightly between iOS versions.</p>` },
      { h2: 'If something goes wrong', html: `
        <p>Check that the eSIM is the line chosen for cellular data and that data roaming is on for it, then restart the phone. The full checklist is in <a href="/en/guides/troubleshooting/">eSIM not working</a>.</p>
        <p><strong>Do not delete the eSIM</strong> while troubleshooting: its QR code may be single-use, and you may not be able to install it again.</p>` },
    ],
    faq: [
      { q: 'Do I need Wi-Fi to install an eSIM on iPhone?', a: 'You need an internet connection to download the profile, and Wi-Fi is the easiest. Installing on the day you travel, before you leave home or on airport Wi-Fi, works whatever the plan\'s rules for when its validity starts.' },
      { q: 'The QR code is on this same iPhone. Can I still install it?', a: 'Yes. With iOS 17.4 or later, touch and hold the QR code in the email or web page, then tap Add eSIM. Or choose Enter Details Manually and type in the details provided with your eSIM.' },
      { q: 'What happens to my main number?', a: 'It stays on. Calls and texts to your main number follow your home operator\'s roaming terms; the travel eSIM is used for mobile data.' },
      { q: 'Why turn on data roaming for the eSIM?', a: 'Travel eSIMs usually connect through partner networks, which the phone treats as roaming. Data roaming on the eSIM line is a normal setting; you can keep it off on your main SIM.' },
    ],
    related: ['android', 'compatibility', 'activation', 'troubleshooting'],
  },

  // ----------------------------------------------------------------- Android
  {
    slug: 'android',
    nav: 'Android',
    title: 'How to install an eSIM on Android — Samsung, Pixel and others | Magic eSIM',
    description: 'Install a travel eSIM on an Android phone with a QR code or manually, set it as the mobile data line and turn on roaming at your destination.',
    h1: 'How to install an eSIM on Android',
    blurb: 'Where the eSIM setting usually is, by brand, and the first steps abroad.',
    lead: 'Android brands name their settings differently, but the steps are the same everywhere: find where SIMs are managed, add an eSIM with its QR code or by hand, then choose it for mobile data at your destination. You need an internet connection to install — Wi-Fi is easiest.',
    sections: [
      { h2: 'Find where SIMs are managed', html: `
        <p>The SIM settings usually live in one of these places — names vary by brand and Android version:</p>
        <ul class="list">
          <li><strong>Google Pixel:</strong> Settings → Network &amp; internet → SIMs → <strong>Add SIM</strong> → <strong>Set up an eSIM</strong>.</li>
          <li><strong>Samsung Galaxy:</strong> Settings → Connections → SIM card manager → <strong>Add mobile plan</strong>.</li>
          <li><strong>Other brands:</strong> look for «Mobile network», «SIM cards» or «Connections» in Settings.</li>
        </ul>
        <p>If there is no option to add an eSIM anywhere, check <a href="/en/guides/compatibility/">whether your phone supports eSIM</a>.</p>` },
      { h2: 'Install the eSIM', html: `
        <ol class="steps">
          <li>Show your eSIM's QR code on another screen.</li>
          <li>Start adding an eSIM as above. <strong>Samsung:</strong> tap <strong>Add using QR code</strong> and scan the code. <strong>Pixel:</strong> follow the instructions on the screen.</li>
          <li>No QR code to scan? On Samsung, tap <strong>Add using activation code</strong> and enter the details provided with your eSIM.</li>
          <li>Confirm, and wait until the installation finishes.</li>
          <li>Rename the eSIM, for example to «Travel».</li>
        </ol>` },
      { h2: 'At your destination — turn on data', html: `
        <ol class="steps">
          <li>Make sure the eSIM is turned on. Pixel: Settings → Network &amp; internet → Mobile network → the eSIM → <strong>Use this SIM</strong>.</li>
          <li>Choose the eSIM as the SIM for <strong>mobile data</strong>. Pixel: Settings → Network &amp; internet → SIMs → <strong>Mobile data</strong>. Your main SIM can stay on for calls and texts.</li>
          <li>Turn on <strong>roaming</strong> for the eSIM. Samsung: Settings → Connections → Mobile Networks → <strong>Data Roaming</strong>. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.</li>
          <li>If you do not want charges from your home operator, turn off data roaming on your main SIM.</li>
          <li>Give the phone a minute or two to register on a local network.</li>
        </ol>` },
      { h2: 'If something goes wrong', html: `
        <p>Check the data SIM and roaming on the eSIM, toggle airplane mode, then restart. The full checklist is in <a href="/en/guides/troubleshooting/">eSIM not working</a>.</p>
        <p><strong>Do not delete the eSIM</strong> while troubleshooting: its QR code may be single-use.</p>` },
    ],
    faq: [
      { q: 'My Android phone has no «Add eSIM» option. What now?', a: 'Look under every SIM-related menu — the name differs by brand. If no option to add or download an eSIM exists anywhere, the phone (or this regional version of it) probably does not support eSIM.' },
      { q: 'Can I use the eSIM and my physical SIM at the same time?', a: 'On phones that support dual SIM with eSIM, yes: choose the eSIM for mobile data and keep the physical SIM for calls and texts.' },
      { q: 'Do I need to set an APN?', a: 'Only if your plan\'s details list an APN: then check that it matches in the eSIM\'s settings.' },
    ],
    related: ['iphone', 'compatibility', 'activation', 'troubleshooting'],
  },

  // ----------------------------------------------------------- compatibility
  {
    slug: 'compatibility',
    nav: 'Compatibility',
    title: 'Does my phone support eSIM? How to check | Magic eSIM',
    description: 'Check eSIM support before you choose a plan: the setting to look for on iPhone and Android, carrier locks and regional versions.',
    h1: 'Does your phone support eSIM?',
    blurb: 'A one-minute check before you choose a plan.',
    lead: 'The quickest check: open your phone\'s SIM settings and look for an option to add an eSIM. If it is there, the phone supports eSIM. Two more things to check at the same time: whether the phone is locked to one carrier, and which regional version you have.',
    sections: [
      { h2: 'Check 1 — the setting', html: `
        <p><strong>iPhone:</strong> Settings → Cellular. <strong>Add eSIM</strong> or <strong>Add Cellular Plan</strong> means eSIM is supported.</p>
        <p><strong>Android:</strong> open the SIM settings and look for a way to add an eSIM — on Pixel, Network &amp; internet → SIMs → <strong>Add SIM</strong> → <strong>Set up an eSIM</strong>; on Samsung, Connections → SIM card manager → <strong>Add mobile plan</strong>.</p>
        <p>An extra hint on Pixel: to use an eSIM, a phone needs an <strong>EID</strong> number. You can find it in Settings → About phone → SIM status. The setting to add an eSIM is still what decides.</p>` },
      { h2: 'Check 2 — is it locked to a carrier?', html: `
        <p>A phone bought on contract may be locked to its carrier and refuse other SIMs and eSIMs until it is unlocked.</p>
        <p>On iPhone, open <strong>Settings → General → About</strong> and look for «No SIM Restrictions» next to <strong>Carrier Lock</strong>. On Android, ask the carrier that sold the phone.</p>` },
      { h2: 'Check 3 — the regional version', html: `
        <p>The same model can have eSIM in one country and not in another: support depends on the market a phone was made for, not only on its name. That is why we do not publish a list of «supported models» — what decides is your own phone's settings.</p>` },
      { h2: 'Your phone qualifies — what next', html: `
        <p>Choose a destination in the <a href="/en/esim/">list of destinations</a>, then read how to install the eSIM on <a href="/en/guides/iphone/">iPhone</a> or <a href="/en/guides/android/">Android</a>.</p>` },
    ],
    faq: [
      { q: 'My phone takes two SIM cards. Does that mean it has eSIM?', a: 'Not necessarily — some phones have two physical slots and no eSIM. Look for the option to add an eSIM in the SIM settings.' },
      { q: 'I cannot find an EID. Is there no eSIM?', a: 'Not necessarily. The option to add an eSIM in the settings is the deciding check.' },
      { q: 'What if my phone does not support eSIM?', a: 'A travel eSIM will not work on it. You would need another phone with eSIM, or a local physical SIM at your destination.' },
    ],
    related: ['iphone', 'android', 'activation', 'troubleshooting'],
  },

  // -------------------------------------------------------------- activation
  {
    slug: 'activation',
    nav: 'When to install',
    title: 'When to install and turn on a travel eSIM | Magic eSIM',
    description: 'Installing an eSIM and starting its validity are different things. When to install, when to switch on the line and data roaming, and a checklist for the day you fly.',
    h1: 'When to install and turn on your eSIM',
    blurb: 'Installing the profile and starting the plan are different events.',
    lead: 'Installing the eSIM and starting its validity are not the same thing, and plans differ on when the validity starts. The advice that is safe for every plan: install on the day you travel, over Wi-Fi, and switch the eSIM on for data when you arrive.',
    sections: [
      { h2: 'Four different steps', html: `
        <ol class="steps">
          <li><strong>Installing</strong> — the phone downloads the eSIM profile with the QR code. Needs internet.</li>
          <li><strong>Turning the line on</strong> — the eSIM appears in your SIM list as active.</li>
          <li><strong>Choosing it for mobile data</strong> — internet goes through the eSIM.</li>
          <li><strong>Turning on data roaming</strong> for the eSIM — lets it use partner networks abroad.</li>
        </ol>` },
      { h2: 'When does the validity start?', html: `
        <p>It depends on the plan. Some plans start counting when the eSIM first connects to a network at the destination or first uses data. Others start as soon as the eSIM is installed.</p>
        <p>Because of that, the advice that never costs you days is to <strong>install on the day you travel</strong> — at home before you leave or on airport Wi-Fi — and to switch the eSIM on for data once you land.</p>` },
      { h2: 'Checklist for the day you fly', html: `
        <ul class="list">
          <li>Your phone supports eSIM and is not carrier-locked (<a href="/en/guides/compatibility/">check</a>).</li>
          <li>You have the eSIM's QR code, or its details for manual installation, at hand — saved somewhere you can open offline.</li>
          <li>You install the eSIM over Wi-Fi (<a href="/en/guides/iphone/">iPhone</a>, <a href="/en/guides/android/">Android</a>).</li>
          <li>You keep your main SIM for data until you land.</li>
        </ul>` },
      { h2: 'After you land', html: `
        <ol class="steps">
          <li>Turn the eSIM line on, if it is off.</li>
          <li>Choose the eSIM for mobile data.</li>
          <li>Turn on data roaming for the eSIM.</li>
          <li>Wait one to three minutes. No network? Turn airplane mode on and off.</li>
          <li>Still nothing? Go through <a href="/en/guides/troubleshooting/">eSIM not working</a>.</li>
        </ol>` },
      { h2: 'Landed without the eSIM installed and no Wi-Fi?', html: `
        <p>You need internet to download the profile. Options: the airport's free Wi-Fi, or internet shared from a travel companion's phone. Entering the details by hand still needs internet to download the profile.</p>` },
    ],
    faq: [
      { q: 'I installed the eSIM a week before the trip. Is the plan already running?', a: 'It depends on the plan: some start counting at installation, others on the first connection or the first data used at the destination. To be safe with any plan, install on the day you travel.' },
      { q: 'Does turning on data roaming at home cost anything?', a: 'The switch itself charges nothing; it only allows the line to use partner networks. What matters is which line is chosen for mobile data, and your plan\'s terms.' },
      { q: 'I landed and there is no internet. How long should I wait?', a: 'Registration usually takes a minute or two after you turn on data and roaming for the eSIM. Toggling airplane mode often helps. If there is still no network after 10–15 minutes, go through the troubleshooting checklist.' },
    ],
    related: ['iphone', 'android', 'troubleshooting', 'compatibility'],
  },

  // ---------------------------------------------------------- troubleshooting
  {
    slug: 'troubleshooting',
    nav: 'Troubleshooting',
    title: 'eSIM not working abroad — what to check | Magic eSIM',
    description: 'A step-by-step checklist when a travel eSIM shows no network or no internet: data line, roaming, airplane mode, network selection and when not to delete the eSIM.',
    h1: 'eSIM not working — what to check',
    blurb: 'A checklist, in the order that fixes most problems.',
    lead: 'Most problems come down to a setting. Go through the steps in order and test the internet after each one. Do not delete the eSIM while you troubleshoot.',
    sections: [
      { h2: 'The checklist', html: `
        <ol class="steps">
          <li><strong>Is the eSIM line turned on?</strong> Check the SIM settings.</li>
          <li><strong>Is the eSIM chosen for mobile data?</strong> The internet has to go through the eSIM, not your main SIM.</li>
          <li><strong>Is data roaming on for the eSIM?</strong> Travel eSIMs usually connect through partner networks, which the phone treats as roaming.</li>
          <li><strong>Toggle airplane mode</strong> on for ten seconds, then off.</li>
          <li><strong>Restart the phone.</strong></li>
          <li><strong>Choose a network by hand.</strong> In the eSIM's network settings, turn off automatic selection and pick another network from the list.</li>
          <li><strong>Check the APN</strong> — only if your plan's details list one: it should match in the eSIM's settings.</li>
          <li><strong>Are you inside the plan's coverage?</strong> Check that the country you are in is among the countries the plan covers.</li>
        </ol>` },
      { h2: 'Signal, but no internet', html: `
        <p>The phone is registered but data does not flow. Most often the eSIM is not the line chosen for mobile data, or data roaming is off for it. Check both, then toggle airplane mode.</p>` },
      { h2: 'Do not delete the eSIM', html: `
        <p>Deleting the eSIM rarely fixes anything, and its QR code may be single-use — you may not be able to install it again. Leave it installed while you go through the checklist.</p>` },
      { h2: 'Still not working?', html: `
        <p>If you have gone through the whole checklist and the eSIM still does not work, write to us at <a href="mailto:support@magicesim.store">support@magicesim.store</a>.</p>` },
    ],
    faq: [
      { q: 'The eSIM shows «No Service». What first?', a: 'Make sure data roaming is on for the eSIM, toggle airplane mode, and give it a couple of minutes. Then try choosing a network by hand.' },
      { q: 'Can I reinstall the eSIM with the same QR code?', a: 'Often not: a QR code may be single-use. That is why the checklist tells you not to delete the eSIM.' },
      { q: 'Will my main SIM get charged while I troubleshoot?', a: 'If the main SIM is chosen for mobile data and its data roaming is on, your home operator may charge you. Keep the eSIM as the data line, or turn off data roaming on the main SIM.' },
    ],
    related: ['iphone', 'android', 'activation', 'compatibility'],
  },
];
