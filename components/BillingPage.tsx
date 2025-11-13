import React, { useState, useEffect } from 'react';
import { UserProfile, Order, Plan, Settings } from '../types';
import { supabase } from '../services/supabase';
import { StarIcon, DocumentTextIcon, DownloadIcon } from './icons';
import { CheckoutForm } from './CheckoutForm';
import { useTranslation } from '../contexts/LanguageContext';

const plans: Record<Plan, { name: string; price: number; features: string[]; }> = {
    free: { name: "Free", price: 0, features: ['5 Audits/month', '1 Property', 'Basic Analysis'] },
    pro: { name: "Pro", price: 29, features: ['100 Audits/month', '10 Properties', 'Advanced Analysis', 'CSV Export'] },
    business: { name: "Business", price: 99, features: ['Unlimited Audits', 'Unlimited Properties', 'Priority Support', 'API Access'] }
};

interface BillingPageProps {
    user: UserProfile;
    onUpdateUser: (updatedUserData: Partial<UserProfile>) => void;
}

const SettingsCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg">
        <header className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        </header>
        <div className="p-6">
            {children}
        </div>
    </div>
);

const PlanCard: React.FC<{ title: string; price: string; features: string[]; isCurrent: boolean; onSelect: () => void; t: (key: any) => string; }> = 
({ title, price, features, isCurrent, onSelect, t }) => (
    <div className={`p-6 rounded-lg border-2 transition-all flex flex-col ${isCurrent ? 'border-cyan-500 bg-slate-700/50' : 'border-slate-600 bg-slate-800 hover:border-slate-500'}`}>
        <h3 className="text-xl font-bold text-cyan-400">{title}</h3>
        <p className="text-3xl font-bold my-4">{price}<span className="text-sm font-normal text-slate-400">/mo</span></p>
        <ul className="space-y-2 text-slate-300 flex-grow">
            {features.map((f, i) => <li key={i} className="flex items-center"><StarIcon className="w-4 h-4 mr-2 text-cyan-400" />{f}</li>)}
        </ul>
        <button 
            onClick={onSelect}
            disabled={isCurrent}
            className="w-full mt-6 py-2 px-4 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-slate-600 bg-cyan-600 hover:bg-cyan-500 text-white"
        >
            {isCurrent ? t('current_plan') : t('select_plan')}
        </button>
    </div>
);

const StatusBadge: React.FC<{ status: Order['status'] }> = ({ status }) => {
    const colors = {
      succeeded: 'bg-green-500/20 text-green-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      failed: 'bg-red-500/20 text-red-400',
    };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${colors[status]}`}>{status}</span>;
};

export const BillingPage: React.FC<BillingPageProps> = ({ user, onUpdateUser }) => {
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const { t } = useTranslation();

    const fetchOrders = async () => {
        const { data, error } = await supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (error) console.error('Error fetching orders:', error);
        else if (data) setOrders(data);
    };

    useEffect(() => {
        fetchOrders();
        const fetchSettings = async () => {
             const { data } = await supabase.from('settings').select('default_api_keys, bank_details').limit(1).single();
             if (data) setSettings(data);
        };
        fetchSettings();
    }, [user.id]);
    
    const handlePlanSelect = (plan: Plan) => {
        if (plan === 'free') {
             if (confirm("Are you sure you want to downgrade to the Free plan? This will take effect at the end of your current billing cycle.")) {
                // In a real app, this would schedule a downgrade with your payment provider.
                onUpdateUser({ plan: 'free' });
                alert("You have been downgraded to the Free plan.");
            }
        } else {
            setSelectedPlan(plan);
            setIsCheckoutOpen(true);
        }
    };

    const handlePaymentSuccess = async (plan: Plan) => {
        const nextExpiry = new Date();
        nextExpiry.setMonth(nextExpiry.getMonth() + 1);
        
        onUpdateUser({ plan, plan_expiry: nextExpiry.toISOString() });
        setIsCheckoutOpen(false);
        await fetchOrders(); // Refresh order history
    };

    return (
        <div>
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-100">{t('billing')}</h1>
                <p className="mt-2 text-lg text-slate-400">{t('manage_subscription_and_invoices')}</p>
            </header>

            <div className="space-y-8">
                <SettingsCard title={t('subscription_plan')}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <PlanCard 
                            title="Free" price="$0" features={plans.free.features}
                            isCurrent={user.plan === 'free'} onSelect={() => handlePlanSelect('free')} t={t}
                        />
                         <PlanCard 
                            title="Pro" price="$29" features={plans.pro.features}
                            isCurrent={user.plan === 'pro'} onSelect={() => handlePlanSelect('pro')} t={t}
                        />
                         <PlanCard 
                            title="Business" price="$99" features={plans.business.features}
                            isCurrent={user.plan === 'business'} onSelect={() => handlePlanSelect('business')} t={t}
                        />
                    </div>
                </SettingsCard>

                <SettingsCard title={t('billing_history')}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-3">{t('date')}</th>
                                    <th className="px-4 py-3">{t('amount')}</th>
                                    <th className="px-4 py-3">Plan</th>
                                    <th className="px-4 py-3">{t('status')}</th>
                                    <th className="px-4 py-3">{t('invoice')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.length > 0 ? orders.map((order) => (
                                    <tr key={order.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                                        <td className="px-4 py-3 font-medium text-slate-200">{new Date(order.created_at).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">${(order.amount / 100).toFixed(2)} {order.currency.toUpperCase()}</td>
                                        <td className="px-4 py-3 capitalize">{order.plan_id}</td>
                                        <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                                        <td className="px-4 py-3">
                                            <button className="text-cyan-400 hover:underline font-semibold flex items-center gap-2">
                                                <DownloadIcon className="w-4 h-4" /> PDF
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="text-center p-8 text-slate-500">{t('no_invoices_yet')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </SettingsCard>
            </div>

            {isCheckoutOpen && selectedPlan && (
                <CheckoutForm 
                    plan={selectedPlan}
                    price={plans[selectedPlan].price}
                    user={user}
                    settings={settings}
                    onClose={() => setIsCheckoutOpen(false)}
                    onPaymentSuccess={() => handlePaymentSuccess(selectedPlan)}
                />
            )}
        </div>
    );
};