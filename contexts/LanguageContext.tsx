import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

const translations = {
    en: {
        // Sidebar
        'overview': 'Overview',
        'site_audit': 'Site Audit',
        'ai_agents': 'AI Agents',
        'blog': 'Blog',
        'billing': 'Billing',
        'settings': 'Settings',
        'user_management': 'User Management',
        'visit_site': 'Visit Site',
        'view_blog': 'View Blog',
        // Header
        'logout': 'Logout',
        // Billing Page
        'manage_subscription_and_invoices': 'Manage your subscription, payment methods, and invoices.',
        'subscription_plan': 'Subscription Plan',
        'current_plan': 'Current Plan',
        'select_plan': 'Select Plan',
        'billing_history': 'Billing History',
        'date': 'Date',
        'amount': 'Amount',
        'status': 'Status',
        'invoice': 'Invoice',
        'no_invoices_yet': 'No invoices yet.',
    },
    es: {
        'overview': 'Visión General',
        'site_audit': 'Auditoría del Sitio',
        'ai_agents': 'Agentes de IA',
        'blog': 'Blog',
        'billing': 'Facturación',
        'settings': 'Configuración',
        'user_management': 'Gestión de Usuarios',
        'visit_site': 'Visitar Sitio',
        'view_blog': 'Ver Blog',
        'logout': 'Cerrar Sesión',
        // Billing Page
        'manage_subscription_and_invoices': 'Gestiona tu suscripción, métodos de pago y facturas.',
        'subscription_plan': 'Plan de Suscripción',
        'current_plan': 'Plan Actual',
        'select_plan': 'Seleccionar Plan',
        'billing_history': 'Historial de Facturación',
        'date': 'Fecha',
        'amount': 'Importe',
        'status': 'Estado',
        'invoice': 'Factura',
        'no_invoices_yet': 'Aún no hay facturas.',
    },
    fr: {
        'overview': 'Aperçu',
        'site_audit': 'Audit de Site',
        'ai_agents': 'Agents IA',
        'blog': 'Blog',
        'billing': 'Facturation',
        'settings': 'Paramètres',
        'user_management': 'Gestion Utilisateurs',
        'visit_site': 'Visiter le Site',
        'view_blog': 'Voir le Blog',
        'logout': 'Déconnexion',
        // Billing Page
        'manage_subscription_and_invoices': 'Gérez votre abonnement, vos moyens de paiement et vos factures.',
        'subscription_plan': 'Abonnement',
        'current_plan': 'Plan Actuel',
        'select_plan': 'Choisir ce Plan',
        'billing_history': 'Historique de Facturation',
        'date': 'Date',
        'amount': 'Montant',
        'status': 'Statut',
        'invoice': 'Facture',
        'no_invoices_yet': 'Aucune facture pour le moment.',
    }
};

type TranslationKeys = keyof typeof translations.en;
type Language = keyof typeof translations;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKeys) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = useCallback((key: TranslationKeys): string => {
    return translations[language][key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};