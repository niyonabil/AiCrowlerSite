import React from 'react';
import { SearchIcon, SpinnerIcon, ChevronDownIcon } from './icons';

interface UrlInputFormProps {
  onSubmit: () => void;
  isLoading: boolean;
  propertyUrl: string;
  onUrlChange: (url: string) => void;
  // FIX: Added 'ads' to the analysisMode type to match the possible states in the parent Auditor component.
  analysisMode: 'crawl' | 'sitemap' | 'robots' | 'ads';
  crawlDepth: number;
  onCrawlDepthChange: (depth: number) => void;
}

export const UrlInputForm: React.FC<UrlInputFormProps> = ({ 
  onSubmit, 
  isLoading, 
  propertyUrl,
  onUrlChange,
  analysisMode,
  crawlDepth,
  onCrawlDepthChange
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyUrl || isLoading) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex items-center bg-slate-800 border-2 border-slate-700 rounded-full shadow-lg overflow-hidden focus-within:ring-2 focus-within:ring-cyan-500 transition-all duration-300">
        <div className="pl-5 text-slate-500">
          <SearchIcon className="w-6 h-6" />
        </div>
        <input
          type="url"
          value={propertyUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          disabled={isLoading}
          placeholder="https://example.com"
          className="w-full bg-slate-800 text-lg text-slate-100 placeholder-slate-500 py-4 px-4 focus:outline-none disabled:opacity-70"
          aria-label="Website URL"
        />
        <button
          type="submit"
          disabled={isLoading || !propertyUrl.trim()}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-6 rounded-full m-1 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-300 flex-shrink-0 flex items-center"
        >
          {isLoading ? (
            <>
              <SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" aria-hidden="true" />
              Analyzing...
            </>
          ) : (
            'Analyze'
          )}
        </button>
      </div>
      
      {analysisMode === 'crawl' && (
        <div className="mt-6 flex justify-center items-center gap-4 px-4">
          <label htmlFor="crawl-depth" className="text-slate-400 text-sm font-medium whitespace-nowrap">
            Max Crawl Depth:
          </label>
          <div className="relative">
            <select
              id="crawl-depth"
              value={crawlDepth}
              onChange={(e) => onCrawlDepthChange(Number(e.target.value))}
              disabled={isLoading}
              className="bg-slate-700 text-cyan-400 font-bold text-sm rounded-md appearance-none cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 py-2 pl-4 pr-8"
              aria-label="Select maximum crawl depth"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map(depth => (
                <option key={depth} value={depth}>{depth}</option>
              ))}
            </select>
            <ChevronDownIcon className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}
    </form>
  );
};