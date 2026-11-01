import React from 'react';
import { Sparkles, BookOpen, Layers } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-gradient-to-r from-indigo-600 via-blue-600 to-teal-500 text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-5 sm:py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center shadow-inner text-amber-300">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                  FlashLearn AI
                </h1>
                <span className="hidden xs:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 shadow-sm">
                  <Sparkles className="w-3 h-3" /> Classes 6–8
                </span>
              </div>
              <p className="text-blue-100 text-sm sm:text-base font-medium mt-0.5">
                Works with any lesson text for Classes 6-8
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-blue-50">
            <BookOpen className="w-4 h-4 text-amber-300 shrink-0" />
            <span>Any Subject: <strong className="text-white font-semibold">Science, History, Geography, English & More</strong></span>
          </div>
        </div>
      </div>
    </header>
  );
};
