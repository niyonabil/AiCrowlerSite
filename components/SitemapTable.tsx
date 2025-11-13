import React from 'react';
import { SitemapEntry } from '../types';
import { DownloadIcon } from './icons';

interface SitemapTableProps {
  entries: SitemapEntry[];
}

const PriorityBadge: React.FC<{ priority: number }> = ({ priority }) => {
  let bgColor = 'bg-slate-600';
  if (priority >= 0.8) {
    bgColor = 'bg-green-500/30 text-green-300';
  } else if (priority >= 0.5) {
    bgColor = 'bg-yellow-500/30 text-yellow-300';
  } else {
    bgColor = 'bg-blue-500/30 text-blue-300';
  }

  return (
    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${bgColor}`}>
      {priority.toFixed(2)}
    </span>
  );
};


export const SitemapTable: React.FC<SitemapTableProps> = ({ entries }) => {
  if (entries.length === 0) return null;

  const handleExport = () => {
    const headers = ["URL", "Last Modified", "Change Frequency", "Priority"];
    
    const csvRows = entries.map(e => {
        const row = [e.loc, e.lastmod, e.changefreq, e.priority];
        return row.map(value => {
            const stringValue = String(value || '');
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'sitemap_analysis_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="w-full max-w-6xl mx-auto bg-slate-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-100">Sitemap URLs</h2>
            <button 
                onClick={handleExport}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2 px-4 rounded-lg inline-flex items-center transition-colors"
            >
                <DownloadIcon className="w-5 h-5 mr-2" />
                <span>Export to CSV</span>
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-900/50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">URL</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Last Modified</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Change Freq.</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Priority</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {entries.map((entry, index) => (
                      <tr key={index} className="hover:bg-slate-700/50 transition-colors duration-200">
                        <td className="px-6 py-4 max-w-lg">
                            <a href={entry.loc} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 break-all text-sm truncate" title={entry.loc}>
                                {entry.loc}
                            </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                            {entry.lastmod ? new Date(entry.lastmod).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 capitalize">
                            {entry.changefreq || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <PriorityBadge priority={entry.priority} />
                        </td>
                      </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
};