import React from 'react';

type AnalysisMode = 'crawl' | 'sitemap' | 'robots' | 'ads';

interface AnalysisModeSelectorProps {
  mode: AnalysisMode;
  setMode: (mode: AnalysisMode) => void;
}

const ModeButton: React.FC<{
  title: string;
  description: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ title, description, isActive, onClick }) => {
  const baseClasses = "text-left p-4 rounded-lg border-2 transition-all duration-300 cursor-pointer flex-1";
  const activeClasses = "bg-slate-700/50 border-cyan-500 shadow-lg shadow-cyan-500/10";
  const inactiveClasses = "bg-slate-800/50 border-slate-700 hover:bg-slate-700/30 hover:border-slate-500";

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
    >
      <h3 className={`font-bold text-lg ${isActive ? 'text-cyan-400' : 'text-slate-200'}`}>{title}</h3>
      <p className="text-sm text-slate-400 mt-1">{description}</p>
    </button>
  );
};

export const AnalysisModeSelector: React.FC<AnalysisModeSelectorProps> = ({ mode, setMode }) => {
  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-4">
        <ModeButton
          title="Deep Crawl"
          description="Performs a live, real-time crawl of the website by following links to discover and analyze pages."
          isActive={mode === 'crawl'}
          onClick={() => setMode('crawl')}
        />
        <ModeButton
          title="Sitemap Analysis"
          description="Finds and analyzes all URLs listed in the website's sitemap.xml file."
          isActive={mode === 'sitemap'}
          onClick={() => setMode('sitemap')}
        />
        <ModeButton
          title="Robots.txt Analysis"
          description="Analyzes the robots.txt file to see crawling directives for search engines."
          isActive={mode === 'robots'}
          onClick={() => setMode('robots')}
        />
        <ModeButton
          title="Ads.txt Analysis"
          description="Finds and analyzes the ads.txt file for authorized digital sellers."
          isActive={mode === 'ads'}
          onClick={() => setMode('ads')}
        />
      </div>
    </div>
  );
};