import type { AiResult } from './moderation';
import { analyzeContent } from './moderation';
import { classifyIntent, looksEnglish, multilingualKeywordHit, nearestConcepts, onMultiProgress } from './multilingual';

/**
 * Strict multimodal content check, fully on-device (CLIP vision + text encoders, ~90 MB, cached after the first run).
 * It judges (1) what the media actually shows, (2) whether that is study material / safe,
 * (3) whether the written caption matches the media, and (4) the apparent aim of the post.
 * Fails closed: if the model cannot run, nothing is approved.
 */

const MODEL = 'Xenova/clip-vit-base-patch32';
const HARD_TIMEOUT_MS = 55_000; // always answers inside the 60 s ceiling
const MAX_FRAMES = 4;

const STUDY = [
  'a photo of handwritten study notes', 'a page of a textbook', 'a diagram or chart with labels', 'a whiteboard with equations',
  'a lecture slide with text', 'a science laboratory experiment', 'a student studying at a desk', 'source code on a computer screen',
  'a classroom or lecture hall', 'a microscope or scientific equipment', 'a mathematical graph or formula', 'a book or library',
  'an anatomy or biology illustration', 'a chemistry molecule structure', 'a map or historical document',
];
const UNSAFE = [
  'nudity or sexual content', 'a violent or gory scene', 'a weapon or gun', 'drugs, smoking or alcohol', 'gambling or a casino',
  'hateful or offensive symbols',
];
const OFFTOPIC = [
  'a party or nightclub', 'a funny internet meme', 'a selfie of a person posing', 'a plate of food', 'a beach vacation',
  'a fashion outfit or makeup', 'a sports game', 'a video game screenshot', 'a celebrity photo', 'a product advertisement',
];

const SPAM_RE = /(https?:\/\/|www\.|\.com\b|whatsapp|telegram|dm me|buy now|discount|promo code|giveaway|follow for follow|f4f|l4l|subscribe to my|onlyfans|crypto|bet\b|earn money|click the link)/i;
const NON_STUDY_AIM_RE = /(just for fun|for fun|lol\b|bored|so cute|my outfit|look at me|vibes|trending|prank|roast|thirst)/i;

type Emb = Float32Array;
interface Engine {
  tokenizer: any; textModel: any; visionModel: any; processor: any; RawImage: any;
  label: Map<string, Emb>;
}

let enginePromise: Promise<Engine> | null = null;
let progressCb: ((msg: string) => void) | null = null;
export const onAiProgress = (cb: ((msg: string) => void) | null) => { progressCb = cb; onMultiProgress.cb = cb; };

const norm = (v: Emb): Emb => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return v.map(x => x / s) as Emb; };
const dot = (a: Emb, b: Emb) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

async function embedTexts(e: Pick<Engine, 'tokenizer' | 'textModel'>, texts: string[]): Promise<Emb[]> {
  const inputs = e.tokenizer(texts, { padding: true, truncation: true, max_length: 77 });
  const { text_embeds } = await e.textModel(inputs);
  const d = text_embeds.dims[1] as number;
  return texts.map((_, i) => norm(Float32Array.from((text_embeds.data as Float32Array).slice(i * d, (i + 1) * d))));
}

/** Start downloading / warming the model in the background so the later check takes seconds. */
export function warmUpAi(): Promise<unknown> {
  enginePromise ??= (async () => {
    const T = await import('@huggingface/transformers');
    const report = (p: any) => {
      if (p?.status === 'progress' && typeof p.progress === 'number') progressCb?.(`Loading AI model… ${Math.round(p.progress)}%`);
    };
    const opts = { dtype: 'q8' as const, progress_callback: report };
    const [tokenizer, processor, textModel, visionModel] = await Promise.all([
      T.AutoTokenizer.from_pretrained(MODEL),
      T.AutoProcessor.from_pretrained(MODEL),
      T.CLIPTextModelWithProjection.from_pretrained(MODEL, opts),
      T.CLIPVisionModelWithProjection.from_pretrained(MODEL, opts),
    ]);
    const engine: Engine = { tokenizer, processor, textModel, visionModel, RawImage: T.RawImage, label: new Map() };
    const all = [...STUDY, ...UNSAFE, ...OFFTOPIC];
    const embs = await embedTexts(engine, all.map(l => `a photo of ${l.replace(/^an? /, '')}`.replace('a photo of photo of', 'a photo of')));
    all.forEach((l, i) => engine.label.set(l, embs[i]));
    return engine;
  })();
  enginePromise.catch(() => { enginePromise = null; });
  return enginePromise;
}

// ---------- Frames ----------
function drawToBlob(src: CanvasImageSource, w: number, h: number): Promise<Blob> {
  const S = 224;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, S, S);
  const r = Math.min(S / w, S / h);
  ctx.drawImage(src, (S - w * r) / 2, (S - h * r) / 2, w * r, h * r);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('frame'))), 'image/png'));
}

async function frames(blob: Blob, kind: 'image' | 'video'): Promise<Blob[]> {
  const url = URL.createObjectURL(blob);
  try {
    if (kind === 'image') {
      const img = new Image();
      img.src = url;
      await img.decode();
      return [await drawToBlob(img, img.naturalWidth, img.naturalHeight)];
    }
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('decode')); });
    const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
    const n = Math.min(MAX_FRAMES, Math.max(1, Math.ceil(dur / 5)));
    const out: Blob[] = [];
    for (let i = 0; i < n; i++) {
      v.currentTime = Math.min(dur - 0.05, (dur * (i + 0.5)) / n);
      await new Promise<void>(res => { v.onseeked = () => res(); });
      out.push(await drawToBlob(v, v.videoWidth || 224, v.videoHeight || 224));
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Scoring ----------
function softmax(xs: number[]) {
  const m = Math.max(...xs);
  const ex = xs.map(x => Math.exp(x - m));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map(x => x / s);
}

interface FrameScore { study: number; unsafe: number; offtopic: number; top: string; caption: number }

async function scoreFrame(e: Engine, img: Blob, captionEmb: Emb | null): Promise<FrameScore> {
  const raw = await e.RawImage.fromBlob(img);
  const { image_embeds } = await e.visionModel(await e.processor(raw));
  const v = norm(Float32Array.from(image_embeds.data as Float32Array));
  const labels = [...STUDY, ...UNSAFE, ...OFFTOPIC];
  const p = softmax(labels.map(l => 100 * dot(v, e.label.get(l)!)));
  const sum = (from: number, len: number) => p.slice(from, from + len).reduce((a, b) => a + b, 0);
  const top = labels[p.indexOf(Math.max(...p))];
  return {
    study: sum(0, STUDY.length), unsafe: sum(STUDY.length, UNSAFE.length), offtopic: sum(STUDY.length + UNSAFE.length, OFFTOPIC.length),
    top, caption: captionEmb ? dot(v, captionEmb) : 1,
  };
}

const reject = (message: string, reason: string): AiResult => ({ status: 'rejected', message, reason });
const warn = (message: string, reason: string): AiResult => ({ status: 'warning', message, reason });

const KIND_MSG: Record<string, [string, string]> = {
  sexual: ['Inappropriate text detected', 'The caption contains sexual or explicit wording, which is not allowed on ReLearn.'],
  gambling: ['Gambling content detected', 'Gambling and betting content is not allowed on ReLearn.'],
  drugs: ['Drug or alcohol content detected', 'Content about drugs or alcohol is not allowed on ReLearn.'],
  violence: ['Violent wording detected', 'Violent or threatening wording is not allowed on ReLearn.'],
  hate: ['Hateful or abusive wording detected', 'Hate speech, bullying and harassment are not allowed on ReLearn.'],
  spam: ['Promotion or external links detected', 'ReLearn is for studying, not advertising. Remove links, promotions and requests to contact you elsewhere.'],
  funOnly: ['Purpose does not look educational', 'The wording suggests this is posted for fun or attention rather than to help people learn. Rewrite it to explain what is being taught.'],
};

/** Instant text gate (all languages): banned words, spam/promotion and non-study intent. */
function textGate(caption: string, subject: string, kind: 'image' | 'video'): AiResult | null {
  const hit = multilingualKeywordHit(caption);
  if (hit) return reject(...KIND_MSG[hit.kind]);
  const base = analyzeContent(caption, subject, kind);
  if (base.status === 'rejected') return base;
  if (SPAM_RE.test(caption)) return reject(...KIND_MSG.spam);
  if (NON_STUDY_AIM_RE.test(caption)) return reject(...KIND_MSG.funOnly);
  if (caption.trim().length < 12) return warn('Caption too short', 'Describe what the media teaches (topic, course or concept) so the AI can match it to the media. Any language is accepted.');
  return null;
}

/** Semantic text gate for any language (model based). */
async function semanticGate(caption: string): Promise<AiResult | null> {
  const { study, worst } = await classifyIntent(caption);
  const intentMsg: Record<string, [string, string]> = { ...KIND_MSG, offtopic: KIND_MSG.funOnly };
  if (worst.score > 0.55 && worst.score > study + 0.03) return reject(...intentMsg[worst.intent]);
  if (study < 0.22 && worst.score > study) return warn('Caption does not read as educational', 'The AI could not tell what you are teaching. Say which subject or concept this media explains.');
  return null;
}

async function run(blob: Blob, kind: 'image' | 'video', caption: string, subject: string): Promise<AiResult> {
  const gate = textGate(caption, subject, kind);
  if (gate && gate.status === 'rejected') return gate;

  const english = looksEnglish(caption);
  if (!english) {
    // Non-English caption: understand its meaning, then judge it like English.
    progressCb?.('Reading your caption…');
    const sem = await semanticGate(caption);
    if (sem && sem.status === 'rejected') return sem;
    if (sem && !gate) return sem;
  }
  progressCb?.('Loading AI model…');
  const e = await warmUpAi() as Engine;
  progressCb?.(kind === 'video' ? 'Analysing video frames…' : 'Analysing image…');

  let captionEmb: Emb | null = null;
  if (english) {
    const text = [subject, caption].filter(Boolean).join('. ').slice(0, 300);
    [captionEmb] = text ? await embedTexts(e, [text]) : [null];
  } else {
    // Bridge: map the foreign-language caption to its nearest English concepts, then use their CLIP embeddings.
    const near = await nearestConcepts(caption, [...e.label.keys()]);
    const mix = new Float32Array(near.length ? e.label.get(near[0].concept)!.length : 0);
    for (const n of near) { const v = e.label.get(n.concept)!; for (let i = 0; i < mix.length; i++) mix[i] += v[i]; }
    captionEmb = mix.length ? norm(mix) : null;
  }
  const fr = await frames(blob, kind);
  const scores: FrameScore[] = [];
  for (const f of fr) scores.push(await scoreFrame(e, f, captionEmb));

  const worst = (k: 'unsafe' | 'offtopic') => Math.max(...scores.map(s => s[k]));
  const avgStudy = scores.reduce((a, s) => a + s.study, 0) / scores.length;
  const avgCap = scores.reduce((a, s) => a + s.caption, 0) / scores.length;
  const unsafe = worst('unsafe');
  const off = worst('offtopic');
  const topLabel = scores.sort((a, b) => b.study - a.study)[0].top;

  if (unsafe > 0.3) return reject('Inappropriate media detected', 'The AI found content that is not allowed on ReLearn (explicit, violent or otherwise unsafe). This post cannot be published.');
  if (off > 0.5 && avgStudy < 0.4) return reject('Media is off-topic', `The ${kind} looks like "${topLabel}", which is not study material, even though the caption talks about learning.`);
  if (avgStudy < 0.2) return reject('Media does not look educational', `The AI could not find notes, diagrams, equipment or other learning content in this ${kind}.`);
  if (captionEmb && avgCap < 0.17) return reject('Caption does not match the media', `What you wrote does not describe what the ${kind} shows. Rewrite the caption so it explains this specific media.`);
  if (gate) return gate;
  if (avgStudy < 0.4 || off > 0.3 || (captionEmb && avgCap < 0.2)) {
    return warn('Relevance could not be fully confirmed', 'Make the caption more specific about what the media shows and which subject it belongs to, then check again.');
  }
  return { status: 'approved', message: 'Media, caption and purpose are consistent with study content', confidence: Math.min(99, Math.round(60 + avgStudy * 40)) };
}

/** Full check with a hard time limit. Never approves on error or timeout. */
export async function checkContent(blob: Blob, kind: 'image' | 'video', caption: string, subject: string): Promise<AiResult> {
  const timeout = new Promise<AiResult>(res =>
    setTimeout(() => res(warn('Check timed out', 'The AI could not finish in time. Check your connection and try again.')), HARD_TIMEOUT_MS));
  try {
    return await Promise.race([run(blob, kind, caption, subject), timeout]);
  } catch (err) {
    console.error(err);
    return warn('AI check unavailable', 'The content checker could not run (it needs to download its model once). Check your connection and try again; nothing is published without a check.');
  }
}
