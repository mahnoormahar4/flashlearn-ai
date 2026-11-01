import React, { useEffect, useState } from 'react';
import { Layers, Sparkles } from 'lucide-react';

const LOADING_STEPS = [
  { message: 'Reading your lesson text...', hint: 'Identifying key facts and main ideas' },
  { message: 'Extracting key concepts and definitions...', hint: 'Checking verbatim quotes against your text' },
  { message: 'Drafting clear questions for your study cards...', hint: 'Making sure questions match your supplied text' },
  { message: 'Formulating student-friendly answers...', hint: 'Keeping vocabulary clear and easy to understand' },
  { message: 'Finalizing your study flashcards...', hint: 'Getting ready for revision!' },
];

export const LoadingOverlay: React.FC = () => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 2400);

    return () => clearInterval(timer);
  }, []);

  const currentStep = LOADING_STEPS[stepIndex];

  return (
    <div className="bg-white rounded-2xl p-8 sm:p-10 text-center shadow-md border border-indigo-100 max-w-xl mx-auto my-6 animate-fadeIn">
      {/* Animated Icon */}
      <div className="relative w-20 h-20 mx-auto mb-5 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-indigo-50 animate-ping opacity-60" />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
          <Layers className="w-8 h-8 animate-bounce" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-800 mb-2">
        {currentStep.message}
      </h3>
      <p className="text-sm text-indigo-600 font-medium mb-6">
        {currentStep.hint}
      </p>

      {/* Progress indicators */}
      <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
        {LOADING_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-500 ${
              i === stepIndex
                ? 'w-8 bg-indigo-600'
                : i < stepIndex
                ? 'w-2 bg-indigo-300'
                : 'w-2 bg-slate-200'
            }`}
          />
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-5">
        Please wait a moment while the AI creates strictly verified flashcards.
      </p>
    </div>
  );
};
