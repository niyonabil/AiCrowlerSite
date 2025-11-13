import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { SpinnerIcon } from './icons';
import { Settings } from '../types';
import { decrypt } from '../services/crypto';

interface RegisterPageProps {
  onRegisterSuccess: () => void;
  onNavigateToLogin: () => void;
  settings: Settings | null;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onRegisterSuccess, onNavigateToLogin, settings }) => {
    const [name, setName] = useState('');
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
        console.error("Google Sign-Up Error:", error);
        if (error?.type === 'popup_closed' || error?.type === 'user_cancel') {
            setGoogleLoading(false);
            return;
        }

        let message = `An error occurred during Google Sign-Up.`;
        if (error?.details?.includes('invalid_client') || error?.details?.includes('origin_mismatch')) {
            message = `Google Sign-Up Failed: This is likely a configuration issue. The application's URL (${window.location.origin}) may need to be added to the "Authorized JavaScript origins" in the Google Cloud project settings.`;
        } else {
            message = `Google Sign-Up Failed: ${error.details || error.type || 'Unknown error'}`;
        }
        setError(message);
        setGoogleLoading(false);
    }, [setGoogleLoading, setError]);

    const handleCredentialResponse = useCallback(async (response: any) => {
        setGoogleLoading(true);
        setError('');
        const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
        });

        if (error) {
             let detailedError = `Google Sign-Up Failed: ${error.message}`;
            if (error.message.includes('ID token')) {
                 detailedError += "\nThis can be caused by a misconfigured Google Client ID in the app's admin settings."
            }
            setError(detailedError);
        }
        setGoogleLoading(false);
    }, []);

    useEffect(() => {
        if (!googleClientId || !window.google?.accounts?.id) return;
        
        window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleCredentialResponse,
            error_callback: handleGoogleError,
        });

        const signUpButton = document.getElementById("googleSignUpButton");
        if(signUpButton) {
            window.google.accounts.id.renderButton(
                signUpButton,
                { theme: "outline", size: "large", type: 'standard', text: 'signup_with', width: '320' }
            );
        }
    }, [googleClientId, handleCredentialResponse, handleGoogleError]);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
                data: {
                    name: name.trim(),
                    // A default SVG picture is used, which can be overridden by Google's picture
                    picture: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#94a3b8"><path fill-rule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clip-rule="evenodd" /></svg>')}`,
                }
            }
        });
        if (error) setError(error.message);
        else if (data.user) {
            alert('Registration successful! Please check your email to confirm your account and then log in.');
            onRegisterSuccess();
        }
        setLoading(false);
    };
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
                        Create an Account
                    </h1>
                    <p className="text-slate-400 mt-2">Join AI Auditor Pro</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg shadow-lg p-8">
                     <div className="flex justify-center h-[40px] items-center">
                        {googleLoading ? (
                            <SpinnerIcon className="w-8 h-8 animate-spin" />
                        ) : googleClientId ? (
                            <div id="googleSignUpButton"></div>
                        ) : (
                            <div className="w-full text-center p-2 rounded-md bg-slate-700/50 text-slate-400 text-sm">
                                Google Sign-Up is not configured by the administrator.
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
                            <label htmlFor="name" className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
                            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-700 text-slate-200 border border-slate-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500" required autoFocus disabled={loading || googleLoading} />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-2">Email Address</label>
                            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-700 text-slate-200 border border-slate-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500" required disabled={loading || googleLoading} />
                        </div>
                        <div className="mb-6">
                            <label htmlFor="password" className="block text-sm font-medium text-slate-400 mb-2">Password</label>
                            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-700 text-slate-200 border border-slate-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="6+ characters" required disabled={loading || googleLoading} />
                        </div>
                        {error && <p className="text-red-400 text-center text-sm mb-4 whitespace-pre-wrap">{error}</p>}
                        <div>
                            <button type="submit" disabled={loading || googleLoading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-slate-600">
                                {loading ? 'Creating Account...' : 'Sign Up with Email'}
                            </button>
                        </div>
                    </form>
                    <p className="text-center text-sm text-slate-400 mt-6">
                        Already have an account?{' '}
                        <button onClick={onNavigateToLogin} className="font-medium text-cyan-400 hover:underline">
                            Sign in
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};