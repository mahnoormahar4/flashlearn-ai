import { Flashcard, StudyRating } from '../types.ts';

export const STORAGE_KEY = 'flashlearn_ai_study_session_v1';

export interface SavedSession {
  version: 1;
  lessonText: string;
  cards: Flashcard[];
  ratings: Record<number, StudyRating>;
  activeCardIndex: number;
  topicTitle?: string;
  isValidated?: boolean;
  verificationNotice?: string;
  verificationStatus?: 'all_verified' | 'partially_verified' | 'unavailable';
  verifiedCount?: number;
  isCapped?: boolean;
  cappedNote?: string;
  savedAt: string;
}

export function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const testKey = '__fl_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function loadSavedSession(): SavedSession | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    // Validate essential properties
    if (!Array.isArray(parsed.cards) || parsed.cards.length === 0) {
      return null;
    }

    // Validate that each card is a valid card object
    const validCards = parsed.cards.filter(
      (c: any) =>
        c &&
        typeof c.id === 'number' &&
        typeof c.question === 'string' &&
        typeof c.answer === 'string'
    );
    if (validCards.length < 2) {
      return null;
    }

    const ratings: Record<number, StudyRating> = {};
    if (parsed.ratings && typeof parsed.ratings === 'object') {
      for (const [k, v] of Object.entries(parsed.ratings)) {
        const idNum = Number(k);
        if (!isNaN(idNum) && (v === 'got_it' || v === 'need_review')) {
          ratings[idNum] = v;
        }
      }
    }

    const activeCardIndex =
      typeof parsed.activeCardIndex === 'number' &&
      parsed.activeCardIndex >= 0 &&
      parsed.activeCardIndex < validCards.length
        ? parsed.activeCardIndex
        : 0;

    return {
      version: 1,
      lessonText: typeof parsed.lessonText === 'string' ? parsed.lessonText : '',
      cards: validCards,
      ratings,
      activeCardIndex,
      topicTitle: typeof parsed.topicTitle === 'string' ? parsed.topicTitle : undefined,
      isValidated: Boolean(parsed.isValidated),
      verificationNotice:
        typeof parsed.verificationNotice === 'string' ? parsed.verificationNotice : undefined,
      verificationStatus:
        parsed.verificationStatus === 'all_verified' ||
        parsed.verificationStatus === 'partially_verified' ||
        parsed.verificationStatus === 'unavailable'
          ? parsed.verificationStatus
          : 'all_verified',
      verifiedCount: typeof parsed.verifiedCount === 'number' ? parsed.verifiedCount : undefined,
      isCapped: Boolean(parsed.isCapped),
      cappedNote: typeof parsed.cappedNote === 'string' ? parsed.cappedNote : undefined,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    };
  } catch (err) {
    console.warn('Damaged or unreadable study session in localStorage:', err);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    return null;
  }
}

export function saveSession(
  session: Omit<SavedSession, 'version' | 'savedAt'>
): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }
  try {
    const payload: SavedSession = {
      ...session,
      version: 1,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('Failed to save study session to localStorage:', err);
    return false;
  }
}

export function clearSavedSession(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to remove saved study session:', err);
  }
}
