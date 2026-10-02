// The start-of-term rule shared by the guide, template and page tests.
//
//   * No sentence may send the reader to the delivery EMAIL for when a term
//     starts — the email has no such row (~/esim-backend/lib/retailEmail.js:101-105).
//   * No sentence may claim that most / many / usually plans start one way —
//     activation_policy is `unknown` on ~91 % of the catalogue and the card
//     prints a FALLBACK there.
//   * No sentence may state flatly when the term starts (on connection, «не в
//     момент установки», «ранняя установка ничего не расходует») — 15 plans
//     start «после установки eSIM». The ONLY scoping that counts is pointing at
//     the «Начало срока» row or quoting a value a card prints; «если», «кроме»,
//     «в карточке» or «без исключений» elsewhere in the sentence do not.
//
// A plain module, not a test file, so importing it registers no tests.

export const sentences = (t) => t.split(/(?<=[.!?])\s+/);

// The TERM starting — with its subject, so «пользователи начинают с тарифа на
// 5 ГБ» or «телефон считает такое подключение роумингом» are not caught.
const TERM_START = /(?:срок|отсч[её]т|действи[ея]|дни)[^.]{0,30}(?:начина|начн[её]т|(?<![а-яё])ид[её]т|пойд[её]т|старту|наступа|расходу)|(?:тариф[а-яё]*|пакет[а-яё]*)[^.]{0,20}(?:активиру|начина[а-яё]*\s+действ|начн[её]т\s+действ)|(?:с|при)\s+(?:момента\s+)?перв[а-яё]+\s+(?:подключени|использовани|выход)|с\s+момента\s+подключени|начало\s+действия[^.]{0,40}наступа|начн[её]тся\s+срок|запуска[а-яё]*\s+срок|момент[а-яё]*\s+старт|дата\s+начала/i;
const MAJORITY = /у\s+большинства|у\s+многих|в\s+большинстве|больш[а-яё]+\s+част|большинство|многие|чаще(?:\s+всего)?(?![а-яё])|как\s+правило|в\s+основном|почти\s+всегда|по\s+умолчанию|(?<![а-яё])обычно/i;
const MAIL = /письм|e-?mail|почт/i;
const ABOUT_START = new RegExp(`${TERM_START.source}|с\\s+какого\\s+момента|счита[а-яё]*\\s+срок|когда\\s+пойдут|услови[а-яё]*\\s+(?:старта|начала|активац)|(?:услови|правил)[а-яё]*[^.]{0,40}(?:срок|тариф)|Начало срока`, 'i');
// Flat claims about when the term starts.
const FLAT = [
  /(?:срок|тариф|пакет|отсч[её]т|дни)[^.]{0,40}(?:начина[а-яё]*|(?<![а-яё])ид[её]т|отсчитыва[а-яё]*|начинают\s+расходоваться|начинает\s+действ[а-яё]*|активиру[а-яё]*)[^.]{0,30}(?:с|при)\s+(?:момента\s+)?(?:перв[а-яё]+\s+)?(?:подключени|выход[а-яё]*\s+в\s+сеть)/i,
  /(?:начина[а-яё]*|(?<![а-яё])ид[её]т)\s+не\s+(?:в\s+момент|с\s+момента|после)\s+установк/i,
  /(?:ранн[а-яё]+\s+установк[а-яё]*|заранее\s+(?:поставленн|установленн)[а-яё]*\s+профил[а-яё]*)[^.]{0,40}ничего\s+не\s+(?:расходует|сжигает|тратит)/i,
  /начало\s+действия[^.]{0,40}наступа/i,
];
// The only scoping that counts: the row itself, or a value the card prints, quoted.
const SCOPED = /«Начало срока»|«с первого подключения к сети»|«с первого использования интернета»|«после установки eSIM»/;

/** Problems in a text; empty means the text is fine. */
export function startRuleProblems(t) {
  const out = [];
  for (const s of sentences(t)) {
    if (MAIL.test(s) && ABOUT_START.test(s) && !/срок\s+действия,\s+но\s+не\s+момент/i.test(s)) out.push(`письмо как источник условия старта: «${s.trim()}»`);
    // «условия старта», «момент начала» name the condition, they do not assert it.
    const asserted = s.replace(/(?:услови[а-яё]*|момент[а-яё]*|строк[а-яё]*)\s+(?:старта|начала)(?:\s+срока)?/gi, '');
    if (MAJORITY.test(asserted) && TERM_START.test(asserted)) out.push(`утверждение о большинстве тарифов: «${s.trim()}»`);
    else if (FLAT.some((r) => r.test(s)) && !SCOPED.test(s)) out.push(`срок без оговорки: «${s.trim()}»`);
  }
  return out;
}

/** Prose of a built page: each <p>, <li>, heading and FAQ summary on its own, plus FAQPage answers. */
export function proseOf(html) {
  const un = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ');
  const blocks = [...body.matchAll(/<(p|li|h[1-4]|summary)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => un(m[2]));
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let j; try { j = JSON.parse(m[1]); } catch { continue; }
    for (const n of [].concat(j['@graph'] || j)) {
      if (n['@type'] === 'FAQPage') for (const q of n.mainEntity) blocks.push(q.name, q.acceptedAnswer.text);
    }
  }
  return blocks.filter(Boolean);
}
