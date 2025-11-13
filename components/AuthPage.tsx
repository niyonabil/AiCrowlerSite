import React, { useState } from 'react';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { Settings } from '../types';

interface AuthPageProps {
    settings: Settings | null;
}

export const AuthPage: React.FC<AuthPageProps> = ({ settings }) => {
    const [view, setView] = useState<'login' | 'register'>('login');

    const navigateToRegister = () => setView('register');
    const navigateToLogin = () => setView('login');

    if (view === 'register') {
        return <RegisterPage settings={settings} onRegisterSuccess={navigateToLogin} onNavigateToLogin={navigateToLogin} />;
    }

    return <LoginPage settings={settings} onNavigateToRegister={navigateToRegister} />;
};