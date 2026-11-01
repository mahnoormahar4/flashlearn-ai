export type StudyRating = 'got_it' | 'need_review';

export interface Flashcard {
  id: number;
  topic: string;
  question: string;
  answer: string;
  keyTakeaway: string;
  textQuote: string; // Exact supporting sentence from the submitted lesson
  isVerified?: boolean; // True if fully verified against lesson text, false if unverified
  verificationIssue?: string;
  hadUnsupportedDetails?: boolean;
  wasRevised?: boolean;
  revisionNote?: string;
}

export interface GenerateResponse {
  success: boolean;
  hasSufficientInfo: boolean;
  topicTitle?: string;
  isValidated?: boolean;
  verifiedCount?: number;
  totalCount?: number;
  verificationStatus?: 'all_verified' | 'partially_verified' | 'unavailable';
  verificationNotice?: string;
  isCapped?: boolean;
  cappedNote?: string;
  validationNotes?: string;
  validationWarning?: string;
  message?: string;
  cards: Flashcard[];
  generatedAt?: string;
  error?: string;
}
