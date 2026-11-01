import React from 'react';
import { Sparkles, Trash2, FileText, ArrowRight, Lightbulb, AlertCircle } from 'lucide-react';
import { SAMPLE_LESSONS } from '../data/sampleLessons.ts';

interface LessonInputProps {
  lessonText: string;
  setLessonText: (text: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  validationError?: string | null;
}

export const LessonInput: React.FC<LessonInputProps> = ({
  lessonText,
  setLessonText,
  onGenerate,
  isLoading,
  validationError,
}) => {
  const wordCount = lessonText.trim() ? lessonText.trim().split(/\s+/).length : 0;
  const charCount = lessonText.length;

  const handleLoadSample = (sampleText: string) => {
    setLessonText(sampleText);
  };

  const handleClear = () => {
    setLessonText('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
      {/* Card Header */}
      <div className="bg-slate-50/80 border-b border-slate-200/80 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              Paste Your Lesson Text
            </h2>
            <p className="text-xs text-slate-500">
              Copy text from your textbook on any school subject
            </p>
          </div>
        </div>

        {/* Quick Sample Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleLoadSample(SAMPLE_LESSONS[0].text)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition-colors cursor-pointer disabled:opacity-50"
            title="Load a sample lesson"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Try a sample lesson</span>
          </button>
          {lessonText.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
              title="Clear text"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5">
        <div className="relative">
          <textarea
            value={lessonText}
            onChange={(e) => setLessonText(e.target.value)}
            disabled={isLoading}
            rows={7}
            placeholder="Paste your lesson text here on any school subject... (Science, History, Geography, English, Social Studies, Math concepts, etc.)"
            className={`w-full p-4 rounded-xl text-slate-800 text-sm sm:text-base leading-relaxed border transition-all resize-y placeholder:text-slate-400 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 ${
              validationError
                ? 'border-red-300 bg-red-50/20'
                : 'border-slate-300 bg-slate-50/30 hover:bg-white'
            }`}
          />
        </div>

        {validationError && (
          <div className="mt-2.5 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Footer controls & counts */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-1">
              <strong className="text-slate-800 font-bold">{wordCount}</strong> words
            </span>
            <span>•</span>
            <span>
              <strong className="text-slate-800 font-bold">{charCount}</strong> characters
            </span>
            {wordCount > 0 && wordCount < 20 && (
              <span className="text-amber-600 font-medium hidden sm:inline">
                (Tip: Include enough text to make at least 2 distinct study cards)
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onGenerate}
            disabled={isLoading || !lessonText.trim()}
            className={`inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm sm:text-base text-white shadow-md transition-all cursor-pointer ${
              isLoading || !lessonText.trim()
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-700 hover:shadow-lg active:scale-[0.99]'
            }`}
          >
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <span>Generate Flashcards</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Friendly Tip for young students */}
        <div className="mt-4 p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed">
          <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold text-blue-950">Study Tip for Classes 6–8:</strong>{' '}
            FlashLearn AI creates roughly one study card per key fact (between 2 and 15 cards) based on the length and content of your text. Cards use only facts directly stated in your lesson!
          </div>
        </div>
      </div>
    </div>
  );
};
