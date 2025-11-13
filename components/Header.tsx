import React from 'react';
import { User } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
    user: User;
    onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
    const { t } = useTranslation();

    return (
        <header className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-10 backdrop-blur-md">
            <div className="container mx-auto px-4 sm:px-8 py-3 flex justify-between items-center">
                <div className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
                    AI Site Auditor
                </div>
                <div className="flex items-center space-x-4">
                    <LanguageSwitcher />
                    <div className="flex items-center space-x-3 bg-slate-700/50 rounded-full p-1 pr-3">
                        <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />
                        <span className="text-sm font-medium text-slate-200 hidden sm:inline">{user.name}</span>
                    </div>
                    <button 
                        onClick={onLogout}
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        {t('logout')}
                    </button>
                </div>
            </div>
        </header>
    );
};