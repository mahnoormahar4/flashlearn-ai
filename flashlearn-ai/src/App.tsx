import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { LessonInput } from './components/LessonInput.tsx';
import { FlashcardViewer } from './components/FlashcardViewer.tsx';
import { LoadingOverlay } from './components/LoadingOverlay.tsx';
import { ErrorAlert } from './components/ErrorAlert.tsx';
import { Flashcard, GenerateResponse, StudyRating } from './types.ts';
import { saveSession, loadSavedSession, clearSavedSession } from './utils/storage.ts';
import { Sparkles, HelpCircle, CheckCircle, ShieldCheck, AlertTriangle, X, RotateCcw } from 'lucide-react';

export default function App() {
  const [lessonText, setLessonText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [topicTitle, setTopicTitle] = useState<string | undefined>(undefined);
  const [isCapped, setIsCapped] = useState<boolean>(false);
  const [cappedNote, setCappedNote] = useState<string | undefined>(undefined);
  const [isValidated, setIsValidated] = useState<boolean>(false);
  const [verificationNotice, setVerificationNotice] = useState<string>('');
  const [verificationStatus, setVerificationStatus] = useState<'all_verified' | 'partially_verified' | 'unavailable'>('all_verified');
  const [verifiedCount, setVerifiedCount] = useState<number>(0);
  const [ratings, setRatings] = useState<Record<number, StudyRating>>({});
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);
  const [showConfirmNewLesson, setShowConfirmNewLesson] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isInsufficientInfo, setIsInsufficientInfo] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const inputSectionRef = useRef<HTMLDivElement>(null);

  // 2. RESTORE ON RETURN: Restore saved study session on initial load
  useEffect(() => {
    const saved = loadSavedSession();
    if (saved && saved.cards && saved.cards.length >= 2) {
      setLessonText(saved.lessonText || '');
      setCards(saved.cards);
      setRatings(saved.ratings || {});
      setActiveCardIndex(saved.activeCardIndex || 0);
      setTopicTitle(saved.topicTitle);
      setIsValidated(saved.isValidated || false);
      const totalCount = saved.cards.length;
      setVerificationNotice(
        saved.verificationNotice ||
          (saved.isValidated
            ? `All ${totalCount} cards verified against your lesson`
            : `${saved.verifiedCount || 0} of ${totalCount} cards verified against your lesson`)
      );
      setVerificationStatus(saved.verificationStatus || 'all_verified');
      setVerifiedCount(saved.verifiedCount ?? (saved.isValidated ? totalCount : 0));
      setIsCapped(Boolean(saved.isCapped));
      setCappedNote(saved.cappedNote);
      setRestoredNotice('Welcome back! Your study session was restored.');
    }
  }, []);

  // 1. AUTO-SAVE: Automatically save every time lesson text, cards, ratings, or position change
  useEffect(() => {
    if (cards && cards.length >= 2) {
      saveSession({
        lessonText,
        cards,
        ratings,
        activeCardIndex,
        topicTitle,
        isValidated,
        verificationNotice,
        verificationStatus,
        verifiedCount,
        isCapped,
        cappedNote,
      });
    }
  }, [
    cards,
    lessonText,
    ratings,
    activeCardIndex,
    topicTitle,
    isValidated,
    verificationNotice,
    verificationStatus,
    verifiedCount,
    isCapped,
    cappedNote,
  ]);

  const handleGenerate = async () => {
    setValidationError(null);
    setError(null);
    setIsInsufficientInfo(false);
    setIsValidated(false);

    const trimmed = lessonText.trim();
    if (!trimmed) {
      setValidationError('Please paste your lesson text into the box above.');
      inputSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (trimmed.length < 30) {
      setValidationError('Your lesson text is very short. Please paste at least one or two complete paragraphs from your textbook to make flashcards.');
      inputSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const response = await fetch('/api/generate-flashcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lessonText: trimmed }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: GenerateResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'The study server reported an issue. Please try again.');
      }

      if (data.hasSufficientInfo === false) {
        setIsInsufficientInfo(true);
        setIsValidated(false);
        setError(
          data.message ||
            'The supplied lesson does not contain enough information to generate meaningful flashcards. Please paste more lesson text from your textbook.'
        );
        setCards(null);
        return;
      }

      if (!data.cards || !Array.isArray(data.cards) || data.cards.length < 2) {
        throw new Error(
          data.message ||
            'The text is too short to make at least 2 study cards. Please paste a little more of your lesson text.'
        );
      }

      // Valid response with flexible cards (2 to 15) and actual verification status
      // Reset ratings and position on new lesson generation (Requirement 3)
      const newCards = data.cards.slice(0, 15);
      setCards(newCards);
      setRatings({});
      setActiveCardIndex(0);
      setRestoredNotice(null);
      setTopicTitle(data.topicTitle);
      setIsCapped(Boolean(data.isCapped));
      setCappedNote(data.cappedNote);
      setIsValidated(Boolean(data.isValidated));
      const totalGenerated = newCards.length;
      setVerificationNotice(
        data.verificationNotice ||
          (data.isValidated
            ? `All ${totalGenerated} cards verified against your lesson`
            : `${data.verifiedCount || 0} of ${totalGenerated} cards verified against your lesson`)
      );
      setVerificationStatus(data.verificationStatus || (data.isValidated ? 'all_verified' : 'partially_verified'));
      setVerifiedCount(data.verifiedCount ?? (data.isValidated ? totalGenerated : 0));
      setError(null);
      setIsInsufficientInfo(false);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Generation error:', err);
      setIsValidated(false);
      setVerificationStatus('unavailable');
      setVerificationNotice('Verification unavailable. Please check these cards against your textbook');
      if (err.name === 'AbortError') {
        setError(
          'Generation timed out because the AI study service took too long to reply. Please click Try Again or load the sample lesson.'
        );
      } else {
        setError(
          err?.message ||
            'Unable to connect to the study generator. Please check your internet connection or try again.'
        );
      }
      setCards(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCards(null);
    setTopicTitle(undefined);
    setIsCapped(false);
    setCappedNote(undefined);
    setIsValidated(false);
    setVerificationNotice('');
    setVerificationStatus('all_verified');
    setVerifiedCount(0);
    setError(null);
    setIsInsufficientInfo(false);
    setValidationError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 3. START FRESH: Prompt and confirm before removing current cards and progress
  const handlePromptStartNewLesson = () => {
    setShowConfirmNewLesson(true);
  };

  const handleConfirmStartNewLesson = () => {
    clearSavedSession();
    setCards(null);
    setRatings({});
    setActiveCardIndex(0);
    setTopicTitle(undefined);
    setIsCapped(false);
    setCappedNote(undefined);
    setIsValidated(false);
    setVerificationNotice('');
    setVerificationStatus('all_verified');
    setVerifiedCount(0);
    setError(null);
    setIsInsufficientInfo(false);
    setValidationError(null);
    setRestoredNotice(null);
    setShowConfirmNewLesson(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadSample = (sample: string) => {
    setLessonText(sample);
    setError(null);
    setIsInsufficientInfo(false);
    setValidationError(null);
    inputSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFocusInput = () => {
    inputSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 sm:py-8">
        {/* 2. RESTORE ON RETURN: Notification Banner */}
        {restoredNotice && cards && cards.length >= 2 && !isLoading && (
          <div className="mb-5 p-3.5 sm:p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold">
                {restoredNotice}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePromptStartNewLesson}
                className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline px-2 py-1 cursor-pointer"
              >
                Start New Lesson
              </button>
              <button
                type="button"
                onClick={() => setRestoredNotice(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-indigo-100/60 cursor-pointer"
                title="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Intro Banner for Class 6-8 Students */}
        {!cards && !isLoading && (
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-teal-500/10 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Ready to turn any lesson into flashcards?
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Paste your textbook text below or click &quot;Try a sample lesson&quot; to test your knowledge with clean, verified study cards.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-white/80 px-3 py-1.5 rounded-xl border border-indigo-200/60 shadow-xs shrink-0">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Textbook source-only mode</span>
            </div>
          </div>
        )}

        {/* Input Area (Visible when no cards yet or during errors) */}
        {!cards && !isLoading && (
          <div ref={inputSectionRef}>
            <LessonInput
              lessonText={lessonText}
              setLessonText={setLessonText}
              onGenerate={handleGenerate}
              isLoading={isLoading}
              validationError={validationError}
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && <LoadingOverlay />}

        {/* Error Alert */}
        {error && !isLoading && (
          <ErrorAlert
            message={error}
            isInsufficientInfo={isInsufficientInfo}
            onRetry={handleGenerate}
            onLoadSample={handleLoadSample}
            onFocusInput={handleFocusInput}
          />
        )}

        {/* Generated Flashcards View */}
        {cards && cards.length >= 2 && !isLoading && (
          <FlashcardViewer
            cards={cards}
            onReset={handleReset}
            onStartNewLesson={handlePromptStartNewLesson}
            lessonText={lessonText}
            topicTitle={topicTitle}
            isValidated={isValidated}
            verificationNotice={verificationNotice}
            verificationStatus={verificationStatus}
            verifiedCount={verifiedCount}
            isCapped={isCapped}
            cappedNote={cappedNote}
            initialRatings={ratings}
            initialCardIndex={activeCardIndex}
            onRatingsChange={(newRatings) => setRatings(newRatings)}
            onCardIndexChange={(newIndex) => setActiveCardIndex(newIndex)}
          />
        )}

        {/* Features / FAQ Grid for Young Learners */}
        {!cards && !isLoading && (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2.5 font-bold">
                <CheckCircle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Flexible Card Count (2 to 15)
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Creates roughly one card per key fact. Short lessons make fewer cards, while longer lessons create up to 15 cards.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center mb-2.5 font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Class 6–8 Friendly Language
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Clear sentences and key memory takeaways designed specifically for middle school students across any subject.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2.5 font-bold">
                <HelpCircle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                No Guessed Answers
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Every answer comes solely from your lesson text. If information is missing, the app tells you instead of guessing.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* 3. START FRESH: Confirmation Modal */}
      {showConfirmNewLesson && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Start New Lesson?</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              This will remove your current cards and progress. Continue?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmNewLesson(false)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 transition-colors cursor-pointer"
              >
                Keep Studying
              </button>
              <button
                type="button"
                onClick={handleConfirmStartNewLesson}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. PRIVACY NOTE: Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium text-slate-600">
            <strong>FlashLearn AI</strong> — Learn smarter, one card at a time.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-slate-400">
            <span>For Classes 6–8 • Science, History, Geography, English & More</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-indigo-600 font-semibold">Your progress is saved only on this device.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
