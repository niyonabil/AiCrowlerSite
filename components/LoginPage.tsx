import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { SpinnerIcon } from './icons';
import { Settings } from '../types';
import { decrypt } from '../services/crypto';

interface LoginPageProps {
  onNavigateToRegister: () => void;
  settings: Settings | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToRegister, settings }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleClientId, setGoogleClientId] = useState<string | null>(null);

    useEffect(() => {
        if (settings?.default_api_keys?.googleClientId) {
            const clientId = decrypt(settings.default_api_keys.googleClientId);
            setGoogleClientId(clientId);
        }
    }, [settings]);

    const handleGoogleError = useCallback((error: any) => {
        console.error("Google Sign-In Error:", error);
        // Don't show an error if the user closes the popup.
        if (error?.type === 'popup_closed' || error?.type === 'user_cancel') {
            setGoogleLoading(false);
            return; 
        }

        let message = `An error occurred during Google Sign-In.`;
        // Check for specific error details pointing to configuration issues.
        if (error?.details?.includes('invalid_client') || error?.details?.includes('origin_mismatch')) {
            message = `Google Sign-In Failed: This is likely a configuration issue. The application's URL (${window.location.origin}) may need to be added to the "Authorized JavaScript origins" in the Google Cloud project settings.`;
        } else {
            message = `Google Sign-In Failed: ${error.details || error.type || 'Unknown error'}`;
        }
        setError(message);
        setGoogleLoading(false);
    }, [setGoogleLoading, setError]);

    const handleCredentialResponse = useCallback(async (response: any /* google.CredentialResponse */) => {
        setGoogleLoading(true);
        setError('');
        const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
        });

        if (error) {
            let detailedError = `Google Sign-In Failed: ${error.message}`;
            if (error.message.includes('ID token')) {
                 detailedError += "\nThis can be caused by a misconfigured Google Client ID in the app's admin settings."
            }
            setError(detailedError);
        }
        // On success, the onAuthStateChange listener in App.tsx will handle the state change.
        setGoogleLoading(false);
    }, []);

    useEffect(() => {
        if (!googleClientId || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleCredentialResponse,
            error_callback: handleGoogleError,
        });
        
        const signInButton = document.getElementById("googleSignInButton");
        if(signInButton) {
            window.google.accounts.id.renderButton(
                signInButton,
                { theme: "outline", size: "large", type: 'standard', text: 'signin_with', width: '320' }
            );
        }

    }, [googleClientId, handleCredentialResponse, handleGoogleError]);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password,
        });
        if (error) setError(error.message);
        setLoading(false);
    };
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
                        AI Auditor Pro
                    </h1>
                    <p className="text-slate-400 mt-2">Sign in to your account</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg shadow-lg p-8">
                    <div className="flex justify-center h-[40px] items-center">
                        {googleLoading ? (
                            <SpinnerIcon className="w-8 h-8 animate-spin" />
                        ) : googleClientId ? (
                            <div id="googleSignInButton"></div>
                        ) : (
                            <div className="w-full text-center p-2 rounded-md bg-slate-700/50 text-slate-400 text-sm">
                                Google Sign-In is not configured by the administrator.
                            </div>
                        )}
                    </div>
                    
                    <div className="my-6 flex items-center">
                        <div className="flex-grow border-t border-slate-700"></div>
                        <span className="flex-shrink mx-4 text-slate-500 text-sm">OR</span>
                        <div className="flex-grow border-t border-slate-700"></div>
                    </div>

                    <form onSubmit={handleEmailSubmit}>
                        <div className="mb-4">
                            <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-2">Email</label>
                            <input
                                id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-700 text-slate-200 border border-slate-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                required autoFocus disabled={loading || googleLoading}
                            />
                        </div>
                        <div className="mb-6">
                            <label htmlFor="password" className="block text-sm font-medium text-slate-400 mb-2">Password</label>
                            <input
                                id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-700 text-slate-200 border border-slate-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                required disabled={loading || googleLoading}
                            />
                        </div>
                        {error && <p className="text-red-400 text-center text-sm mb-4 whitespace-pre-wrap">{error}</p>}
                        <div>
                            <button
                                type="submit" disabled={loading || googleLoading}
                                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-slate-600"
                            >
                                {loading ? 'Signing In...' : 'Sign In with Email'}
                            </button>
                        </div>
                    </form>
                    <p className="text-center text-sm text-slate-400 mt-6">
                        Don't have an account?{' '}
                        <button onClick={onNavigateToRegister} className="font-medium text-cyan-400 hover:underline">
                            Sign up
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};