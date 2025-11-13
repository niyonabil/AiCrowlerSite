import React, { useState, useEffect } from 'react';
import { UserProfile, Settings } from '../types';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Overview } from './Overview';
import { SiteAuditPage } from './SiteAuditPage';
import { SettingsPage } from './SettingsPage';
import { AgentCreatorPage } from './AgentCreatorPage';
import { BillingPage } from './BillingPage';
import { UserManagementPage } from './UserManagementPage';
import { BlogManagementPage } from './BlogManagementPage';
import { AdSenseBlock } from './AdSenseBlock';
import { supabase, initializeSettings } from '../services/supabase';

type DashboardPage = 'overview' | 'audit' | 'agents' | 'billing' | 'settings' | 'users' | 'blog';

interface DashboardLayoutProps {
    user: UserProfile;
    updateUser: (updatedUserData: Partial<UserProfile>) => void;
    onLogout: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ user, updateUser, onLogout }) => {
    const [currentPage, setCurrentPage] = useState<DashboardPage>('overview');
    const [settings, setSettings] = useState<Settings | null>(null);
    
    useEffect(() => {
        const fetchSettings = async () => {
            // FIX: If the user is an admin, ensure the settings row exists before fetching.
            // This makes the application self-healing and corrects the database setup error.
            if (user.role === 'admin') {
                await initializeSettings();
            }
            const { data, error } = await supabase.from('settings').select('*').limit(1).single();
            if (error) console.error("Error fetching settings", error);
            else setSettings(data);
        };
        fetchSettings();
    }, [user.role]);
    
    const renderCurrentPage = () => {
        switch (currentPage) {
            case 'overview':
                return <Overview user={user} setCurrentPage={setCurrentPage} />;
            case 'audit':
                return <SiteAuditPage user={user} />;
            case 'agents':
                return <AgentCreatorPage user={user} />;
            case 'billing':
                return <BillingPage user={user} onUpdateUser={updateUser} />;
            case 'settings':
                return <SettingsPage user={user} onUpdateUser={updateUser} setCurrentPage={setCurrentPage} />;
            case 'users':
                return user.role === 'admin' ? <UserManagementPage /> : <Overview user={user} setCurrentPage={setCurrentPage} />;
            case 'blog':
                return user.role === 'admin' ? <BlogManagementPage user={user} /> : <Overview user={user} setCurrentPage={setCurrentPage} />;
            default:
                return <Overview user={user} setCurrentPage={setCurrentPage} />;
        }
    };

    return (
        <div className="flex h-screen bg-slate-900 text-slate-200">
            <Sidebar user={user} currentPage={currentPage} setCurrentPage={setCurrentPage} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header user={user} onLogout={onLogout} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-800/50 p-4 sm:p-8">
                    <div className="container mx-auto">
                        {renderCurrentPage()}
                        {user.role !== 'admin' && settings?.adsense_script && (
                           <AdSenseBlock script={settings.adsense_script} />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};
