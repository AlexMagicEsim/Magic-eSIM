// Quality scoring and the anti-template guard.
//
// The whole point of the content pipeline is that a page should read as if a
// person wrote it. The failure mode is not bad Russian — a generator produces
// perfectly grammatical Russian. It is SAMENESS: the same opening move, the
// same three benefits, the same six questions, the same closing line, two
// hundred times over. A reader notices that before they notice anything else,
// and so does a search engine.
//
// So the checks here are mostly comparative. A page is not scored on its own
// merits; it is scored against every other page. A paragraph that would be
// excellent on one country and appears verbatim on forty is worth nothing.
//
// PHRASES THAT ARE BANNED OUTRIGHT
//
//   Not because they are wrong, but because they are what every eSIM site
//   writes. "Оставайтесь на связи" is not a sentence anybody chose; it is a
//   sentence that arrives when nobody decided what to say.

export const BANNED_PHRASES = Object.freeze([
  'оставайтесь на связи',
  'путешествуйте без забот',
  'путешествуйте с комфортом',
  'мгновенная активация',
  'всегда на связи',
  'забудьте о роуминге',
  'в два клика',
  'в несколько кликов',
  'идеальное решение',
  'лучший выбор для путешественников',
  'не переплачивайте за роуминг',
  'наслаждайтесь путешествием',
  'откройте для себя',
  'погрузитесь в атмосферу',
  'незабываемые впечатления',
  'современный мир',
  'в наше время',
]);

// A country page must not open the same way as its neighbours. Three words is
// enough to catch a shared template and short enough not to fire on ordinary
// Russian.
const OPENING_WORDS = 6;

const norm = (s) => String(s || '')
  .toLowerCase()
  .replace(/ё/g, 'е')
  .replace(/[^а-я0-9\s]/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const words = (s) => norm(s).split(' ').filter(Boolean);

/** Jaccard over word sets — cheap, and enough to catch a rewritten template. */
export function similarity(a, b) {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared += 1;
  return shared / new Set([...A, ...B]).size;
}

export function openingOf(text) {
  return words(text).slice(0, OPENING_WORDS).join(' ');
}

/**
 * Score one page against the whole corpus.
 *
 * The scale the brief asked for:
 *   100  editorial
 *    80  very good
 *    60  acceptable
 *    40  template
 *    20  needs rewriting
 *
 * A page with no profile at all scores 40 by definition — it IS the template,
 * and calling it anything else would hide exactly what this dashboard exists
 * to show.
 */
export function scoreProfile(profile, { slug, corpus = [] } = {}) {
  if (!profile) {
    return {
      score: 40,
      band: 'template',
      reasons: ['профиля нет — страница собрана по фактическому шаблону'],
      penalties: [],
    };
  }

  let score = 40;                 // everyone starts at the template
  const reasons = [];
  const penalties = [];

  const lead = profile.lead || '';
  const intro = Array.isArray(profile.intro) ? profile.intro.join(' ') : '';
  const why = Array.isArray(profile.why) ? profile.why : [];
  const faq = Array.isArray(profile.faq) ? profile.faq : [];
  const body = [lead, intro, why.map((w) => `${w.h} ${w.p}`).join(' '),
    faq.map((f) => `${f.q} ${f.a}`).join(' ')].join(' ');

  // ---- what a person actually added ------------------------------------
  if (lead.length >= 120) { score += 10; reasons.push('свой лид'); }
  if (intro.length >= 300) { score += 10; reasons.push('вводные абзацы'); }
  if (why.length >= 3) { score += 8; reasons.push(`${why.length} собственных блока «почему»`); }
  if (faq.length >= 4) { score += 12; reasons.push(`${faq.length} собственных вопроса`); }
  if (profile.title && profile.description && profile.h1) {
    score += 8; reasons.push('свои title/description/H1');
  }
  // The researcher may leave a list of queries or a paragraph of notes. Both
  // are research; only an empty field is not.
  const intent = profile.search_intent;
  const researched = Array.isArray(intent) ? intent.length >= 3
    : typeof intent === 'string' && intent.trim().length >= 80;
  if (researched) { score += 6; reasons.push('интент исследован'); }
  if (Array.isArray(profile.sources) && profile.sources.length >= 2) {
    score += 6; reasons.push('источники указаны');
  }

  // ---- what disqualifies it ---------------------------------------------
  const flat = norm(body);
  const banned = BANNED_PHRASES.filter((p) => flat.includes(norm(p)));
  if (banned.length) {
    const hit = Math.min(30, banned.length * 12);
    score -= hit;
    penalties.push(`штампы (${banned.join(', ')}) −${hit}`);
  }

  // The comparative half: how close is this to the pages around it?
  const others = corpus.filter((c) => c.slug !== slug && c.body);
  let worst = { slug: null, value: 0 };
  for (const other of others) {
    const v = similarity(body, other.body);
    if (v > worst.value) worst = { slug: other.slug, value: v };
  }
  if (worst.value >= 0.55) {
    score -= 25;
    penalties.push(`почти совпадает с ${worst.slug} (${Math.round(worst.value * 100)}%) −25`);
  } else if (worst.value >= 0.40) {
    score -= 12;
    penalties.push(`похоже на ${worst.slug} (${Math.round(worst.value * 100)}%) −12`);
  }

  const myOpening = openingOf(lead);
  const sharedOpening = others.find((o) => o.lead && openingOf(o.lead) === myOpening && myOpening);
  if (sharedOpening) {
    score -= 15;
    penalties.push(`первые слова лида как у ${sharedOpening.slug} −15`);
  }

  // A FAQ repeated across countries is the clearest tell of a generator.
  const myQuestions = faq.map((f) => norm(f.q));
  let dupQuestions = 0;
  for (const other of others) {
    for (const q of (other.questions || [])) {
      if (myQuestions.includes(q)) dupQuestions += 1;
    }
  }
  if (dupQuestions > 0) {
    const hit = Math.min(20, dupQuestions * 5);
    score -= hit;
    penalties.push(`${dupQuestions} вопрос(ов) повторяются на других страницах −${hit}`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band = score >= 95 ? 'editorial'
    : score >= 80 ? 'very good'
      : score >= 60 ? 'acceptable'
        : score >= 40 ? 'template' : 'needs rewrite';

  return { score, band, reasons, penalties, max_similarity: Number(worst.value.toFixed(3)), similar_to: worst.slug };
}

/**
 * Corpus entry — what the comparative checks need from every page.
 */
export function corpusEntry(slug, profile) {
  if (!profile) return { slug, body: '', lead: '', questions: [] };
  const faq = Array.isArray(profile.faq) ? profile.faq : [];
  const why = Array.isArray(profile.why) ? profile.why : [];
  return {
    slug,
    lead: profile.lead || '',
    body: [
      profile.lead || '',
      Array.isArray(profile.intro) ? profile.intro.join(' ') : '',
      why.map((w) => `${w.h} ${w.p}`).join(' '),
      faq.map((f) => `${f.q} ${f.a}`).join(' '),
    ].join(' '),
    questions: faq.map((f) => norm(f.q)),
  };
}
