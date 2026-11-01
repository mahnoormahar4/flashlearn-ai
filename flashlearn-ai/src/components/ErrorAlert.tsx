import React from 'react';
import { AlertTriangle, BookOpen, RefreshCw, Edit3 } from 'lucide-react';
import { SAMPLE_LESSONS } from '../data/sampleLessons.ts';

interface ErrorAlertProps {
  message: string;
  isInsufficientInfo?: boolean;
  onRetry: () => void;
  onLoadSample: (sampleText: string) => void;
  onFocusInput: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  isInsufficientInfo = false,
  onRetry,
  onLoadSample,
  onFocusInput,
}) => {
  return (
    <div
      className={`rounded-2xl p-6 sm:p-7 border shadow-sm my-6 transition-all ${
        isInsufficientInfo
          ? 'bg-amber-50/90 border-amber-200 text-amber-950'
          : 'bg-red-50/90 border-red-200 text-red-950'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
            isInsufficientInfo
              ? 'bg-amber-200 text-amber-800'
              : 'bg-red-200 text-red-800'
          }`}
        >
          {isInsufficientInfo ? (
            <BookOpen className="w-6 h-6" />
          ) : (
            <AlertTriangle className="w-6 h-6" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-lg font-bold">
              {isInsufficientInfo
                ? 'More Lesson Information Needed'
                : 'Unable to Generate Flashcards'}
            </h3>
            {isInsufficientInfo && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                Textbook Check
              </span>
            )}
          </div>

          <p className="text-sm leading-relaxed mb-4 text-slate-700">
            {message}
          </p>

          {isInsufficientInfo && (
            <div className="mb-4 p-3 rounded-xl bg-white/80 border border-amber-200/80 text-xs text-amber-900 leading-relaxed">
              <strong className="font-semibold">Why this happens:</strong> FlashLearn AI only uses facts that are written in your text, and it never makes up answers. A very short text does not contain enough facts for at least 2 good cards. Try pasting a full paragraph or a whole section of your lesson.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {isInsufficientInfo ? (
              <>
                <button
                  type="button"
                  onClick={() => onLoadSample(SAMPLE_LESSONS[0].text)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Try a Sample Lesson</span>
                </button>
                <button
                  type="button"
                  onClick={onFocusInput}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white hover:bg-amber-100/50 text-amber-900 border border-amber-300 shadow-sm transition-all cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Add More to My Text</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Try Again</span>
                </button>
                <button
                  type="button"
                  onClick={() => onLoadSample(SAMPLE_LESSONS[0].text)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Load Sample Lesson Instead</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
