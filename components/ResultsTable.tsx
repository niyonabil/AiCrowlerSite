import React, { useState } from 'react';
import { CrawledPage, MetaTag, Link } from '../types';
import { DownloadIcon, ChevronDownIcon, ChevronUpIcon, XIcon } from './icons';

interface ResultsTableProps {
  pages: CrawledPage[];
}

const StatusBadge: React.FC<{ status: number }> = ({ status }) => {
  let bgColor = 'bg-slate-600';
  let textColor = 'text-slate-100';

  if (status >= 200 && status < 300) {
    bgColor = 'bg-green-500/20';
    textColor = 'text-green-400';
  } else if (status >= 300 && status < 400) {
    bgColor = 'bg-blue-500/20';
    textColor = 'text-blue-400';
  } else if (status >= 400 && status < 500) {
    bgColor = 'bg-red-500/20';
    textColor = 'text-red-400';
  } else if (status >= 500) {
    bgColor = 'bg-red-800/30';
    textColor = 'text-red-300';
  }

  return (
    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${bgColor} ${textColor}`}>
      {status}
    </span>
  );
};

const PageDetails: React.FC<{ page: CrawledPage }> = ({ page }) => (
  <div className="bg-slate-900/70 p-6 text-sm">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-slate-300 mb-1">Full Title</h4>
            <p className="text-slate-400">{page.title || 'N/A'}</p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-300 mb-1">Meta Description</h4>
            <p className="text-slate-400">{page.description || 'N/A'}</p>
          </div>
           <div>
            <h4 className="font-semibold text-slate-300 mb-1">H1 Heading</h4>
            <p className="text-slate-400 font-mono">{page.h1 || 'N/A'}</p>
          </div>
        </div>
        
        {/* Right Column */}
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-slate-300 mb-1">Content Preview</h4>
            <p className="text-slate-400 italic">"{page.contentPreview || 'N/A'}"</p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-300 mb-1">Meta Tags ({page.metaTags?.length || 0})</h4>
            {page.metaTags && page.metaTags.length > 0 ? (
              <div className="max-h-32 overflow-y-auto bg-slate-800 p-2 rounded-md font-mono text-xs">
                {page.metaTags.map((tag, i) => {
                  const identifier = tag.name ? `name="${tag.name}"` : `property="${tag.property}"`;
                  return <p key={i} className="text-slate-400 truncate" title={`${identifier}: "${tag.content}"`}>{identifier}</p>
                })}
              </div>
            ) : (
              <p className="text-slate-500">No meta tags found.</p>
            )}
          </div>
        </div>
    </div>
    
    {/* Internal Links Section */}
    {(page.internalLinkUrls && page.internalLinkUrls.length > 0) && (
      <div className="mt-6 pt-4 border-t border-slate-800">
        <h4 className="font-semibold text-slate-300 mb-2">Internal Links ({page.internalLinkUrls.length})</h4>
        <div className="max-h-40 overflow-y-auto bg-slate-800 p-3 rounded-md space-y-3">
          {page.internalLinkUrls.map((link, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-slate-200 truncate" title={link.anchor || 'N/A'}>
                {link.anchor || <span className="italic text-slate-400">No anchor text</span>}
              </p>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline break-all" title={link.url}>
                {link.url}
              </a>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);


export const ResultsTable: React.FC<ResultsTableProps> = ({ pages }) => {
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);
  const [modalLinkData, setModalLinkData] = useState<{
    type: 'internal' | 'external';
    links: Link[];
    pageUrl: string;
  } | null>(null);
  
  if (pages.length === 0) return null;

  const handleExport = () => {
    const headers = ["URL", "Status", "Title", "Description", "H1", "Content Preview", "Internal Links", "External Links", "Meta Tags (JSON)", "Internal Links Data (JSON)", "External Links Data (JSON)"];
    
    const csvRows = pages.map(p => {
        const row = [
            p.url,
            p.status,
            p.title,
            p.description,
            p.h1,
            p.contentPreview,
            p.internalLinks,
            p.externalLinks,
            JSON.stringify(p.metaTags || []),
            JSON.stringify(p.internalLinkUrls || []),
            JSON.stringify(p.externalLinkUrls || [])
        ];
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
    link.setAttribute('download', 'site_crawl_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleRow = (index: number) => {
    setExpandedRowIndex(expandedRowIndex === index ? null : index);
  };

  return (
    <div className="w-full max-w-6xl mx-auto bg-slate-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-100">Detailed Page Analysis</h2>
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
                        <th scope="col" className="w-12 px-6 py-3"></th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">URL</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Title</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            <div className="flex items-center group relative">
                                <span>Links (Est.)</span>
                                <span className="ml-1.5 text-slate-500 cursor-help">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </span>
                                <div className="absolute bottom-full mb-2 w-64 bg-slate-900 text-slate-300 text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 shadow-lg border border-slate-700 pointer-events-none">
                                    Link counts are estimated based on data visible to the AI in cached page content and may not reflect the full count from the live page.
                                </div>
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {pages.map((page, index) => (
                      <React.Fragment key={index}>
                        <tr className="hover:bg-slate-700/50 transition-colors duration-200">
                            <td className="px-6 py-4">
                                <button onClick={() => handleToggleRow(index)} className="text-slate-400 hover:text-cyan-400" aria-label="Show details">
                                    {expandedRowIndex === index ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                                </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <StatusBadge status={page.status} />
                            </td>
                            <td className="px-6 py-4 max-w-xs">
                                <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 break-all text-sm truncate" title={page.url}>
                                    {page.url}
                                </a>
                            </td>
                            <td className="px-6 py-4 max-w-md">
                                <div className="text-sm font-medium text-slate-100 truncate" title={page.title}>{page.title || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                               <div className="flex flex-col text-sm">
                                   <div className="text-slate-300">Internal: <span className="font-bold text-white">{page.internalLinks}</span></div>
                                   <div className="text-slate-300">External: <span className="font-bold text-white">{page.externalLinks}</span></div>
                               </div>
                            </td>
                        </tr>
                        {expandedRowIndex === index && (
                          <tr>
                            <td colSpan={5} className="p-0">
                               <PageDetails page={page} />
                               <div className="bg-slate-900/70 p-4 border-t border-slate-800 flex justify-center gap-6">
                                    {(page.internalLinkUrls?.length ?? 0) > 0 && (
                                        <button
                                            onClick={() => setModalLinkData({ type: 'internal', links: page.internalLinkUrls || [], pageUrl: page.url })}
                                            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 font-semibold"
                                        >
                                            Show Internal Links ({page.internalLinkUrls?.length})
                                        </button>
                                    )}
                                    {(page.externalLinkUrls?.length ?? 0) > 0 && (
                                        <button
                                            onClick={() => setModalLinkData({ type: 'external', links: page.externalLinkUrls || [], pageUrl: page.url })}
                                            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 font-semibold"
                                        >
                                            Show External Links ({page.externalLinkUrls?.length})
                                        </button>
                                    )}
                               </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
        
        {modalLinkData && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
                <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-700">
                    <header className="p-4 flex justify-between items-center border-b border-slate-700 flex-shrink-0">
                        <h3 className="text-lg font-bold text-slate-100 truncate" title={`${modalLinkData.type === 'internal' ? 'Internal' : 'External'} Links on ${modalLinkData.pageUrl}`}>
                            {modalLinkData.type === 'internal' ? 'Internal' : 'External'} Links on {modalLinkData.pageUrl}
                        </h3>
                        <button onClick={() => setModalLinkData(null)} className="text-slate-400 hover:text-white transition-colors">
                            <XIcon className="w-6 h-6" />
                            <span className="sr-only">Close modal</span>
                        </button>
                    </header>
                    <main className="p-6 overflow-y-auto">
                        <div className="divide-y divide-slate-700">
                            {modalLinkData.links.length > 0 ? (
                                modalLinkData.links.map((link, i) => (
                                    <div key={i} className="py-3">
                                        <p className="text-sm font-medium text-slate-100 truncate" title={link.anchor || 'N/A'}>
                                            {link.anchor || <span className="italic text-slate-400">No anchor text</span>}
                                        </p>
                                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline break-all" title={link.url}>
                                            {link.url}
                                        </a>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 italic p-3">No {modalLinkData.type} links found.</p>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        )}
    </div>
  );
};