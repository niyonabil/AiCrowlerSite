import React, { useState, useEffect } from 'react';
import { UserProfile, Post, Settings } from '../types';
import { AuthPage } from './AuthPage';
import { LandingPage } from './LandingPage';
import { BlogIndexPage } from './BlogIndexPage';
import { BlogPostPage } from './BlogPostPage';
import { AdSenseBlock } from './AdSenseBlock';
import { supabase } from '../services/supabase';

type ViewState = 
    | { page: 'landing' }
    | { page: 'auth' }
    | { page: 'blogIndex' }
    | { page: 'blogPost', slug: string };

export const PublicPages: React.FC = () => {
    const [view, setView] = useState<ViewState>({ page: 'landing' });
    const [settings, setSettings] = useState<Settings | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
             // FIX: Use .maybeSingle() to gracefully handle cases where the settings table is empty.
             // This prevents an error on public pages before an admin has logged in for the first time.
             const { data, error } = await supabase.from('settings').select('*').maybeSingle();
             if (error) {
                // maybeSingle() only errors if multiple rows are found, which is a valid issue to log.
                console.error("Error fetching public settings:", error);
             } else {
                setSettings(data);
             }
        };
        fetchSettings();
    }, []);

    // Basic hash-based routing
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.slice(1);
            if (hash.startsWith('/blog/')) {
                setView({ page: 'blogPost', slug: hash.substring(6) });
            } else if (hash === '/blog') {
                setView({ page: 'blogIndex' });
            } else if (hash === '/auth') {
                setView({ page: 'auth' });
            } else {
                setView({ page: 'landing' });
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        handleHashChange(); // Initial check

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);
    
    const navigate = (path: string) => {
        window.location.hash = path;
    };

    const renderView = () => {
        switch (view.page) {
            case 'landing':
                return <LandingPage onNavigateToAuth={() => navigate('/auth')} onNavigateToBlog={() => navigate('/blog')} />;
            case 'auth':
                // FIX: Removed incorrect onNavigateToRegister prop, as AuthPage handles its own view switching.
                return <AuthPage settings={settings} />;
            case 'blogIndex':
                return <BlogIndexPage onPostSelect={(slug) => navigate(`/blog/${slug}`)} onNavigateHome={() => navigate('/')} />;
            case 'blogPost':
                return <BlogPostPage slug={view.slug} onNavigateToBlog={() => navigate('/blog')} />;
            default:
                 return <LandingPage onNavigateToAuth={() => navigate('/auth')} onNavigateToBlog={() => navigate('/blog')} />;
        }
    };

    return (
        <div>
            {renderView()}
            {settings?.adsense_script && view.page.startsWith('blog') && (
                <div className="container mx-auto px-6">
                    <AdSenseBlock script={settings.adsense_script} />
                </div>
            )}
        </div>
    );
};