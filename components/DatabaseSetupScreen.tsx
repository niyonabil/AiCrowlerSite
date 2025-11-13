
import React, { useState } from 'react';
import { ExclamationCircleIcon } from './icons';
import { DATABASE_SETUP_SCRIPT } from '../services/supabase';

export const DatabaseSetupScreen: React.FC = () => {
    const [copySuccess, setCopySuccess] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(DATABASE_SETUP_SCRIPT.trim());
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-4">
            <div className="bg-slate-800 p-8 rounded-lg border border-cyan-500/50 max-w-4xl w-full">
                <div className="text-center">
                    <ExclamationCircleIcon className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-cyan-400">One-Time Database Setup Required</h1>
                    <p className="mt-4 text-slate-300">
                        Welcome! Before you can use the application, your Supabase database needs to be initialized.
                    </p>
                </div>

                <div className="mt-8 text-left space-y-4 text-slate-300">
                    <p><strong className="text-white">Step 1:</strong> Go to your Supabase project dashboard.</p>
                    <p><strong className="text-white">Step 2:</strong> Navigate to the <strong className="text-cyan-400">SQL Editor</strong> section.</p>
                    <p><strong className="text-white">Step 3:</strong> Click <strong className="text-cyan-400">"+ New query"</strong>.</p>
                    <p><strong className="text-white">Step 4:</strong> Copy the full SQL script below and paste it into the editor.</p>
                    <p><strong className="text-white">Step 5:</strong> Click <strong className="text-green-400">RUN</strong>.</p>
                    <p><strong className="text-white">Step 6:</strong> After the script finishes successfully, <strong className="text-cyan-400">refresh this page</strong>.</p>
                </div>
                
                <div className="mt-6 relative">
                    <textarea
                        readOnly
                        value={DATABASE_SETUP_SCRIPT.trim()}
                        className="w-full h-64 bg-slate-900 text-slate-400 font-mono text-xs rounded-md p-4 border border-slate-700 focus:outline-none"
                    />
                    <button
                        onClick={handleCopy}
                        className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-1 px-3 rounded-md text-sm transition-colors"
                    >
                        {copySuccess ? 'Copied!' : 'Copy Script'}
                    </button>
                </div>

                 <div className="mt-8 text-left p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                    <h3 className="font-bold text-white mb-2">How to Create Your First Admin User</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400">
                        <li>After running the script and refreshing, sign up for a new account using the application's interface.</li>
                        <li>Confirm your email if required.</li>
                        <li>Go back to the Supabase SQL Editor and run the following command, replacing the email with your own:
                            <code className="block bg-slate-900 text-cyan-400 p-2 rounded-md my-2 text-xs">
                                UPDATE public.users SET role = 'admin' WHERE email = 'your-email@example.com';
                            </code>
                        </li>
                        <li>Log in again. You will now have admin privileges.</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};
