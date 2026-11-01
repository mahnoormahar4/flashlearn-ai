import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  CheckCircle2,
  Sparkles,
  BookOpen,
  List,
  Check,
  Quote,
  ThumbsUp,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Layers,
  ArrowLeft,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Flashcard, StudyRating } from '../types.ts';
import { isRTL, detectLanguage, findMatchingVoice } from '../utils/speech.ts';

interface FlashcardViewerProps {
  cards: Flashcard[];
  onReset: () => void;
  onStartNewLesson?: () => void;
  lessonText: string;
  topicTitle?: string;
  isValidated?: boolean;
  verificationNotice?: string;
  verificationStatus?: 'all_verified' | 'partially_verified' | 'unavailable';
  verifiedCount?: number;
  isCapped?: boolean;
  cappedNote?: string;
  initialRatings?: Record<number, StudyRating>;
  initialCardIndex?: number;
  onRatingsChange?: (ratings: Record<number, StudyRating>) => void;
  onCardIndexChange?: (index: number) => void;
}

export const FlashcardViewer: React.FC<FlashcardViewerProps> = ({
  cards,
  onReset,
  onStartNewLesson,
  topicTitle,
  isValidated = false,
  verificationNotice,
  verificationStatus = 'all_verified',
  verifiedCount,
  isCapped = false,
  cappedNote,
  initialRatings,
  initialCardIndex = 0,
  onRatingsChange,
  onCardIndexChange,
}) => {
  // Study ratings tracking
  const [localRatings, setLocalRatings] = useState<Record<number, StudyRating>>(initialRatings || {});
  const [viewMode, setViewMode] = useState<'study' | 'list'>('study');
  const [isDifficultOnly, setIsDifficultOnly] = useState(false);
  const [localCardIndex, setLocalCardIndex] = useState<number>(initialCardIndex);
  const [isFlipped, setIsFlipped] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<{ target: string; message: string } | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [friendlyMessage, setFriendlyMessage] = useState<string | null>(null);

  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioErrorTimeoutRef = useRef<any>(null);

  // Initialize and listen to available browser voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available && available.length > 0) {
        setVoices(available);
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.cancel();
      }
      if (audioErrorTimeoutRef.current) {
        clearTimeout(audioErrorTimeoutRef.current);
      }
    };
  }, []);

  // Sync if initialRatings changes from parent
  useEffect(() => {
    if (initialRatings) {
      setLocalRatings(initialRatings);
    }
  }, [initialRatings]);

  // Sync if initialCardIndex changes from parent
  useEffect(() => {
    if (typeof initialCardIndex === 'number') {
      setLocalCardIndex(initialCardIndex);
    }
  }, [initialCardIndex]);

  const ratings = initialRatings !== undefined ? initialRatings : localRatings;
  const activeCardIndex = initialCardIndex !== undefined ? initialCardIndex : localCardIndex;

  const setActiveCardIndex = (newIndex: number) => {
    setLocalCardIndex(newIndex);
    onCardIndexChange?.(newIndex);
  };

  // Actual total cards count N (flexible, 2 to 15)
  const totalCards = cards.length;

  // Real verified counts based on actual card verification flags
  const actualVerifiedCards = useMemo(() => {
    return cards.filter((c) => c.isVerified !== false);
  }, [cards]);
  const actualVerifiedCount = actualVerifiedCards.length;
  const isEveryCardVerified = actualVerifiedCount === totalCards;

  // 4 & 5. Honest display notice adapted to actual card count N
  const displayNotice = useMemo(() => {
    if (verificationStatus === 'unavailable') {
      return 'Verification unavailable. Please check these cards against your textbook';
    }
    if (verificationNotice && verificationNotice.trim()) {
      return verificationNotice;
    }
    if (isEveryCardVerified) {
      return `All ${totalCards} cards verified against your lesson`;
    }
    return `${actualVerifiedCount} of ${totalCards} cards verified against your lesson`;
  }, [verificationNotice, verificationStatus, isEveryCardVerified, actualVerifiedCount, totalCards]);

  // 4. Progress summary counts (must always add up to totalCards N)
  const gotItCount = useMemo(() => {
    return cards.filter((c) => ratings[c.id] === 'got_it').length;
  }, [cards, ratings]);

  const needReviewCount = useMemo(() => {
    return cards.filter((c) => ratings[c.id] === 'need_review').length;
  }, [cards, ratings]);

  const notRatedCount = totalCards - gotItCount - needReviewCount;

  // Filter difficult cards ("Need to Review")
  const difficultCards = useMemo(() => {
    return cards.filter((c) => ratings[c.id] === 'need_review');
  }, [cards, ratings]);

  const displayedCards = useMemo(() => {
    if (isDifficultOnly) {
      return difficultCards.length > 0 ? difficultCards : cards;
    }
    return cards;
  }, [isDifficultOnly, difficultCards, cards]);

  const safeIndex = Math.min(activeCardIndex, Math.max(0, displayedCards.length - 1));
  const currentCard = displayedCards[safeIndex] || cards[0];

  // Auto exit difficult review if all difficult cards are cleared
  useEffect(() => {
    if (isDifficultOnly && difficultCards.length === 0) {
      setFriendlyMessage('🎉 Wonderful! You have cleared all difficult cards!');
      setIsDifficultOnly(false);
      setActiveCardIndex(0);
      setIsFlipped(false);
    }
  }, [isDifficultOnly, difficultCards.length]);

  // Reset flip, speech, and errors when switching cards
  useEffect(() => {
    setIsFlipped(false);
    stopSpeaking();
    setAudioError(null);
  }, [safeIndex, isDifficultOnly]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      if (audioErrorTimeoutRef.current) {
        clearTimeout(audioErrorTimeoutRef.current);
      }
    };
  }, []);

  const handleFlip = () => {
    stopSpeaking();
    setAudioError(null);
    setIsFlipped((prev) => !prev);
  };

  // 4. Navigation limits: Disable Previous on Card 1 and Next on Card N
  const isFirstCard = safeIndex === 0;
  const isLastCard = safeIndex === displayedCards.length - 1;

  const handlePrev = () => {
    if (!isFirstCard) {
      setActiveCardIndex(safeIndex - 1);
    }
  };

  const handleNext = () => {
    if (!isLastCard) {
      setActiveCardIndex(safeIndex + 1);
    }
  };

  const handleSetRating = (cardId: number, newRating: StudyRating) => {
    let next: Record<number, StudyRating>;
    if (ratings[cardId] === newRating) {
      next = { ...ratings };
      delete next[cardId];
    } else {
      next = {
        ...ratings,
        [cardId]: newRating,
      };
    }
    setLocalRatings(next);
    onRatingsChange?.(next);
  };

  const handleReviewDifficult = () => {
    if (needReviewCount === 0) {
      setFriendlyMessage('No difficult cards yet. Great job!');
      setTimeout(() => setFriendlyMessage(null), 4500);
      return;
    }
    setFriendlyMessage(null);
    setIsDifficultOnly(true);
    setActiveCardIndex(0);
    setIsFlipped(false);
  };

  const handleBackToAllCards = () => {
    setIsDifficultOnly(false);
    const mainIdx = cards.findIndex((c) => c.id === currentCard.id);
    setActiveCardIndex(mainIdx >= 0 ? mainIdx : 0);
    setIsFlipped(false);
    setFriendlyMessage(null);
  };

  const handleSpeak = (text: string, targetKey: string) => {
    if (audioErrorTimeoutRef.current) {
      clearTimeout(audioErrorTimeoutRef.current);
    }
    setAudioError(null);

    // If browser doesn't support SpeechSynthesis
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setAudioError({
        target: targetKey,
        message: 'Audio is not available for this language on your device.',
      });
      audioErrorTimeoutRef.current = setTimeout(() => setAudioError(null), 5000);
      return;
    }

    // If already speaking this target, toggle off
    if (speakingKey === targetKey) {
      stopSpeaking();
      return;
    }

    // 3. Cancel any speech already in progress first
    stopSpeaking();

    // 1. Detect language of the card text (Urdu vs English, etc.)
    const detected = detectLanguage(text);

    // 1. Check which voices the browser has
    let availableVoices = voices;
    if (!availableVoices || availableVoices.length === 0) {
      availableVoices = window.speechSynthesis.getVoices() || [];
    }

    const matchedVoice = findMatchingVoice(availableVoices, detected);

    // 2. If no voice is available for the card's language, do not fail silently
    if (!matchedVoice) {
      setAudioError({
        target: targetKey,
        message: 'Audio is not available for this language on your device.',
      });
      audioErrorTimeoutRef.current = setTimeout(() => setAudioError(null), 5000);
      return;
    }

    // 3. Start speech with clear speaking state
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = matchedVoice;
      utterance.lang = matchedVoice.lang || detected.bcp47;
      utterance.rate = 0.9;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setSpeakingKey(targetKey);
      };

      utterance.onend = () => {
        setSpeakingKey((curr) => (curr === targetKey ? null : curr));
        currentUtteranceRef.current = null;
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis utterance error:', e);
        setSpeakingKey((curr) => (curr === targetKey ? null : curr));
        currentUtteranceRef.current = null;
      };

      currentUtteranceRef.current = utterance;
      setSpeakingKey(targetKey);
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Failed to speak utterance:', err);
      setAudioError({
        target: targetKey,
        message: 'Audio is not available for this language on your device.',
      });
      audioErrorTimeoutRef.current = setTimeout(() => setAudioError(null), 5000);
      setSpeakingKey(null);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingKey(null);
    currentUtteranceRef.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'study') return;
      if (e.key === 'ArrowRight' && !isLastCard) {
        handleNext();
      } else if (e.key === 'ArrowLeft' && !isFirstCard) {
        handlePrev();
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (
          document.activeElement?.tagName !== 'BUTTON' &&
          document.activeElement?.tagName !== 'TEXTAREA' &&
          document.activeElement?.tagName !== 'INPUT'
        ) {
          e.preventDefault();
          handleFlip();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [safeIndex, isFirstCard, isLastCard, viewMode]);

  const currentRating = ratings[currentCard.id];

  // Helper for small colored study badge
  const renderStatusBadge = (rating: StudyRating | undefined) => {
    if (rating === 'got_it') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Got It</span>
        </span>
      );
    }
    if (rating === 'need_review') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-300">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span>Need to Review</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span>Not Yet Rated</span>
      </span>
    );
  };

  // Verification Badge for a card (orange if not verified, green if verified)
  const renderVerificationBadge = (isVerified: boolean | undefined) => {
    if (isVerified === false) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-300 shadow-2xs">
          <AlertCircle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          <span>Not verified against your lesson</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
        <span>Verified from your lesson</span>
      </span>
    );
  };

  const dynamicTitle = topicTitle && topicTitle !== 'Lesson'
    ? `${topicTitle} Flashcards`
    : 'Lesson Flashcards';

  return (
    <div className="space-y-6">
      {/* 6. Long Text Capping Note */}
      {(isCapped || cappedNote) && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3 shadow-xs animate-fade-in">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm leading-relaxed">
            <strong>Long Lesson Note:</strong>{' '}
            {cappedNote || 'Your lesson was long, so we created the 15 most important cards. Paste the next section to make more.'}
          </div>
        </div>
      )}

      {/* Top Header & Navigation Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/90 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <BookOpen className="w-5 h-5 text-indigo-100" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {dynamicTitle}
                </h2>
                {/* 4 & 5. Honest notice badge with actual total card count */}
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                    verificationStatus === 'unavailable'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : isEveryCardVerified
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-orange-100 text-orange-900 border-orange-300'
                  }`}
                >
                  {verificationStatus === 'unavailable' ? (
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                  ) : isEveryCardVerified ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-orange-600" />
                  )}
                  <span>{displayNotice}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Classes 6–8 Study Module • {totalCards} Study Cards
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Switcher & Edit Lesson */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setViewMode('study');
                setIsFlipped(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'study'
                  ? 'bg-white text-indigo-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Study Mode</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-indigo-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>View All Cards ({totalCards})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 bg-white border border-slate-200 transition-colors cursor-pointer shadow-xs"
            title="Edit lesson text and generate again"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Edit Lesson</span>
          </button>

          {onStartNewLesson && (
            <button
              type="button"
              onClick={onStartNewLesson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 bg-white border border-red-200 transition-colors cursor-pointer shadow-xs"
              title="Start a new lesson and clear saved session"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Start New Lesson</span>
            </button>
          )}
        </div>
      </div>

      {/* Friendly Notice Toast / Banner */}
      {friendlyMessage && (
        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs sm:text-sm text-indigo-900 flex items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="font-medium">{friendlyMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setFriendlyMessage(null)}
            className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4. PROGRESS SUMMARY: Got It, Need to Review, Not Yet Rated (always sums to N) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>Study Progress Summary</span>
            </h3>
            <p className="text-xs text-slate-500">
              Reveal each card&apos;s answer, then rate it to track your review.
            </p>
          </div>

          {/* Review Difficult Cards / Back to All Cards */}
          <div className="flex items-center gap-2">
            {isDifficultOnly ? (
              <button
                type="button"
                onClick={handleBackToAllCards}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to All Cards</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReviewDifficult}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs bg-orange-50 text-orange-900 border border-orange-300 hover:bg-orange-100 hover:border-orange-400"
              >
                <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
                <span>Review Difficult Cards ({needReviewCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Counts that always sum to totalCards N */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center mb-3">
          {/* Got It: X */}
          <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Got It</span>
            </div>
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-0.5">
              {gotItCount}
            </span>
          </div>

          {/* Need to Review: Y */}
          <div className="p-2.5 rounded-xl bg-orange-50/80 border border-orange-200 flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-800">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span>Need to Review</span>
            </div>
            <span className="text-xl sm:text-2xl font-extrabold text-orange-700 mt-0.5">
              {needReviewCount}
            </span>
          </div>

          {/* Not Yet Rated: Z */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span>Not Yet Rated</span>
            </div>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-700 mt-0.5">
              {notRatedCount}
            </span>
          </div>
        </div>

        {/* 4. Visual Progress Bar adapted to totalCards N */}
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${(gotItCount / totalCards) * 100}%` }}
            title={`Got It: ${gotItCount}`}
          />
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${(needReviewCount / totalCards) * 100}%` }}
            title={`Need to Review: ${needReviewCount}`}
          />
        </div>
      </div>

      {/* ==================================================== */}
      {/* 1. STUDY MODE: ONE FLASHCARD AT A TIME */}
      {/* ==================================================== */}
      {viewMode === 'study' && (
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Active Difficult Review Banner */}
          {isDifficultOnly && (
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-300 text-xs sm:text-sm text-orange-900 flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600 shrink-0" />
                <span>
                  <strong>Reviewing Difficult Cards:</strong> Practicing {difficultCards.length} card
                  {difficultCards.length > 1 ? 's' : ''} marked &quot;Need to Review&quot;.
                </span>
              </div>
              <button
                type="button"
                onClick={handleBackToAllCards}
                className="text-xs font-bold text-orange-800 underline hover:text-orange-950 shrink-0 cursor-pointer"
              >
                Back to All Cards
              </button>
            </div>
          )}

          {/* Indicator & Jump Dots (Card X of N) */}
          <div className="flex items-center justify-between px-2 text-xs font-semibold text-slate-600">
            {/* 4. "Card 2 of N" indication */}
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
              <span className="text-sm font-bold text-slate-900">
                Card {safeIndex + 1} of {displayedCards.length}
              </span>
              {isDifficultOnly && (
                <span className="text-[11px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                  Difficult Only
                </span>
              )}
            </span>

            {/* Jump Dots with Colored Indicators (1 to N) */}
            <div className="flex flex-wrap items-center gap-1.5 max-w-[60%] justify-end">
              {displayedCards.map((c, idx) => {
                const r = ratings[c.id];
                const isSelected = idx === safeIndex;
                let dotClass = 'bg-slate-100 text-slate-600 border-slate-300';
                if (r === 'got_it') {
                  dotClass = 'bg-emerald-100 text-emerald-800 border-emerald-400';
                } else if (r === 'need_review') {
                  dotClass = 'bg-orange-100 text-orange-800 border-orange-400';
                }

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setActiveCardIndex(idx);
                      setIsFlipped(false);
                    }}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center border ${dotClass} ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 ring-offset-1 font-extrabold shadow-sm'
                        : 'hover:opacity-80'
                    }`}
                    title={`Card ${idx + 1}: ${c.topic}`}
                  >
                    {r === 'got_it' ? '✓' : r === 'need_review' ? '!' : idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3D Flip Card Container */}
          <div className="perspective-1000 w-full min-h-[420px] sm:min-h-[400px]">
            <div
              onClick={handleFlip}
              className={`relative w-full h-full min-h-[420px] sm:min-h-[400px] rounded-3xl transition-transform duration-500 transform-style-preserve-3d cursor-pointer shadow-md hover:shadow-lg select-none ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* ================================================= */}
              {/* FRONT OF CARD (QUESTION SIDE) */}
              {/* ================================================= */}
              <div className="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-white via-indigo-50/20 to-blue-50/30 rounded-3xl p-6 sm:p-8 flex flex-col justify-between border-2 border-indigo-200/80">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        {currentCard.topic}
                      </span>
                      {renderVerificationBadge(currentCard.isVerified)}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeak(currentCard.question, 'front');
                          }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                            speakingKey === 'front'
                              ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-1 animate-pulse shadow-sm'
                              : 'bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700'
                          }`}
                          title={speakingKey === 'front' ? 'Stop listening' : 'Listen to question'}
                          aria-label={speakingKey === 'front' ? 'Stop audio' : 'Listen to question'}
                        >
                          {speakingKey === 'front' ? (
                            <VolumeX className="w-4 h-4 text-white" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>

                        {audioError && audioError.target === 'front' && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-full right-0 sm:right-auto sm:left-0 mt-2 z-30 min-w-[220px] max-w-[270px] p-2.5 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-xl border border-slate-700 animate-fadeIn"
                          >
                            <div className="flex items-start gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span className="leading-snug">{audioError.message}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {renderStatusBadge(currentRating)}
                    </div>
                  </div>

                  <div className="text-xs uppercase tracking-wider font-extrabold text-indigo-500 mb-2">
                    Question • Card {safeIndex + 1} of {displayedCards.length}
                  </div>

                  <h3
                    dir={isRTL(currentCard.question) ? 'rtl' : 'ltr'}
                    className={`text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug ${
                      isRTL(currentCard.question) ? 'text-right' : 'text-left'
                    }`}
                  >
                    {currentCard.question}
                  </h3>
                </div>

                {/* Front Hint & Reveal Action */}
                <div className="pt-6 border-t border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Try recalling the answer, then tap to reveal</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFlip();
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer"
                  >
                    <span>Reveal Answer</span>
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ================================================= */}
              {/* BACK OF CARD (ANSWER SIDE) */}
              {/* Supporting sentence: "From your lesson: ..." */}
              {/* ================================================= */}
              <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-emerald-50/30 via-white to-teal-50/30 rounded-3xl p-6 sm:p-7 flex flex-col justify-between border-2 border-emerald-300/80 shadow-inner overflow-y-auto">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Answer • {currentCard.topic}
                      </span>
                      {renderVerificationBadge(currentCard.isVerified)}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeak(currentCard.answer, 'back');
                          }}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                            speakingKey === 'back'
                              ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-1 animate-pulse shadow-sm'
                              : 'bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700'
                          }`}
                          title={speakingKey === 'back' ? 'Stop listening' : 'Listen to answer'}
                          aria-label={speakingKey === 'back' ? 'Stop audio' : 'Listen to answer'}
                        >
                          {speakingKey === 'back' ? (
                            <VolumeX className="w-4 h-4 text-white" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>

                        {audioError && audioError.target === 'back' && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-full right-0 mt-2 z-30 min-w-[220px] max-w-[270px] p-2.5 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-xl border border-slate-700 animate-fadeIn"
                          >
                            <div className="flex items-start gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span className="leading-snug">{audioError.message}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {renderStatusBadge(currentRating)}
                    </div>
                  </div>

                  <div className="text-xs uppercase tracking-wider font-extrabold text-emerald-700 mb-1">
                    Lesson Answer:
                  </div>

                  <p
                    dir={isRTL(currentCard.answer) ? 'rtl' : 'ltr'}
                    className={`text-base sm:text-lg font-semibold text-slate-900 leading-relaxed mb-3 ${
                      isRTL(currentCard.answer) ? 'text-right' : 'text-left'
                    }`}
                  >
                    {currentCard.answer}
                  </p>

                  {/* Key Memory Point */}
                  {currentCard.keyTakeaway && (
                    <div
                      dir={isRTL(currentCard.keyTakeaway) ? 'rtl' : 'ltr'}
                      className={`p-2.5 rounded-xl bg-emerald-100/70 border border-emerald-200/90 text-xs sm:text-sm text-emerald-950 font-medium flex items-start gap-2 mb-2 ${
                        isRTL(currentCard.keyTakeaway) ? 'text-right' : 'text-left'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <strong>Key Memory Point:</strong> {currentCard.keyTakeaway}
                      </div>
                    </div>
                  )}

                  {/* 5. Supporting sentence: "From your lesson: ..." */}
                  {currentCard.textQuote && (
                    <div
                      dir={isRTL(currentCard.textQuote) ? 'rtl' : 'ltr'}
                      className={`p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2 italic ${
                        isRTL(currentCard.textQuote) ? 'text-right' : 'text-left'
                      }`}
                    >
                      <Quote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5 not-italic" />
                      <div className="flex-1">
                        <span className="not-italic font-bold text-slate-800">From your lesson:</span> &ldquo;{currentCard.textQuote}&rdquo;
                      </div>
                    </div>
                  )}
                </div>

                {/* Rating buttons shown ONLY after answer is revealed */}
                <div className="pt-3 mt-3 border-t border-emerald-200/90">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                    <span>Did you know this answer?</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      Tap a button to rate or change rating
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetRating(currentCard.id, 'got_it');
                      }}
                      className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
                        currentRating === 'got_it'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300'
                          : 'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span>{currentRating === 'got_it' ? '✓ Got It' : 'Got It'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetRating(currentCard.id, 'need_review');
                      }}
                      className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
                        currentRating === 'need_review'
                          ? 'bg-orange-600 text-white border-orange-700 shadow-md ring-2 ring-orange-300'
                          : 'bg-white hover:bg-orange-50 text-orange-800 border-orange-300'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{currentRating === 'need_review' ? '✓ Need to Review' : 'Need to Review'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Controls: Previous & Next */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handlePrev}
              disabled={isFirstCard}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                isFirstCard
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-xs cursor-pointer'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {/* Position indication e.g. "Card 2 of N" */}
            <div className="text-center">
              <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                Card {safeIndex + 1} of {displayedCards.length}
              </span>
              <div className="text-[11px] text-slate-500 font-medium">
                {currentRating === 'got_it' ? (
                  <span className="text-emerald-600 font-bold">Status: Got It</span>
                ) : currentRating === 'need_review' ? (
                  <span className="text-orange-600 font-bold">Status: Need to Review</span>
                ) : (
                  <span>Status: Not Yet Rated</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleNext}
              disabled={isLastCard}
              className={`inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                isLastCard
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer'
              }`}
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 4. Completion Message when student reaches the end (adapted to N cards) */}
          {isLastCard && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-blue-50 to-emerald-50 border border-indigo-200 text-center space-y-2 animate-fade-in shadow-xs">
              <div className="flex items-center justify-center gap-2 text-indigo-950 font-extrabold text-sm sm:text-base">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>You have reached the end of this study set!</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 font-medium">
                Final Tally: <strong className="text-emerald-700">{gotItCount} Got It</strong> •{' '}
                <strong className="text-orange-700">{needReviewCount} Need to Review</strong> •{' '}
                <strong className="text-slate-600">{notRatedCount} Not Yet Rated</strong> (out of {totalCards})
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCardIndex(0);
                    setIsFlipped(false);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 font-bold text-xs hover:bg-indigo-50 cursor-pointer shadow-xs"
                >
                  Start Over from Card 1
                </button>
                {needReviewCount > 0 && !isDifficultOnly && (
                  <button
                    type="button"
                    onClick={handleReviewDifficult}
                    className="px-3.5 py-1.5 rounded-xl bg-orange-600 text-white font-bold text-xs hover:bg-orange-700 cursor-pointer shadow-xs"
                  >
                    Review Difficult Cards ({needReviewCount})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. VIEW ALL CARDS LIST VIEW (ADAPTED TO N CARDS) */}
      {/* ==================================================== */}
      {viewMode === 'list' && (
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-600 px-1">
            <span>All {totalCards} Flashcards</span>
            <span className="text-xs text-indigo-600 font-bold">
              Classes 6–8 Study Guide
            </span>
          </div>

          {cards.map((card, idx) => {
            const cardRating = ratings[card.id];
            return (
              <div
                key={card.id}
                className={`bg-white rounded-2xl p-5 sm:p-6 shadow-sm border transition-all ${
                  cardRating === 'got_it'
                    ? 'border-emerald-300 bg-emerald-50/20'
                    : cardRating === 'need_review'
                    ? 'border-orange-300 bg-orange-50/20'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-xs">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {card.topic}
                    </span>
                    {renderVerificationBadge(card.isVerified)}
                    {renderStatusBadge(cardRating)}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => handleSpeak(`${card.question}. ${card.answer}`, `list-${card.id}`)}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          speakingKey === `list-${card.id}`
                            ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-1 animate-pulse'
                            : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                        }`}
                        title={speakingKey === `list-${card.id}` ? 'Stop listening' : 'Read question & answer'}
                        aria-label={speakingKey === `list-${card.id}` ? 'Stop audio' : 'Read question and answer'}
                      >
                        {speakingKey === `list-${card.id}` ? (
                          <VolumeX className="w-4 h-4 text-white" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>

                      {audioError && audioError.target === `list-${card.id}` && (
                        <div
                          className="absolute top-full right-0 mt-1.5 z-30 min-w-[220px] max-w-[270px] p-2.5 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-xl border border-slate-700 animate-fadeIn"
                        >
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span className="leading-snug">{audioError.message}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSetRating(card.id, 'got_it')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer border ${
                        cardRating === 'got_it'
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>Got It</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetRating(card.id, 'need_review')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer border ${
                        cardRating === 'need_review'
                          ? 'bg-orange-600 text-white border-orange-700'
                          : 'bg-white text-orange-800 border-orange-300 hover:bg-orange-50'
                      }`}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Review</span>
                    </button>
                  </div>
                </div>

                <h4
                  dir={isRTL(card.question) ? 'rtl' : 'ltr'}
                  className={`text-base font-bold text-slate-900 mb-2 ${
                    isRTL(card.question) ? 'text-right' : 'text-left'
                  }`}
                >
                  Q: {card.question}
                </h4>

                <div
                  dir={isRTL(card.answer) ? 'rtl' : 'ltr'}
                  className={`p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed mb-2 ${
                    isRTL(card.answer) ? 'text-right' : 'text-left'
                  }`}
                >
                  <strong className={`text-emerald-700 font-bold block mb-1 ${isRTL(card.answer) ? 'text-right' : 'text-left'}`}>
                    Answer:
                  </strong>
                  {card.answer}
                </div>

                {card.keyTakeaway && (
                  <p
                    dir={isRTL(card.keyTakeaway) ? 'rtl' : 'ltr'}
                    className={`text-xs text-indigo-900 font-medium flex items-center gap-1.5 mb-2 ${
                      isRTL(card.keyTakeaway) ? 'text-right justify-end' : 'text-left'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>{card.keyTakeaway}</span>
                  </p>
                )}

                {card.textQuote && (
                  <p
                    dir={isRTL(card.textQuote) ? 'rtl' : 'ltr'}
                    className={`text-xs text-slate-600 italic ${
                      isRTL(card.textQuote) ? 'text-right' : 'text-left'
                    }`}
                  >
                    <span className="not-italic font-bold text-slate-800">From your lesson:</span> &ldquo;{card.textQuote}&rdquo;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4 & 5. Source Verification Status Notice */}
      <div className="max-w-2xl mx-auto space-y-2">
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5 leading-relaxed">
          <BookOpen className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold text-slate-700">Source Verification Status:</strong>{' '}
            {verificationStatus === 'unavailable' ? (
              <span>Verification unavailable. Please check these cards against your textbook.</span>
            ) : isEveryCardVerified ? (
              <span>All {totalCards} cards verified against your lesson. Every answer is supported by direct quotes from the text you submitted.</span>
            ) : (
              <span>{displayNotice}. Any card that could not be verified against the text in your lesson box is clearly marked with an orange &quot;Not verified against your lesson&quot; label so you know to review it with your textbook.</span>
            )}
          </div>
        </div>

        {/* Study Session Note */}
        <div className="p-3 rounded-xl bg-slate-100/60 border border-slate-200/60 text-[11px] text-slate-500 flex items-center gap-2">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            <strong>Study Session Note:</strong> Your &ldquo;Got It&rdquo; and &ldquo;Need to Review&rdquo; ratings are stored for this current browser session only and are not permanently saved across different sessions or devices.
          </span>
        </div>
      </div>
    </div>
  );
};
