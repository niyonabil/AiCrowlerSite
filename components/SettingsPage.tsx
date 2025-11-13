

import React, { useState, useEffect } from 'react';
import { UserProfile, ApiKeys, Settings } from '../types';
import { encrypt, decrypt } from '../services/crypto';
import { supabase } from '../services/supabase';

type DashboardPage = 'overview' | 'audit' | 'agents' | 'billing' | 'settings' | 'blog' | 'users';

interface SettingsPageProps {
    user: UserProfile;
    onUpdateUser: (updatedUserData: Partial<UserProfile>) => void;
    setCurrentPage: (page: DashboardPage) => void;
}

const SettingsCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg">
        <header className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        </header>
        <div className="p-6">
            {children}
        </div>
    </div>
);

const emptyApiKeys: ApiKeys = { 
    gemini: '', openAI: '', openRouter: '', googleIndexing: '', indexNow: '', googleClientId: '',
    stripePublicKey: '', stripeSecretKey: '', paypalClientId: '', paypalClientSecret: ''
};

export const SettingsPage: React.FC<SettingsPageProps> = ({ user, onUpdateUser, setCurrentPage }) => {
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    
    const [apiKeys, setApiKeys] = useState<ApiKeys>(() => {
        const storedKeys = user.api_keys || emptyApiKeys;
        const decryptedKeys = Object.fromEntries(
            Object.entries(storedKeys).map(([key, value]) => [key, decrypt(value as string)])
        ) as unknown as ApiKeys;
        return { ...emptyApiKeys, ...decryptedKeys };
    });
    
    const [settings, setSettings] = useState<Settings | null>(null);
    const [defaultApiKeys, setDefaultApiKeys] = useState<ApiKeys>(emptyApiKeys);
    const [adsenseScript, setAdsenseScript] = useState('');
    const [bankDetails, setBankDetails] = useState('');
    
    useEffect(() => {
        const fetchSettings = async () => {
            const { data, error } = await supabase.from('settings').select('*').limit(1).single();
            if (error) console.error("Error fetching settings:", error);
            else if (data) {
                setSettings(data);
                const storedKeys = data.default_api_keys || emptyApiKeys;
                const decryptedDefaults = Object.fromEntries(
                    Object.entries(storedKeys).map(([key, value]) => [key, decrypt(value as string)])
                ) as unknown as ApiKeys;
                setDefaultApiKeys({ ...emptyApiKeys, ...decryptedDefaults });
                setAdsenseScript(data.adsense_script || '');
                setBankDetails(data.bank_details || '');
            }
        };

        if (user.role === 'admin') {
            fetchSettings();
        }
    }, [user.role]);

    const [profileSaveStatus, setProfileSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [apiKeysSaveStatus, setApiKeysSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [defaultSaveStatus, setDefaultSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileSaveStatus('saving');
        try {
            await onUpdateUser({ name, email });
            setProfileSaveStatus('saved');
            setTimeout(() => setProfileSaveStatus('idle'), 2500);
        } catch (error) {
            console.error("Failed to save profile:", error);
            alert("Error saving profile. Please try again.");
            setProfileSaveStatus('idle');
        }
    };
    
    const handleApiKeysSave = async () => {
        setApiKeysSaveStatus('saving');
        try {
            const encryptedApiKeys = Object.fromEntries(
                Object.entries(apiKeys).map(([key, value]) => [key, encrypt(value as string)])
            ) as unknown as ApiKeys;
            await onUpdateUser({ api_keys: encryptedApiKeys });
            setApiKeysSaveStatus('saved');
            setTimeout(() => setApiKeysSaveStatus('idle'), 2500);
        } catch (error) {
            console.error("Failed to save API keys:", error);
            alert("Error saving API keys. Please try again.");
            setApiKeysSaveStatus('idle');
        }
    };
    
    const handleAdminSettingsSave = async () => {
        if (!settings) return;
        setDefaultSaveStatus('saving');
        const encryptedDefaultApiKeys = Object.fromEntries(
            Object.entries(defaultApiKeys).map(([key, value]) => [key, encrypt(value as string)])
        ) as unknown as ApiKeys;
        
        const { error } = await supabase.from('settings').update({
            default_api_keys: encryptedDefaultApiKeys,
            adsense_script: adsenseScript,
            bank_details: bankDetails,
        }).eq('id', settings.id!);

        if (error) {
            console.error("Failed to save admin settings:", error);
            alert("Error saving settings.");
            setDefaultSaveStatus('idle');
        } else {
            setDefaultSaveStatus('saved');
            setTimeout(() => setDefaultSaveStatus('idle'), 2500);
        }
    };
    
    return (
        <div>
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-100">Settings</h1>
                <p className="mt-2 text-lg text-slate-400">Manage your account and preferences.</p>
            </header>

            <div className="space-y-8">
                <SettingsCard title="Profile">
                    <form onSubmit={handleProfileSave} className="space-y-4 max-w-md">
                         <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
                            <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600 focus:ring-cyan-500 focus:border-cyan-500" />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-2">Email Address</label>
                            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600 focus:ring-cyan-500 focus:border-cyan-500" />
                        </div>
                         <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md transition-colors w-28">
                            {profileSaveStatus === 'saving' ? 'Saving...' : profileSaveStatus === 'saved' ? 'Saved!' : 'Save'}
                         </button>
                    </form>
                </SettingsCard>
                
                <SettingsCard title="Your Personal API Keys & Integrations">
                    <p className="text-slate-400 mb-4 text-sm">Your personal API keys will always be used first. They are stored securely and encrypted in the database.</p>
                     <div className="max-w-md space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2">AI Providers</label>
                            <input type="password" placeholder="Enter your Gemini key" value={apiKeys.gemini} onChange={(e) => setApiKeys(k => ({...k, gemini: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600 focus:ring-cyan-500 focus:border-cyan-500" />
                            <input type="password" placeholder="Enter your OpenAI key" value={apiKeys.openAI} onChange={(e) => setApiKeys(k => ({...k, openAI: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600 focus:ring-cyan-500 focus:border-cyan-500 mt-2" />
                            <input type="password" placeholder="Enter your OpenRouter key" value={apiKeys.openRouter} onChange={(e) => setApiKeys(k => ({...k, openRouter: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600 focus:ring-cyan-500 focus:border-cyan-500 mt-2" />
                        </div>
                         <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2">Indexing Services</label>
                            <input type="text" placeholder="Enter your Google OAuth Client ID" value={apiKeys.googleClientId} onChange={(e) => setApiKeys(k => ({...k, googleClientId: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600 focus:ring-cyan-500 focus:border-cyan-500" />
                            <input type="password" placeholder="Enter your IndexNow key" value={apiKeys.indexNow} onChange={(e) => setApiKeys(k => ({...k, indexNow: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600 focus:ring-cyan-500 focus:border-cyan-500 mt-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-300 mb-2">Payment Gateways (Test/Sandbox Keys Recommended)</label>
                             <input type="text" placeholder="Enter your Stripe Public Key" value={apiKeys.stripePublicKey} onChange={(e) => setApiKeys(k => ({...k, stripePublicKey: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600 focus:ring-cyan-500 focus:border-cyan-500" />
                             <input type="password" placeholder="Enter your Stripe Secret Key" value={apiKeys.stripeSecretKey} onChange={(e) => setApiKeys(k => ({...k, stripeSecretKey: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600 focus:ring-cyan-500 focus:border-cyan-500 mt-2" />
                             <input type="text" placeholder="Enter your PayPal Client ID" value={apiKeys.paypalClientId} onChange={(e) => setApiKeys(k => ({...k, paypalClientId: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600 focus:ring-cyan-500 focus:border-cyan-500 mt-2" />
                        </div>

                         <button type="button" onClick={handleApiKeysSave} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md transition-colors w-28">
                             {apiKeysSaveStatus === 'saving' ? 'Saving...' : apiKeysSaveStatus === 'saved' ? 'Saved!' : 'Save'}
                         </button>
                    </div>
                </SettingsCard>
                
                {user.role === 'admin' && (
                    <SettingsCard title="Admin Settings">
                        <div className="max-w-md space-y-6">
                             <div>
                                <h3 className="text-md font-semibold text-slate-300 mb-2">Default API Keys (For All Users)</h3>
                                <p className="text-slate-400 mb-4 text-sm">These are fallback keys. If a user doesn't provide their own key, the application will use these. Users on an expired trial cannot use these keys.</p>
                                <div className="space-y-2">
                                     <input type="password" placeholder="Default Gemini key" value={defaultApiKeys.gemini} onChange={(e) => setDefaultApiKeys(k => ({...k, gemini: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600" />
                                     <input type="password" placeholder="Default OpenAI key" value={defaultApiKeys.openAI} onChange={(e) => setDefaultApiKeys(k => ({...k, openAI: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600" />
                                     <input type="password" placeholder="Default OpenRouter key" value={defaultApiKeys.openRouter} onChange={(e) => setDefaultApiKeys(k => ({...k, openRouter: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600" />
                                     <input type="text" placeholder="Default Google Client ID (for Login)" value={defaultApiKeys.googleClientId} onChange={(e) => setDefaultApiKeys(k => ({...k, googleClientId: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600" />
                                     <input type="password" placeholder="Default Stripe Secret Key" value={defaultApiKeys.stripeSecretKey} onChange={(e) => setDefaultApiKeys(k => ({...k, stripeSecretKey: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600" />
                                     <input type="password" placeholder="Default PayPal Client Secret" value={defaultApiKeys.paypalClientSecret} onChange={(e) => setDefaultApiKeys(k => ({...k, paypalClientSecret: e.target.value}))} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600" />
                                </div>
                            </div>

                             <div className="pt-6 border-t border-slate-700">
                                <h3 className="text-md font-semibold text-slate-300 mb-2">Monetization & Payments</h3>
                                <label htmlFor="adsenseScript" className="block text-sm font-medium text-slate-400 mb-1">Google AdSense Script Tag</label>
                                <textarea id="adsenseScript" placeholder="<script async src=...></script>" value={adsenseScript} onChange={(e) => setAdsenseScript(e.target.value)} rows={3} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600 font-mono text-xs"></textarea>
                                
                                <label htmlFor="bankDetails" className="block text-sm font-medium text-slate-400 mb-1 mt-2">Bank Transfer Details</label>
                                <textarea id="bankDetails" placeholder="Bank Name:&#10;IBAN:&#10;BIC/SWIFT:" value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} rows={4} className="w-full bg-slate-700 rounded-md p-2 border border-slate-600"></textarea>
                            </div>

                            <button type="button" onClick={handleAdminSettingsSave} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md transition-colors w-28">
                                {defaultSaveStatus === 'saving' ? 'Saving...' : defaultSaveStatus === 'saved' ? 'Saved!' : 'Save All'}
                            </button>
                        </div>
                    </SettingsCard>
                )}

                 <SettingsCard title="Subscription & Billing">
                    <div className="flex justify-between items-center">
                        <div>
                             <p className="text-slate-300">Your current plan: <span className="font-bold text-cyan-400 capitalize">{user.plan}</span></p>
                             <p className="text-slate-400 text-sm">Manage your plan, payment methods, and view invoices.</p>
                        </div>
                        <button onClick={() => setCurrentPage('billing')} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                            Go to Billing
                        </button>
                    </div>
                </SettingsCard>
            </div>
        </div>
    );
};