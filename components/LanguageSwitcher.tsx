import React from 'react';
import { useTranslation } from '../contexts/LanguageContext';

export const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage } = useTranslation();

    return (
        <div className="flex items-center space-x-2 text-sm">
            <button
                onClick={() => setLanguage('en')}
                className={`font-semibold ${language === 'en' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'}`}
                aria-pressed={language === 'en'}
            >
                EN
            </button>
            <span className="text-slate-500">|</span>
            <button
                onClick={() => setLanguage('es')}
                className={`font-semibold ${language === 'es' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'}`}
                aria-pressed={language === 'es'}
            >
                ES
            </button>
            <span className="text-slate-500">|</span>
            <button
                onClick={() => setLanguage('fr')}
                className={`font-semibold ${language === 'fr' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'}`}
                aria-pressed={language === 'fr'}
            >
                FR
            </button>
        </div>
    );
};