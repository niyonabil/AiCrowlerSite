import React from 'react';
import { SearchIcon, CpuChipIcon, FileTextIcon } from './icons';

interface LandingPageProps {
  onNavigateToAuth: () => void;
  onNavigateToBlog: () => void;
}

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
        <div className="flex items-center mb-3">
            <div className="p-2 bg-slate-700 rounded-full mr-4 text-cyan-400">{icon}</div>
            <h3 className="text-xl font-bold text-slate-100">{title}</h3>
        </div>
        <p className="text-slate-400">{children}</p>
    </div>
);

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToAuth, onNavigateToBlog }) => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-200">
            <header className="container mx-auto px-6 py-4 flex justify-between items-center">
                 <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
                    AI Auditor Pro
                </h1>
                <nav className="space-x-6 flex items-center">
                    <button onClick={onNavigateToBlog} className="text-slate-300 hover:text-white transition-colors">Blog</button>
                    <button onClick={onNavigateToAuth} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-5 rounded-full transition-colors">
                        Sign In
                    </button>
                </nav>
            </header>

            <main className="container mx-auto px-6 py-20 text-center">
                <h2 className="text-4xl md:text-6xl font-extrabold text-slate-100 leading-tight">
                    The Future of SEO Auditing is Here.
                </h2>
                <p className="mt-4 text-lg md:text-xl text-slate-400 max-w-3xl mx-auto">
                    Leverage the power of cutting-edge AI to perform comprehensive site audits, uncover critical issues, and optimize your website for peak performance.
                </p>
                <button 
                    onClick={onNavigateToAuth}
                    className="mt-8 bg-gradient-to-r from-cyan-500 to-teal-500 hover:opacity-90 text-white font-bold py-4 px-10 rounded-full text-lg transition-opacity"
                >
                    Get Started for Free
                </button>
            </main>

            <section className="container mx-auto px-6 py-16">
                 <div className="grid md:grid-cols-3 gap-8">
                    <FeatureCard icon={<SearchIcon className="w-6 h-6"/>} title="Deep Site Crawl">
                        Our AI-powered crawler navigates your site like a search engine, analyzing every page for status, metadata, and link health.
                    </FeatureCard>
                     <FeatureCard icon={<CpuChipIcon className="w-6 h-6"/>} title="AI-Powered Analysis">
                        Go beyond simple checks. Our custom AI agents analyze page content, sitemaps, and technical files to provide actionable insights.
                    </FeatureCard>
                     <FeatureCard icon={<FileTextIcon className="w-6 h-6"/>} title="Comprehensive Reports">
                        Visualize your site's health with clear summaries and detailed, exportable reports on every URL, sitemap entry, and directive.
                    </FeatureCard>
                 </div>
            </section>
             <footer className="text-center py-8 text-slate-500 border-t border-slate-800">
                <p>&copy; 2024 AI Auditor Pro. All rights reserved.</p>
            </footer>
        </div>
    );
};