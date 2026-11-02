import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { extractTags, SUBJECT_TAGS, type AiResult } from '../lib/moderation';
import { validateMedia } from '../lib/security';
import { checkContent, onAiProgress, warmUpAi } from '../lib/ai-check';
import { Media } from './ui';

const MAX_MB = 100;
type Step = 'select' | 'caption' | 'checking' | 'result';

export default function CreatePostModal({ onClose }: { onClose: () => void }) {
  const { createPost } = useStore();
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [subject, setSubject] = useState('');
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<'image' | 'video'>('image');

  async function pick(f: File | undefined | null) {
    if (!f) return;
    const v = await validateMedia(f);
    if (!v.ok) return setError(v.error);
    setError('');
    setFile(new File([v.blob], f.name, { type: v.info.mime }));
    setKind(v.info.kind);
    setStep('caption');
  }

  const [progress, setProgress] = useState('');
  useEffect(() => { void warmUpAi().catch(() => {}); onAiProgress(setProgress); return () => onAiProgress(null); }, []);

  async function check() {
    if (!file) return;
    setStep('checking');
    setProgress('Starting AI check…');
    setResult(await checkContent(file, kind, caption, subject));
    setStep('result');
  }

  async function share() {
    if (!file || !result) return;
    setPosting(true);
    const err = await createPost({ file, caption: caption.trim(), subject, tags: extractTags(caption, subject), aiVerified: result.status === 'approved' });
    setPosting(false);
    if (err) setError(err);
    else onClose();
  }

  const back = () => { setStep('caption'); setResult(null); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#dbdbdb]">
          <button onClick={step === 'caption' ? () => { setFile(null); setStep('select'); } : onClose} aria-label={step === 'caption' ? 'Back' : 'Close'} className="text-[#262626] hover:text-[#8e8e8e] transition">
            {step === 'caption' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            )}
          </button>
          <h2 className="text-base font-semibold text-[#262626]">Create Study Post</h2>
          <button onClick={check} disabled={step !== 'caption' || !caption.trim()} className="text-sm font-semibold text-[#0095f6] hover:text-[#00376b] disabled:text-[#8e8e8e] disabled:cursor-not-allowed transition w-10 text-right">
            {step === 'caption' ? 'Check' : ''}
          </button>
        </div>

        <div className="p-5 max-h-[72vh] overflow-y-auto">
          {step === 'select' && (
            <div
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
              className={`rounded-2xl border-2 border-dashed py-14 px-6 text-center transition ${drag ? 'border-[#7c3aed] bg-[#f0ebff]' : 'border-[#dbdbdb]'}`}
            >
              <div className="flex justify-center gap-3 mb-4 text-[#7c3aed]">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="14" height="14" rx="3" /><path d="M16 10l6-3v10l-6-3" /></svg>
              </div>
              <p className="text-base font-semibold text-[#262626]">Drag a photo or video here</p>
              <p className="text-sm text-[#8e8e8e] mt-1 mb-5">Notes, diagrams, lab footage, explainers. Up to {MAX_MB} MB.</p>
              <button onClick={() => inputRef.current?.click()} className="px-5 py-2 bg-[#7c3aed] text-white text-sm font-semibold rounded-lg hover:bg-[#6d28d9] transition">
                Select from device
              </button>
              <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => pick(e.target.files?.[0])} />
              {error && <p role="alert" className="text-xs text-[#dc2626] mt-4">{error}</p>}
            </div>
          )}

          {step === 'caption' && file && (
            <div>
              <div className="rounded-xl overflow-hidden bg-[#efefef] mb-4">
                <Media blob={file} kind={kind} className="w-full max-h-72 object-contain" />
              </div>
              <label className="text-xs font-semibold text-[#8e8e8e] mb-2 block">SUBJECT</label>
              <div className="flex flex-wrap gap-2 mb-4">
                {SUBJECT_TAGS.map(tag => (
                  <button key={tag} onClick={() => setSubject(tag === subject ? '' : tag)} className={`text-xs px-3 py-1.5 rounded-full transition font-medium ${subject === tag ? 'ai-badge-bg text-white' : 'bg-[#efefef] text-[#262626] hover:bg-[#dbdbdb]'}`}>
                    {tag}
                  </button>
                ))}
              </div>
              <label htmlFor="caption" className="text-xs font-semibold text-[#8e8e8e] mb-2 block">CAPTION</label>
              <textarea
                id="caption" value={caption} maxLength={2200} onChange={e => setCaption(e.target.value)} rows={4}
                placeholder="Share your study notes, learning insights, or academic tips... use #hashtags"
                className="w-full text-sm text-[#262626] placeholder:text-[#8e8e8e] bg-[#fafafa] border border-[#dbdbdb] rounded-xl p-3 outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/20 transition resize-none"
              />
              <div className="flex justify-between mt-1 text-xs text-[#8e8e8e]">
                <span>{caption.length}/2200</span>
                <span>AI checks the media, caption and purpose together</span>
              </div>
              <button onClick={check} disabled={!caption.trim()} className="mt-4 w-full py-3 bg-[#7c3aed] text-white text-sm font-semibold rounded-xl hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed transition">
                Run AI check
              </button>
            </div>
          )}

          {step === 'checking' && (
            <div className="py-10 text-center">
              <div className="w-16 h-16 ai-badge-bg rounded-full flex items-center justify-center mx-auto mb-5 relative">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                <div className="absolute -inset-1 border-4 border-[#7c3aed]/20 border-t-[#7c3aed] rounded-full animate-spin" />
              </div>
              <h3 className="text-base font-semibold text-[#262626] mb-1">AI Content Analysis</h3>
              <p className="text-sm text-[#8e8e8e]">{progress || `Checking your ${kind}, caption and purpose together...`}</p>
            </div>
          )}

          {step === 'result' && result && (
            <div>
              <div className="rounded-xl overflow-hidden bg-[#efefef] mb-4">
                <Media blob={file!} kind={kind} className="w-full max-h-56 object-contain" />
              </div>
              <div className={`rounded-xl p-4 mb-4 border ${result.status === 'approved' ? 'bg-[#f0fdf4] border-[#86efac]' : result.status === 'rejected' ? 'bg-[#fef2f2] border-[#fca5a5]' : 'bg-[#fffbeb] border-[#fcd34d]'}`}>
                <p className={`text-sm font-semibold ${result.status === 'approved' ? 'text-[#15803d]' : result.status === 'rejected' ? 'text-[#dc2626]' : 'text-[#b45309]'}`}>
                  {result.status === 'approved' ? 'Approved' : result.status === 'rejected' ? 'Blocked' : 'Warning'}: {result.message}
                </p>
                {result.confidence && <p className="text-xs text-[#15803d] mt-1">Academic content confidence: {result.confidence}%</p>}
                {result.reason && <p className="text-xs text-[#6b7280] mt-1 leading-relaxed">{result.reason}</p>}
              </div>
              {error && <p role="alert" className="text-xs text-[#dc2626] mb-3">{error}</p>}
              <div className="flex flex-col gap-2">
                {result.status === 'approved' && (
                  <button onClick={share} disabled={posting} className="w-full py-3 bg-[#0095f6] text-white text-sm font-semibold rounded-xl hover:bg-[#0080d6] disabled:opacity-60 transition">
                    {posting ? 'Sharing...' : 'Share post'}
                  </button>
                )}
                <button onClick={back} className={`w-full py-3 text-sm font-semibold rounded-xl transition ${result.status === 'rejected' ? 'bg-[#7c3aed] text-white hover:bg-[#6d28d9]' : 'bg-[#efefef] text-[#262626] hover:bg-[#dbdbdb]'}`}>
                  Edit caption
                </button>
                {result.status === 'rejected' && (
                  <button onClick={onClose} className="w-full py-3 bg-[#efefef] text-[#262626] text-sm font-semibold rounded-xl hover:bg-[#dbdbdb] transition">Discard post</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
