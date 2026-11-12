// The support telephone (owner, 2026-11-12 — Payssion onboarding asks for a customer-service phone on the website).
//
// ENGLISH ONLY. The number is shown in the footer «Help» column and in the home's support band of the English pages,
// and nowhere else: the hidden language versions (es, de, fr, zh, ko — seo/publication-scope.mjs) and the Russian
// site do not get it. A language that should show it is added here deliberately, with its own label.
// The legal documents do not carry it (Terms §1 and §11 name the email only; a phone there is a new Terms version).
// seo/test-en-support-contact.mjs pins the number, the tel: link, the English-only rule and the email line next to it.

export const SUPPORT_PHONE = Object.freeze({ display: '+995 591 021 807', tel: '+995591021807' });

/** The footer label per language that shows the number. */
const LABEL = Object.freeze({ en: 'Phone:' });

/** { label, display, href } for a language that shows the number, else null. */
export function supportPhoneFor(code) {
  const label = LABEL[code];
  return label ? { label, display: SUPPORT_PHONE.display, href: `tel:${SUPPORT_PHONE.tel}` } : null;
}
