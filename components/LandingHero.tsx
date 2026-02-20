/**
 * LandingHero Component
 * Introduces first-time users to Sonic Architect's capabilities
 * Collapses to minimized state after first analysis
 */

import React, { useState, useEffect } from 'react';
import { Target, Music, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface LandingHeroProps {
  isMinimized: boolean;
  onDismiss: () => void;
}

const LandingHero: React.FC<LandingHeroProps> = ({ isMinimized, onDismiss }) => {
  const [isExpanded, setIsExpanded] = useState(!isMinimized);

  useEffect(() => {
    setIsExpanded(!isMinimized);
  }, [isMinimized]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleGetStarted = () => {
    // Scroll to upload section
    const uploadSection = document.querySelector('main section');
    if (uploadSection) {
      uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!isExpanded) {
    // Minimized state
    return (
      <div className="w-full bg-zinc-900/30 border-b border-zinc-800 transition-all duration-300 ease-in-out">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="w-4 h-4 text-blue-400" aria-hidden="true" />
            <span className="text-sm text-zinc-400">
              Deconstruct Any Track into an Ableton Live Blueprint
            </span>
          </div>
          <button
            onClick={toggleExpanded}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none rounded"
            aria-label="Expand hero section"
          >
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded state
  return (
    <div className="w-full bg-gradient-to-b from-zinc-900/60 to-zinc-950 border-b border-zinc-800 transition-all duration-300 ease-in-out">
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleExpanded}
            className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none rounded"
            aria-label="Minimize hero section"
          >
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="text-center space-y-8">
          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-zinc-100 leading-tight">
            Deconstruct Any Track into an
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Ableton Live Blueprint
            </span>
          </h1>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Local Analysis */}
            <div className="flex flex-col items-center gap-3 p-6 bg-zinc-900/40 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors">
              <div className="p-3 bg-emerald-900/30 rounded-full border border-emerald-700/30">
                <Target className="w-6 h-6 text-emerald-400" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
                Local Analysis
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                No API keys, works offline. All processing happens in your browser.
              </p>
            </div>

            {/* MIDI Transcription */}
            <div className="flex flex-col items-center gap-3 p-6 bg-zinc-900/40 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors">
              <div className="p-3 bg-violet-900/30 rounded-full border border-violet-700/30">
                <Music className="w-6 h-6 text-violet-400" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
                MIDI Transcription
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Audio to MIDI conversion with pitch detection and quantization.
              </p>
            </div>

            {/* Ableton Blueprint */}
            <div className="flex flex-col items-center gap-3 p-6 bg-zinc-900/40 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors">
              <div className="p-3 bg-blue-900/30 rounded-full border border-blue-700/30">
                <FileText className="w-6 h-6 text-blue-400" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
                Ableton Blueprint
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Complete device chain reconstruction with telemetry and FX analysis.
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <div>
            <button
              onClick={handleGetStarted}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all shadow-lg shadow-blue-500/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus:outline-none"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingHero;
