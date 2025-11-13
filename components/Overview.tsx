import React, { useState, useEffect } from 'react';
import { UserProfile, CrawlSummary, Settings } from '../types';
import { AdSenseBlock } from './AdSenseBlock';
import { supabase } from '../services/supabase';

type DashboardPage = 'overview' | 'audit' | 'agents' | 'billing' | 'settings';

interface OverviewProps {
    user: UserProfile;
    setCurrentPage: (page: DashboardPage) => void;
}

const Chart: React.FC<{ data: CrawlSummary | null }> = ({ data }) => {
    if (!data || data.totalPages === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-slate-800/50 rounded-lg">
                <p className="text-slate-500">No audit data available to display.</p>
            </div>
        );
    }

    const chartData = [
        { label: 'Healthy', value: data.healthyPages, color: 'bg-green-500' },
        { label: 'Redirects', value: data.redirects, color: 'bg-blue-500' },
        { label: 'Client Errors', value: data.clientErrors, color: 'bg-yellow-500' },
        { label: 'Server Errors', value: data.serverErrors, color: 'bg-red-500' },
    ];

    const maxValue = Math.max(...chartData.map(d => d.value), 1);

    return (
        <div className="bg-slate-800/50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Pages by Status</h3>
            <div className="space-y-4">
                {chartData.map(item => (
                    <div key={item.label} className="grid grid-cols-4 gap-4 items-center">
                        <span className="text-sm text-slate-400 col-span-1">{item.label}</span>
                        <div className="col-span-3 flex items-center">
                            <div className="w-full bg-slate-700 rounded-full h-4 mr-4">
                                <div
                                    className={`${item.color} h-4 rounded-full`}
                                    style={{ width: `${(item.value / maxValue) * 100}%` }}
                                ></div>
                            </div>
                            <span className="font-semibold text-slate-200">{item.value}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const Overview: React.FC<OverviewProps> = ({ user, setCurrentPage }) => {
    const [lastSummary, setLastSummary] = useState<CrawlSummary | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);

    useEffect(() => {
        const fetchLastSummary = async () => {
            const { data, error } = await supabase
                .from('audit_results')
                .select('crawl_summary')
                .eq('user_id', user.id)
                .not('crawl_summary', 'is', null)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();
            
            if (data && data.crawl_summary) {
                setLastSummary(data.crawl_summary);
            }
             if (error && error.code !== 'PGRST116') { // Ignore "exact one row was not found"
                console.error("Error fetching last summary:", error);
            }
        };

        const fetchSettings = async () => {
            const { data } = await supabase.from('settings').select('*').limit(1).single();
            if(data) setSettings(data);
        };

        fetchLastSummary();
        fetchSettings();
    }, [user.id]);
    
    return (
        <div>
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-100">Overview</h1>
                <p className="mt-2 text-lg text-slate-400">Welcome back, {user.name.split(' ')[0]}!</p>
            </header>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <Chart data={lastSummary} />
                </div>
                <div className="bg-slate-800/50 p-6 rounded-lg">
                     <h3 className="text-lg font-semibold text-slate-200 mb-4">Subscription Plan</h3>
                     <div className="space-y-2">
                        <p className="text-slate-300">Your current plan: <span className="font-bold text-cyan-400 capitalize">{user.plan}</span></p>
                        {user.plan_expiry && (
                            <p className="text-slate-400 text-sm">Renews on: {new Date(user.plan_expiry).toLocaleDateString()}</p>
                        )}
                        <button 
                            onClick={() => setCurrentPage('billing')}
                            className="w-full mt-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md transition-colors">
                            Manage Subscription
                        </button>
                     </div>
                </div>
            </div>
             {user.role !== 'admin' && settings?.adsense_script && (
                <div className="mt-8">
                    <AdSenseBlock script={settings.adsense_script} />
                </div>
             )}
        </div>
    );
};