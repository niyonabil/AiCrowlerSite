import React from 'react';
import { RobotsTxtAnalysis } from '../types';
import { CheckCircleIcon, ExclamationCircleIcon, FileTextIcon } from './icons';

interface RobotsTxtDisplayProps {
  data: RobotsTxtAnalysis;
}

// A utility to group rules by user agent
const groupRulesByUserAgent = (rules: RobotsTxtAnalysis['rules']) => {
  return rules.reduce((acc, rule) => {
    (acc[rule.userAgent] = acc[rule.userAgent] || []).push(rule);
    return acc;
  }, {} as Record<string, RobotsTxtAnalysis['rules']>);
};

export const RobotsTxtDisplay: React.FC<RobotsTxtDisplayProps> = ({ data }) => {
  const groupedRules = groupRulesByUserAgent(data.rules);
  const userAgents = Object.keys(groupedRules).sort((a,b) => a === '*' ? -1 : b === '*' ? 1: a.localeCompare(b));


  if (data.rules.length === 0 && data.sitemaps.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-slate-800 rounded-lg shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-slate-100 mb-4">Robots.txt Analysis</h2>
        <p className="text-slate-400">The AI could not find a robots.txt file or it was empty. This means all paths are allowed for all crawlers by default.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-800 rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-2xl font-bold text-slate-100">Robots.txt Analysis</h2>
      </div>

      <div className="p-6 space-y-8">
        {/* Sitemaps Section */}
        {data.sitemaps.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-slate-300 mb-3 border-b border-slate-700 pb-2">Sitemap Locations</h3>
            <div className="bg-slate-900/50 p-4 rounded-lg">
                <ul className="space-y-3">
                {data.sitemaps.map((sitemap, index) => (
                    <li key={index} className="flex items-center space-x-3 font-mono text-sm">
                    <FileTextIcon className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <a 
                        href={sitemap} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-cyan-400 hover:underline break-all"
                    >
                        {sitemap}
                    </a>
                    </li>
                ))}
                </ul>
            </div>
          </div>
        )}

        {/* Rules Section */}
        {userAgents.length > 0 && (
           <div>
            <h3 className="text-lg font-semibold text-slate-300 mb-3 border-b border-slate-700 pb-2">Crawler Directives</h3>
             <div className="space-y-6">
               {userAgents.map(agent => (
                 <div key={agent} className="bg-slate-900/50 p-4 rounded-lg">
                   <h4 className="font-bold font-mono text-slate-200 mb-3">User-agent: {agent}</h4>
                   <ul className="space-y-2">
                     {groupedRules[agent].map((rule, index) => (
                       <li key={index} className="flex items-center space-x-3 font-mono text-sm">
                         {rule.type === 'Allow' ? (
                           <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
                         ) : (
                           <ExclamationCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
                         )}
                         <span className={`w-16 flex-shrink-0 ${rule.type === 'Allow' ? 'text-green-400' : 'text-red-400'}`}>{rule.type}:</span>
                         <span className="text-slate-300 break-all">{rule.path}</span>
                       </li>
                     ))}
                   </ul>
                 </div>
               ))}
             </div>
           </div>
        )}
      </div>
    </div>
  );
};