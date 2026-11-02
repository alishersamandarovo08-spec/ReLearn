/**
 * Multilingual text understanding for the AI content check.
 * English stays the primary language; every other language (50+ supported by the
 * paraphrase-multilingual MiniLM encoder, incl. Arabic, Chinese, Hindi, Russian, Spanish, Turkish, Japanese, Korean...)
 * is understood by mapping it into the same embedding space as English reference sentences.
 */

const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

type Emb = Float32Array;
let extractor: Promise<(t: string[]) => Promise<Emb[]>> | null = null;

export const onMultiProgress = { cb: null as ((m: string) => void) | null };

export function warmUpMultilingual() {
  extractor ??= (async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const pipe: any = await pipeline('feature-extraction', MODEL, {
      dtype: 'q8',
      progress_callback: (p: any) => {
        if (p?.status === 'progress' && typeof p.progress === 'number') onMultiProgress.cb?.(`Loading multilingual model… ${Math.round(p.progress)}%`);
      },
    });
    return async (texts: string[]) => {
      const out = await pipe(texts, { pooling: 'mean', normalize: true });
      const d = out.dims[1] as number;
      return texts.map((_, i) => Float32Array.from((out.data as Float32Array).slice(i * d, (i + 1) * d)));
    };
  })();
  extractor.catch(() => { extractor = null; });
  return extractor;
}

const dot = (a: Emb, b: Emb) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// ---------- Language detection ----------
const EN_WORDS = new Set(['the', 'and', 'of', 'to', 'in', 'is', 'for', 'this', 'that', 'with', 'are', 'on', 'how', 'what', 'my', 'we', 'you', 'it', 'a', 'an', 'be', 'as', 'at', 'from', 'about', 'notes', 'study', 'exam']);

/** Cheap check: Latin script with enough common English words. Anything else goes through the multilingual path. */
export function looksEnglish(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (!letters) return true;
  const latin = (letters.match(/\p{Script=Latin}/gu) ?? []).length / letters.length;
  if (latin < 0.9) return false;
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length < 3) return !/[^\u0000-\u007f]/.test(text);
  return words.filter(w => EN_WORDS.has(w)).length / words.length >= 0.15;
}

// ---------- Reference sentences (English) ----------
export type Intent = 'study' | 'sexual' | 'violence' | 'hate' | 'drugs' | 'gambling' | 'spam' | 'offtopic';

const PROTOTYPES: Record<Intent, string[]> = {
  study: [
    'These are my study notes for the exam', 'Explaining a concept from my university lecture', 'Solving a math problem step by step',
    'A summary of the chapter for revision', 'Laboratory experiment for my science class', 'Tips for learning a language and grammar',
    'Programming tutorial and algorithm explanation', 'History lesson about an important event', 'Homework help and exam preparation',
    'Diagram explaining how something works in biology, physics or chemistry',
  ],
  sexual: ['Naked sexy body and explicit adult content', 'Pornography and sexual videos', 'Flirting and erotic photos'],
  violence: ['Graphic violence, blood and killing people', 'Fighting, beating someone up, a brutal attack', 'Threats to hurt or kill someone', 'Self-harm and suicide encouragement'],
  hate: ['Hate speech against a race, religion or group of people', 'Insulting and humiliating someone, harassment and bullying', 'Racist or extremist propaganda'],
  drugs: ['Buying and using illegal drugs', 'Getting drunk and smoking weed', 'Selling alcohol, cigarettes or vapes'],
  gambling: ['Online casino, betting and gambling tips', 'Win money fast with sports bets'],
  spam: ['Buy now, big discount, promo code, click the link', 'Follow me and message me on WhatsApp or Telegram', 'Earn money fast, crypto investment, giveaway', 'Subscribe to my channel and like my page'],
  offtopic: [
    'Funny meme and joke just for fun', 'My party night out with friends', 'Look at my new outfit and selfie', 'Delicious food and restaurant', 'Vacation at the beach',
    'Celebrity gossip and drama', 'Football match and video game highlights', 'Cute pet video',
  ],
};

let protoEmb: Promise<Record<Intent, Emb[]>> | null = null;
async function protos(): Promise<Record<Intent, Emb[]>> {
  protoEmb ??= (async () => {
    const embed = await warmUpMultilingual();
    const keys = Object.keys(PROTOTYPES) as Intent[];
    const all = keys.flatMap(k => PROTOTYPES[k]);
    const e = await embed(all);
    const res = {} as Record<Intent, Emb[]>;
    let i = 0;
    for (const k of keys) { res[k] = e.slice(i, i + PROTOTYPES[k].length); i += PROTOTYPES[k].length; }
    return res;
  })();
  protoEmb.catch(() => { protoEmb = null; });
  return protoEmb;
}

export interface IntentScores { study: number; worst: { intent: Exclude<Intent, 'study'>; score: number } }

/** Score a caption in any language against English reference intents. */
export async function classifyIntent(text: string): Promise<IntentScores> {
  const embed = await warmUpMultilingual();
  const [p, [t]] = await Promise.all([protos(), embed([text.slice(0, 400)])]);
  const best = (k: Intent) => Math.max(...p[k].map(e => dot(e, t)));
  let worst: IntentScores['worst'] = { intent: 'offtopic', score: -1 };
  for (const k of Object.keys(PROTOTYPES) as Intent[]) {
    if (k === 'study') continue;
    const s = best(k);
    if (s > worst.score) worst = { intent: k, score: s };
  }
  return { study: best('study'), worst };
}

/** Rank English concept sentences by similarity to a (foreign) caption. Used to bridge to CLIP. */
export async function nearestConcepts(text: string, concepts: string[], k = 3): Promise<{ concept: string; score: number }[]> {
  const embed = await warmUpMultilingual();
  const [ce, [t]] = await Promise.all([embed(concepts), embed([text.slice(0, 400)])]);
  return concepts.map((concept, i) => ({ concept, score: dot(ce[i], t) })).sort((a, b) => b.score - a.score).slice(0, k);
}

// ---------- Multilingual banned / spam terms (instant, no model) ----------
const norm = (s: string) => s.normalize('NFKC').toLowerCase();

const BAD: Record<string, string[]> = {
  sexual: ['porn', 'porno', 'pornografía', 'pornographie', 'desnud', 'nu intégral', 'nackt', 'sexo', 'sex video', 'секс', 'порно', 'голый', 'голая', 'إباحي', 'عاري', 'سكس', 'अश्लील', 'नंगा', '色情', '裸体', '黄色', 'ポルノ', 'エロ', '裸', '야동', '포르노', 'çıplak', 'telanjang', 'bokep'],
  gambling: ['casino', 'cassino', 'казино', 'ставки на спорт', 'قمار', 'كازينو', 'जुआ', '赌博', '博彩', 'ギャンブル', '도박', 'kumar', 'iddaa', 'judi ', 'apuestas', 'paris sportifs', 'sportwetten'],
  drugs: ['cocaine', 'cocaína', 'кокаин', 'героин', 'мефедрон', 'كوكايين', 'حشيش', 'ड्रग', '毒品', '大麻', '麻薬', '마약', 'uyuşturucu', 'ganja', 'marihuana'],
  violence: ['kill them', 'matar a', 'tuer', 'töten', 'убить', 'убей', 'اقتل', 'قتل', 'मार डालो', '杀死', '殺す', '죽여', 'öldür', 'bunuh'],
  spam: ['whatsapp', 'telegram', 't.me/', 'wa.me/', 'http://', 'https://', 'www.', '.com/', 'promo code', 'código promocional', 'code promo', 'промокод', 'скидка', 'كود خصم', 'خصم', 'प्रोमो कोड', '优惠码', '折扣', 'クーポン', '할인', 'indirim', 'diskon', 'rabatt', 'descuento', 'follow for follow', 'f4f', 'l4l', 'onlyfans', 'crypto', 'criptomoneda', 'криптовалют', 'عملات رقمية', '加密货币', 'dm me', 'escríbeme al privado', 'пиши в лс', 'ganhe dinheiro', 'earn money', 'gagner de l\'argent', 'заработок'],
  funOnly: ['just for fun', 'prank', 'meme', 'мем', 'прикол', 'مقلب', 'ميم', 'मीम', '搞笑', '段子', '笑える', 'ネタ', '웃긴', 'komik', 'meme lucu', 'bromas', 'blague', 'witzig', 'engraçado'],
};

export function multilingualKeywordHit(text: string): { kind: keyof typeof BAD; term: string } | null {
  const t = norm(text);
  for (const kind of Object.keys(BAD) as (keyof typeof BAD)[]) {
    const term = BAD[kind].find(w => t.includes(w));
    if (term) return { kind, term };
  }
  return null;
}
