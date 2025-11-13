import React from 'react';
import { AdsTxtAnalysis } from '../types';

export const AdsTxtDisplay: React.FC<{ data: AdsTxtAnalysis }> = ({ data }) => {
  if (!data || (data.records.length === 0 && data.malformedLines.length === 0)) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-slate-800 rounded-lg shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-slate-100 mb-4">Ads.txt Analysis</h2>
        <p className="text-slate-400">The AI could not find an ads.txt file or it was empty.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-800 rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-2xl font-bold text-slate-100">Ads.txt Analysis</h2>
      </div>

      <div className="p-6">
        <h3 className="text-lg font-semibold text-slate-300 mb-3">Authorized Seller Records ({data.records.length})</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-900/50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Domain</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Publisher ID</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Relationship</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">TAG ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {data.records.map((record, index) => (
                <tr key={index} className="hover:bg-slate-700/50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200 font-mono">{record.domain}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300 font-mono">{record.publisherId}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300 capitalize">{record.relationship}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300 font-mono">{record.tagId || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.malformedLines.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-red-400 mb-3">Malformed Lines ({data.malformedLines.length})</h3>
            <div className="bg-slate-900/50 p-4 rounded-lg font-mono text-xs text-red-300 space-y-2">
              {data.malformedLines.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};