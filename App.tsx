
import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile } from './types';
import { DashboardLayout } from './components/DashboardLayout';
import { SpinnerIcon, ExclamationCircleIcon } from './components/icons';
import { PublicPages } from './components/PublicPages';
import { supabase, isSupabaseConfigured, checkDatabaseHealth } from './services/supabase';
import { DatabaseSetupScreen } from './components/DatabaseSetupScreen';
import { AuthSession } from '@supabase/supabase-js';

type AppStatus = 'configuring' | 'initializing' | 'db_uninitialized' | 'init_failed' | 'ready';

function App() {
    const [appStatus, setAppStatus] = useState<AppStatus>('initializing');
    const [session, setSession] = useState<AuthSession | null>(null);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [initError, setInitError] = useState<string | null>(null);

    // This screen is shown if the developer hasn't configured the supabase.ts file.
    if (!isSupabaseConfigured()) {
        return (
            <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-4">
                <div className="text-center bg-slate-800 p-8 rounded-lg border border-red-500/50 max-w-lg">
                    <ExclamationCircleIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-red-400">Configuration Required</h1>
                    <p className="mt-4 text-slate-300">
                        This application requires a connection to a Supabase project to function.
                    </p>
                    <p className="mt-2 text-slate-400">
                        Please edit the file <code className="bg-slate-900 text-cyan-400 px-2 py-1 rounded-md text-sm">services/supabase.ts</code> and replace the placeholder values for <code className="bg-slate-900 text-cyan-400 px-2 py-1 rounded-md text-sm">supabaseUrl</code> and <code className="bg-slate-900 text-cyan-400 px-2 py-1 rounded-md text-sm">supabaseAnonKey</code> with your project's credentials.
                    </p>
                </div>
            </div>
        );
    }

    const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
        const maxRetries = 5;
        const delay = 500;
        for (let i = 0; i < maxRetries; i++) {
            const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
            if (data) return data as UserProfile;
            
            // If the error is anything other than 'row not found', throw immediately.
            if (error && error.code !== 'PGRST116') {
                 console.error("Error fetching user profile:", error);
                 throw error;
            }
            
            // If it's 'row not found', wait and retry.
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1) ));
            } else {
                console.error("Profile not found after multiple retries.");
                throw error || new Error("Profile not found after multiple retries.");
            }
        }
        return null; // Should be unreachable
    }, []);

    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Step 1: Check if the database tables exist.
                const dbStatus = await checkDatabaseHealth();
                if (dbStatus === 'uninitialized') {
                    setAppStatus('db_uninitialized');
                    return;
                }

                // Step 2: If DB is healthy, check for an active user session.
                const { data: { session } } = await supabase.auth.getSession();
                setSession(session);
                if (session?.user) {
                    const profile = await fetchUserProfile(session.user.id);
                    setCurrentUser(profile);
                }
                setAppStatus('ready'); // Success case
            } catch (error) {
                console.error("Critical error during initial session check:", error);
                setInitError(error instanceof Error ? error.message : "An unknown error occurred during initialization.");
                setAppStatus('init_failed'); // Failure case
            }
        };

        if (appStatus === 'initializing') {
            initializeApp();
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session);
                if (session?.user) {
                    try {
                        const profile = await fetchUserProfile(session.user.id);
                        setCurrentUser(profile);
                    } catch (error) {
                        console.error("Error fetching profile on auth state change:", error);
                        setCurrentUser(null);
                    }
                } else {
                    setCurrentUser(null);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, [fetchUserProfile, appStatus]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setCurrentUser(null);
    };

    const updateUser = useCallback(async (updatedUserData: Partial<UserProfile>) => {
        if (!currentUser) throw new Error("No user is currently logged in.");
        
        const { data, error } = await supabase
            .from('users')
            .update(updatedUserData)
            .eq('id', currentUser.id)
            .select()
            .single();
            
        if (error) {
            console.error("Failed to update user:", error);
            throw error; // Re-throw the error to be caught by the caller
        }
        
        if (data) {
            setCurrentUser(data as UserProfile);
        }
    }, [currentUser]);

    if (appStatus === 'initializing') {
        return (
            <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center">
                <SpinnerIcon className="w-8 h-8 animate-spin text-cyan-400" />
                <p className="mt-4 text-slate-400">Initializing Application...</p>
            </div>
        );
    }
    
    if (appStatus === 'db_uninitialized') {
        return <DatabaseSetupScreen />;
    }

    if (appStatus === 'init_failed') {
        return (
            <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-4">
                <div className="text-center bg-slate-800 p-8 rounded-lg border border-red-500/50 max-w-lg">
                    <ExclamationCircleIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-red-400">Application Failed to Start</h1>
                    <p className="mt-4 text-slate-300">
                        There was a problem initializing the application. This could be due to a network issue or a problem with the backend services.
                    </p>
                    {initError && <p className="mt-2 text-slate-400 bg-slate-900 p-2 rounded-md font-mono text-sm">{initError}</p>}
                    <button
                        onClick={() => setAppStatus('initializing')}
                        className="mt-6 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-6 rounded-md transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-slate-900 text-slate-200">
            {session && currentUser ? (
                <DashboardLayout user={currentUser} updateUser={updateUser} onLogout={handleLogout} />
            ) : (
                <PublicPages />
            )}
        </div>
    );
}

export default App;
