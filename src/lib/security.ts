export const LIMITS = {
  caption: 2200,
  comment: 500,
  message: 1000,
  bio: 150,
  name: 50,
  imageBytes: 20 * 1024 * 1024,
  videoBytes: 100 * 1024 * 1024,
  storyBytes: 50 * 1024 * 1024,
};

/** Strip control / bidi-override characters, normalise and cap length. */
export function cleanText(input: unknown, max: number, { multiline = false } = {}) {
  let s = typeof input === 'string' ? input.normalize('NFC') : '';
  s = s.replace(multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '');
  s = s.replace(/[‪-‮⁦-⁩​-‏]/g, '');
  return s.trim().slice(0, max);
}

export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

const COMMON = new Set(['password', 'password1', '12345678', '123456789', 'qwerty123', 'iloveyou', 'letmein123', 'admin123', 'welcome1', 'abc12345', 'password123', '11111111']);

export function passwordProblem(pw: string, username: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 128) return 'Password is too long (max 128 characters).';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain both letters and numbers.';
  if (COMMON.has(pw.toLowerCase())) return 'That password is too common. Choose something harder to guess.';
  if (username && pw.toLowerCase().includes(username.toLowerCase())) return 'Password must not contain your username.';
  return null;
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type MediaInfo = { kind: 'image' | 'video'; mime: string };

/** Identify a file by its real bytes (never trust the extension or declared type). */
export async function sniffMedia(file: Blob): Promise<MediaInfo | null> {
  const b = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  const ascii = (i: number, s: string) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (at(0, 0xff, 0xd8, 0xff)) return { kind: 'image', mime: 'image/jpeg' };
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { kind: 'image', mime: 'image/png' };
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return { kind: 'image', mime: 'image/gif' };
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return { kind: 'image', mime: 'image/webp' };
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return { kind: 'video', mime: 'video/webm' };
  if (ascii(4, 'ftyp')) {
    const brand = String.fromCharCode(...b.slice(8, 12));
    if (/^(heic|heix|mif1|avif)/.test(brand)) return null;
    return { kind: 'video', mime: brand.startsWith('qt') ? 'video/quicktime' : 'video/mp4' };
  }
  return null;
}

export async function validateMedia(file: unknown, maxVideo = LIMITS.videoBytes): Promise<{ ok: true; blob: Blob; info: MediaInfo } | { ok: false; error: string }> {
  if (!(file instanceof Blob)) return { ok: false, error: 'No file selected.' };
  const info = await sniffMedia(file);
  if (!info) return { ok: false, error: 'Unsupported file. Use a JPG, PNG, GIF, WebP, MP4, MOV or WebM file.' };
  const max = info.kind === 'image' ? LIMITS.imageBytes : maxVideo;
  if (file.size > max) return { ok: false, error: `File is too large. ${info.kind === 'image' ? 'Photos' : 'Videos'} can be up to ${Math.round(max / 1048576)} MB.` };
  if (file.size === 0) return { ok: false, error: 'That file is empty.' };
  return { ok: true, blob: new Blob([file], { type: info.mime }), info };
}

const buckets = new Map<string, number[]>();
/** Sliding-window limiter for abuse-prone actions. Returns true if allowed. */
export function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= max) { buckets.set(key, hits); return false; }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

const LOCK_KEY = 'relearn.auth-attempts';
type Attempts = Record<string, { fails: number; until: number }>;
const readAttempts = (): Attempts => {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY) ?? '{}') as Attempts; } catch { return {}; }
};

/** Progressive lockout after repeated failed logins (persists across reloads). */
export function lockRemaining(id: string) {
  const a = readAttempts()[id];
  return a && a.until > Date.now() ? Math.ceil((a.until - Date.now()) / 1000) : 0;
}
export function recordFailure(id: string) {
  const all = readAttempts();
  const cur = all[id] ?? { fails: 0, until: 0 };
  cur.fails += 1;
  if (cur.fails >= 5) cur.until = Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** (cur.fails - 5));
  all[id] = cur;
  localStorage.setItem(LOCK_KEY, JSON.stringify(all));
}
export function clearFailures(id: string) {
  const all = readAttempts();
  delete all[id];
  localStorage.setItem(LOCK_KEY, JSON.stringify(all));
}

export function isSafeAvatar(v: unknown): v is string {
  return typeof v === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 400_000;
}
