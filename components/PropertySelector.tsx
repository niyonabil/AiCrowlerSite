import React, { useState } from 'react';
import { Property, User } from '../types';
import { PlusIcon, GoogleIcon, SpinnerIcon } from './icons';
import { initAndGetSites } from '../services/googleService';


interface PropertySelectorProps {
    properties: Property[];
    user: User;
    onAddProperties: (urls: string[]) => void;
    onSelectProperty: (property: Property) => void;
}

export const PropertySelector: React.FC<PropertySelectorProps> = ({ properties, user, onAddProperties, onSelectProperty }) => {
    const [newPropertyUrl, setNewPropertyUrl] = useState('');
    const [error, setError] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState('');

    const handleAddClick = () => {
        setError('');
        const trimmedUrl = newPropertyUrl.trim();
        if (!trimmedUrl) {
            setError("Please enter a website URL.");
            return;
        }

        let processedUrl = trimmedUrl;
        if (!/^(https|http):\/\//i.test(processedUrl)) {
            processedUrl = `https://${processedUrl}`;
        }

        try {
            const urlObject = new URL(processedUrl);
            if (urlObject.protocol !== "http:" && urlObject.protocol !== "https:") {
                setError('URL must use HTTP or HTTPS.');
                return;
            }
            if (!urlObject.hostname.includes('.')) {
                setError('Please enter a valid URL.');
                return;
            }
            onAddProperties([urlObject.origin]); // Store only the origin
            setNewPropertyUrl('');
        } catch (_) {
            setError('Please enter a valid URL.');
        }
    };
    
    const handleImportClick = () => {
        setIsImporting(true);
        setImportError('');
        try {
            initAndGetSites(
                // FIX: Corrected property access from `apiKeys` to `api_keys` to match the UserProfile type.
                user.api_keys.googleClientId,
                (sites) => {
                    onAddProperties(sites);
                    setIsImporting(false);
                },
                (error) => {
                    setImportError(error.message);
                    setIsImporting(false);
                }
            );
        } catch (e) {
            setImportError((e as Error).message);
            setIsImporting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <header className="text-center my-8 sm:my-12">
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-100">Your Properties</h1>
                <p className="mt-3 text-lg text-slate-400">Select a property to audit or add a new one to get started.</p>
            </header>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-8">
                <h2 className="text-xl font-bold mb-4">Add New Property</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                    {/* Add Manually */}
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
                        <h3 className="font-semibold text-slate-200 mb-3">Add Manually</h3>
                         <div className="flex items-center gap-2">
                             <input 
                                type="text"
                                value={newPropertyUrl}
                                onChange={(e) => setNewPropertyUrl(e.target.value)}
                                placeholder="https://example.com"
                                className="flex-grow bg-slate-700 text-slate-200 placeholder-slate-400 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                             />
                             <button onClick={handleAddClick} className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded-md transition-colors">
                                <PlusIcon className="w-6 h-6" />
                             </button>
                         </div>
                         {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                    </div>
                     {/* Import from GSC */}
                     <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
                        <h3 className="font-semibold text-slate-200 mb-3">Import from Google</h3>
                         <button
                             onClick={handleImportClick}
                             disabled={isImporting}
                             className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-200 p-2 rounded-md transition-colors"
                         >
                            {isImporting ? (
                                <>
                                    <SpinnerIcon className="w-5 h-5 animate-spin" />
                                    <span>Importing...</span>
                                </>
                            ) : (
                                <>
                                    <GoogleIcon className="w-6 h-6" />
                                    <span>Connect Search Console</span>
                                </>
                            )}
                         </button>
                         {importError && <p className="text-red-400 text-sm mt-2 whitespace-pre-wrap">{importError}</p>}
                    </div>
                </div>
            </div>

            <div>
                <h2 className="text-xl font-bold mb-4">Select Property</h2>
                {properties.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {properties.map(prop => (
                            <div key={prop.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 hover:border-cyan-500 hover:bg-slate-700/50 transition-all group">
                                <p className="font-semibold text-slate-200 truncate">{prop.url}</p>
                                <button onClick={() => onSelectProperty(prop)} className="mt-3 w-full bg-slate-700 group-hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                                    Audit Site
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-lg p-12">
                        <p className="text-slate-400">You haven't added any properties yet.</p>
                        <p className="text-slate-500 text-sm mt-1">Add a website above to begin your first audit.</p>
                    </div>
                )}
            </div>
        </div>
    );
};