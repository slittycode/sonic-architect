/**
 * BlueprintNavigation Component
 * Provides quick navigation to blueprint sections with smooth scrolling
 */

import React, { useState } from 'react';
import { Activity, Clock, Layers, Settings2, Sparkles, LucideIcon } from 'lucide-react';

interface NavigationSection {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface BlueprintNavigationProps {
  onNavigate: (sectionId: string) => void;
}

const SECTIONS: NavigationSection[] = [
  { id: 'telemetry', label: 'Telemetry', icon: Activity },
  { id: 'arrangement', label: 'Arrangement', icon: Clock },
  { id: 'instruments', label: 'Instruments', icon: Layers },
  { id: 'fx', label: 'FX', icon: Settings2 },
  { id: 'secret-sauce', label: 'Secret Sauce', icon: Sparkles },
];

const BlueprintNavigation: React.FC<BlueprintNavigationProps> = ({ onNavigate }) => {
  const [activeSection, setActiveSection] = useState('telemetry');

  const handleNavigate = (sectionId: string) => {
    setActiveSection(sectionId);
    onNavigate(sectionId);
  };

  return (
    <nav className="sticky top-16 z-40 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 mb-6">
      <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          
          return (
            <button
              key={section.id}
              onClick={() => handleNavigate(section.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all min-h-[44px]
                ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }
              `}
              aria-label={`Navigate to ${section.label}`}
              aria-current={isActive ? 'true' : undefined}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">{section.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BlueprintNavigation;
