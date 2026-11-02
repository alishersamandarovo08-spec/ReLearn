export type AiStatus = 'approved' | 'rejected' | 'warning';

export interface AiResult {
  status: AiStatus;
  message: string;
  confidence?: number;
  reason?: string;
}

const STUDY_KEYWORDS = ['study', 'notes', 'exam', 'learn', 'math', 'science', 'homework', 'class', 'lecture', 'textbook',
  'assignment', 'quiz', 'test', 'grade', 'university', 'college', 'professor', 'research', 'formula', 'equation',
  'biology', 'chemistry', 'physics', 'history', 'algorithm', 'calculus', 'theorem', 'proof', 'lab', 'experiment',
  'engineering', 'programming', 'code', 'analysis', 'essay', 'thesis', 'semester', 'tutorial', 'concept', 'revision',
  'revise', 'course', 'chapter', 'economics', 'psychology', 'literature', 'philosophy'];

const BANNED_KEYWORDS = ['meme', 'funny vid', 'party', 'tiktok', 'beach', 'club', 'drama', 'gossip', 'food porn',
  'outfit', 'selfie', 'bored', 'lol nothing', 'nsfw', 'nude', 'porn', 'gambling', 'casino'];

export const SUBJECT_TAGS = ['Mathematics', 'Computer Science', 'Biology', 'Chemistry', 'Physics', 'History',
  'Literature', 'Engineering', 'Economics', 'Psychology', 'Philosophy', 'Art History', 'Medicine', 'Languages'];

export const EXPLORING = "I don't know exactly";
export const MAIN_SUBJECTS = [EXPLORING, ...SUBJECT_TAGS];

export function analyzeContent(caption: string, subject: string, kind: 'image' | 'video'): AiResult {
  const text = `${caption} ${subject}`.toLowerCase();
  const hasStudy = STUDY_KEYWORDS.some(k => text.includes(k)) || !!subject;
  const hasBanned = BANNED_KEYWORDS.some(k => text.includes(k));

  if (hasBanned) {
    return {
      status: 'rejected',
      message: 'Content flagged as off-topic',
      reason: 'Your post appears to contain non-academic or inappropriate content. ReLearn is exclusively for educational material. Please revise your caption to reflect the academic context.',
    };
  }
  if (hasStudy && caption.trim().length >= 20) {
    return { status: 'approved', message: 'Academic content verified', confidence: 88 + (caption.length % 10) };
  }
  if (caption.trim().length < 20) {
    return {
      status: 'warning',
      message: 'Insufficient context',
      reason: `Please add more academic context to your ${kind}. Include the subject, topic, or course details so our AI can verify the educational value.`,
    };
  }
  return {
    status: 'warning',
    message: 'Possible academic content',
    reason: "Our AI couldn't fully verify the academic relevance of your post. Picking a subject or adding subject-specific keywords will help.",
  };
}

export function extractTags(caption: string, subject: string) {
  const tags = new Set<string>();
  (caption.match(/#(\w+)/g) ?? []).forEach(t => tags.add(t.slice(1).toLowerCase()));
  if (subject) tags.add(subject.replace(/\s+/g, '').toLowerCase());
  return [...tags];
}
