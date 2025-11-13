

import React from 'react';
import { SitemapSummary } from '../types';
import { FileTextIcon, CalendarIcon, StarIcon, ZapIcon } from './icons';

interface SitemapSummaryMetricsProps {
  summary: SitemapSummary | null;
}

const MetricCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; colorClass: string }> = ({ title, value, icon, colorClass }) => (
    <div className={`bg-slate-800 p-6 rounded-lg shadow-lg flex items-center space-x-4 border-l-4 ${colorClass}`}>
        <div className="text-3xl">{icon}</div>
        <div>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
        </div>
    </div>
);

export const SitemapSummaryMetrics: React.FC<SitemapSummaryMetricsProps> = ({ summary }) => {
  if (!summary) return null;
  
  // FIX: Corrected sort function to ensure values from changeFreqDistribution are treated as numbers, resolving potential arithmetic errors.
  const mostFrequentChange = Object.entries(summary.changeFreqDistribution).sort(([, aVal], [, bVal]) => Number(bVal) - Number(aVal))[0]?.[0] || 'N/A';

  return (
    <div className="w-full max-w-6xl mx-auto mb-12">
      <h2 className="text-2xl font-bold text-slate-100 mb-6 text-center">Sitemap Summary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total URLs" value={summary.totalUrls} icon={<FileTextIcon className="text-cyan-400"/>} colorClass="border-cyan-500" />
        <MetricCard title="With Last Modified" value={`${summary.hasLastmod} / ${summary.totalUrls}`} icon={<CalendarIcon className="text-green-400"/>} colorClass="border-green-500" />
        <MetricCard title="Average Priority" value={summary.averagePriority.toFixed(2)} icon={<StarIcon className="text-yellow-400"/>} colorClass="border-yellow-500" />
        <MetricCard title="Top Change Freq." value={mostFrequentChange} icon={<ZapIcon className="text-blue-400"/>} colorClass="border-blue-500" />
      </div>
    </div>
  );
};