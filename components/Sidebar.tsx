import React from 'react';
import { LayoutDashboardIcon, FileTextIcon, SettingsIcon, CpuChipIcon, CreditCardIcon, UsersIcon, DocumentTextIcon, ExternalLinkIcon } from './icons';
import { User } from '../types';
import { useTranslation } from '../contexts/LanguageContext';

type DashboardPage = 'overview' | 'audit' | 'agents' | 'billing' | 'settings' | 'users' | 'blog';

interface SidebarProps {
    user: User;
    currentPage: DashboardPage;
    setCurrentPage: (page: DashboardPage) => void;
}

const NavLink: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive?: boolean;
    onClick: () => void;
    isExternal?: boolean;
}> = ({ icon, label, isActive = false, onClick, isExternal = false }) => {
    const baseClasses = "flex items-center px-4 py-3 text-slate-300 rounded-lg transition-colors duration-200";
    const activeClasses = "bg-cyan-500/10 text-cyan-300 font-semibold";
    const inactiveClasses = "hover:bg-slate-700/50 hover:text-slate-100";

    return (
        <li>
            <a href="#" onClick={(e) => { e.preventDefault(); onClick(); }}
               className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
                <span className="mr-3">{icon}</span>
                <span className="flex-grow">{label}</span>
                {isExternal && <ExternalLinkIcon className="w-4 h-4 text-slate-500" />}
            </a>
        </li>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({ user, currentPage, setCurrentPage }) => {
    const { t } = useTranslation();
    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex-shrink-0 flex flex-col">
            <div className="h-16 flex items-center justify-center border-b border-slate-800">
                 <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
                    AI Auditor Pro
                </h1>
            </div>
            <nav className="flex-1 px-4 py-6">
                <ul className="space-y-2">
                    <NavLink
                        label={t('overview')}
                        icon={<LayoutDashboardIcon className="w-6 h-6" />}
                        isActive={currentPage === 'overview'}
                        onClick={() => setCurrentPage('overview')}
                    />
                    <NavLink
                        label={t('site_audit')}
                        icon={<FileTextIcon className="w-6 h-6" />}
                        isActive={currentPage === 'audit'}
                        onClick={() => setCurrentPage('audit')}
                    />
                     <NavLink
                        label={t('ai_agents')}
                        icon={<CpuChipIcon className="w-6 h-6" />}
                        isActive={currentPage === 'agents'}
                        onClick={() => setCurrentPage('agents')}
                    />
                    {user.role === 'admin' && (
                         <NavLink
                            label={t('blog')}
                            icon={<DocumentTextIcon className="w-6 h-6" />}
                            isActive={currentPage === 'blog'}
                            onClick={() => setCurrentPage('blog')}
                        />
                    )}
                    <NavLink
                        label={t('billing')}
                        icon={<CreditCardIcon className="w-6 h-6" />}
                        isActive={currentPage === 'billing'}
                        onClick={() => setCurrentPage('billing')}
                    />
                     <NavLink
                        label={t('settings')}
                        icon={<SettingsIcon className="w-6 h-6" />}
                        isActive={currentPage === 'settings'}
                        onClick={() => setCurrentPage('settings')}
                    />
                    {user.role === 'admin' && (
                         <NavLink
                            label={t('user_management')}
                            icon={<UsersIcon className="w-6 h-6" />}
                            isActive={currentPage === 'users'}
                            onClick={() => setCurrentPage('users')}
                        />
                    )}
                </ul>

                <hr className="my-4 border-slate-700" />
                
                 <ul className="space-y-2">
                    <NavLink
                        label={t('visit_site')}
                        icon={<ExternalLinkIcon className="w-6 h-6" />}
                        onClick={() => window.open('/', '_blank')}
                        isExternal
                    />
                    <NavLink
                        label={t('view_blog')}
                        icon={<ExternalLinkIcon className="w-6 h-6" />}
                        onClick={() => window.open('/#/blog', '_blank')}
                        isExternal
                    />
                </ul>
            </nav>
            <div className="p-4 border-t border-slate-800 text-center text-xs text-slate-500">
                <p>&copy; 2024 AI Auditor Pro</p>
                <p>Powered by Niyonabil</p>
            </div>
        </aside>
    );
};