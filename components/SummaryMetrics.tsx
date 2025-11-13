
import React from 'react';
import { CrawlSummary } from '../types';
import { CheckCircleIcon, ExclamationCircleIcon, ArrowCircleRightIcon } from './icons';

interface SummaryMetricsProps {
  summary: CrawlSummary | null;
}

const MetricCard: React.FC<{ title: string; value: number; icon: React.ReactNode; colorClass: string }> = ({ title, value, icon, colorClass }) => (
    <div className={`bg-slate-800 p-6 rounded-lg shadow-lg flex items-center space-x-4 border-l-4 ${colorClass}`}>
        <div className="text-3xl">{icon}</div>
        <div>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
        </div>
    </div>
);

export const SummaryMetrics: React.FC<SummaryMetricsProps> = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="w-full max-w-6xl mx-auto mb-12">
      <h2 className="text-2xl font-bold text-slate-100 mb-6 text-center">Crawl Summary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <MetricCard title="Total Pages" value={summary.totalPages} icon={<span className="text-cyan-400">📄</span>} colorClass="border-cyan-500" />
        <MetricCard title="Healthy" value={summary.healthyPages} icon={<CheckCircleIcon className="text-green-400"/>} colorClass="border-green-500" />
        <MetricCard title="Redirects" value={summary.redirects} icon={<ArrowCircleRightIcon className="text-blue-400"/>} colorClass="border-blue-500" />
        <MetricCard title="Client Errors" value={summary.clientErrors} icon={<ExclamationCircleIcon className="text-yellow-400"/>} colorClass="border-yellow-500" />
        <MetricCard title="Server Errors" value={summary.serverErrors} icon={<ExclamationCircleIcon className="text-red-400"/>} colorClass="border-red-500" />
      </div>
    </div>
  );
};
