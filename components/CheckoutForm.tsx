import React, { useState, useEffect } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { UserProfile, Plan, Settings, Order } from '../types';
import { decrypt } from '../services/crypto';
import { supabase } from '../services/supabase';
import { XIcon, SpinnerIcon } from './icons';

interface CheckoutFormProps {
    plan: Plan;
    price: number;
    user: UserProfile;
    settings: Settings | null;
    onClose: () => void;
    onPaymentSuccess: () => void;
}

const StripeForm: React.FC<Omit<CheckoutFormProps, 'settings'>> = ({ plan, price, user, onClose, onPaymentSuccess }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setIsLoading(true);
        setMessage(null);

        // 1. Create a new order in the database with 'pending' status
        const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert({
                user_id: user.id,
                plan_id: plan,
                amount: price * 100, // Stripe expects cents
                currency: 'usd',
                status: 'pending',
                payment_method: 'stripe',
            })
            .select()
            .single();

        if (orderError) {
            setMessage(`Order creation failed: ${orderError.message}`);
            setIsLoading(false);
            return;
        }

        // 2. Confirm the payment with Stripe
        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}${window.location.pathname}#/`, // User is redirected here after payment
            },
        });

        // This part of the code is only reached if there is an immediate error.
        // Otherwise, the user is redirected. The order status is updated via webhook
        // for maximum security in production.
        if (error.type === "card_error" || error.type === "validation_error") {
            setMessage(error.message || 'An error occurred.');
            // Update the order to 'failed'
             await supabase.from('orders').update({ status: 'failed' }).eq('id', newOrder.id);
        } else {
            setMessage("An unexpected error occurred.");
             await supabase.from('orders').update({ status: 'failed' }).eq('id', newOrder.id);
        }

        setIsLoading(false);
    };

    return (
        <form id="payment-form" onSubmit={handleSubmit}>
            <PaymentElement id="payment-element" />
            <button disabled={isLoading || !stripe || !elements} id="submit" className="w-full mt-6 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:bg-slate-600 flex justify-center items-center">
                <span id="button-text">
                    {isLoading ? <SpinnerIcon className="animate-spin h-5 w-5 text-white" /> : `Pay $${price}`}
                </span>
            </button>
            {message && <div id="payment-message" className="text-red-400 text-center text-sm mt-4">{message}</div>}
        </form>
    );
};


export const CheckoutForm: React.FC<CheckoutFormProps> = ({ plan, price, user, settings, onClose, onPaymentSuccess }) => {
    const [activeTab, setActiveTab] = useState<'stripe' | 'paypal' | 'bank'>('stripe');
    const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
    const [clientSecret, setClientSecret] = useState<string>('');
    const [paypalClientId, setPaypalClientId] = useState<string | null>(null);

    const [bankProof, setBankProof] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    
    useEffect(() => {
        // Fetch API keys, prioritizing user's keys, then admin defaults
        const stripePk = decrypt(user.api_keys?.stripePublicKey || '');
        const paypalId = decrypt(user.api_keys?.paypalClientId || '');
        
        if(stripePk) {
            setStripePromise(loadStripe(stripePk));
        }
        if(paypalId) {
            setPaypalClientId(paypalId);
        }

        // =================================================================================
        // START OF SERVER-SIDE LOGIC (SIMULATED) - to be implemented in an Edge Function
        // =================================================================================
        const createPaymentIntent = async () => {
             // In a real app, this logic would be in a secure Supabase Edge Function.
             // The function would be called with an auth token.
             // Example call:
             // const { data, error } = await supabase.functions.invoke('create-stripe-payment-intent', {
             //   body: { amount: price * 100, currency: 'usd' },
             // });
             // if(error) throw error;
             // setClientSecret(data.clientSecret);
             
             // --- Start of simulation ---
             // For the demo, we simulate a call to a function that would return a clientSecret.
             // In production, NEVER expose your Stripe secret key on the client side.
             console.warn("SIMULATION: Creating a payment intent. This MUST be done on a server in production.");
             // For this demo to work, the user MUST provide their secret key in settings.
             // This is NOT secure for production.
             const stripeSk = decrypt(user.api_keys?.stripeSecretKey || settings?.default_api_keys?.stripeSecretKey || '');
             if (!stripeSk) {
                 console.error("Stripe Secret Key not configured. Cannot create payment intent.");
                 return;
             }
             try {
                const response = await fetch('https://api.stripe.com/v1/payment_intents', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${stripeSk}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        amount: String(price * 100),
                        currency: 'usd',
                        'automatic_payment_methods[enabled]': 'true'
                    })
                });
                const data = await response.json();
                if(data.error) throw new Error(data.error.message);
                setClientSecret(data.client_secret);
             } catch(e) {
                console.error("Error during payment intent creation simulation:", e);
             }
             // --- End of simulation ---
        };
        // =================================================================================
        // END OF SERVER-SIDE LOGIC (SIMULATED)
        // =================================================================================
        
        createPaymentIntent();
    }, [price, user.api_keys, settings?.default_api_keys]);

    const handleBankTransferSubmit = async () => {
        if (!bankProof) {
            setUploadError("Please attach proof of payment.");
            return;
        }
        setIsUploading(true);
        setUploadError('');

        const filePath = `${user.id}/${Date.now()}-${bankProof.name}`;
        const { error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(filePath, bankProof);
        
        if (uploadError) {
            setUploadError(`Upload error: ${uploadError.message}`);
            setIsUploading(false);
            return;
        }

        const { publicUrl } = supabase.storage.from('payment-proofs').getPublicUrl(filePath).data;

        const { error: orderError } = await supabase.from('orders').insert({
            user_id: user.id,
            plan_id: plan,
            amount: price * 100,
            currency: 'usd',
            status: 'pending', // Status will remain pending until manually verified by an admin
            payment_method: 'bank_transfer',
            payment_proof_url: publicUrl,
        });

        if (orderError) {
             setUploadError(`Order creation failed: ${orderError.message}`);
        } else {
            alert("Proof of payment submitted! Your plan will be activated after our team validates it.");
            onClose();
        }
        setIsUploading(false);
    };

    const TabButton: React.FC<{ tab: 'stripe' | 'paypal' | 'bank'; children: React.ReactNode }> = ({ tab, children }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`py-2 px-4 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab 
                ? 'border-cyan-500 text-cyan-400' 
                : 'border-transparent text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
        >
            {children}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" aria-modal="true">
            <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md border border-slate-700">
                <header className="p-4 flex justify-between items-center border-b border-slate-700">
                    <h2 className="text-lg font-bold">Payment for "{plan.charAt(0).toUpperCase() + plan.slice(1)}" Plan</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><XIcon className="w-6 h-6"/></button>
                </header>
                <main className="p-6">
                    <div className="border-b border-slate-700 mb-6">
                        <nav className="-mb-px flex space-x-4">
                            <TabButton tab="stripe">Card / Apple Pay / Google Pay</TabButton>
                            {paypalClientId && <TabButton tab="paypal">PayPal</TabButton>}
                            {settings?.bank_details && <TabButton tab="bank">Bank Transfer</TabButton>}
                        </nav>
                    </div>

                    {activeTab === 'stripe' && (
                        clientSecret && stripePromise ? (
                            <Elements options={{ clientSecret }} stripe={stripePromise}>
                                <StripeForm plan={plan} price={price} user={user} onClose={onClose} onPaymentSuccess={onPaymentSuccess} />
                            </Elements>
                        ) : <div className="text-center"><SpinnerIcon className="w-6 h-6 animate-spin mx-auto text-cyan-400" /></div>
                    )}
                    
                    {activeTab === 'paypal' && paypalClientId && (
                        <PayPalScriptProvider options={{ "clientId": paypalClientId, currency: "USD" }}>
                            <PayPalButtons
                                style={{ layout: "vertical" }}
                                createOrder={async (data, actions) => {
                                    // Logic to be placed in a 'create-paypal-order' Edge Function
                                    console.warn("SIMULATION: Creating PayPal order. This MUST be done on a server.");
                                    return actions.order.create({
                                        purchase_units: [{ amount: { value: String(price) } }]
                                    });
                                }}
                                onApprove={async (data, actions) => {
                                    // Logic to be placed in a 'capture-paypal-order' Edge Function
                                    console.warn("SIMULATION: Capturing PayPal order. This MUST be done on a server.");
                                    const details = await actions.order?.capture();
                                    
                                    // Update DB after capture
                                    const { error } = await supabase.from('orders').insert({
                                        user_id: user.id, plan_id: plan, amount: price * 100, currency: 'usd', status: 'succeeded',
                                        payment_method: 'paypal', provider_payment_id: details?.id
                                    });

                                    if(error) {
                                        alert('Error saving order.');
                                    } else {
                                        alert(`Transaction successful: ${details?.id}`);
                                        onPaymentSuccess();
                                    }
                                }}
                            />
                        </PayPalScriptProvider>
                    )}
                    
                    {activeTab === 'bank' && (
                        <div className="space-y-4 text-sm">
                            <h3 className="font-semibold text-slate-200">Bank Transfer Instructions</h3>
                            <div className="bg-slate-900/50 p-4 rounded-md whitespace-pre-wrap font-mono text-slate-300">
                                {settings?.bank_details || "Bank details have not been configured by the administrator."}
                            </div>
                            <p className="text-slate-400">Please complete the transfer and upload proof of payment (screenshot, PDF) below.</p>
                             <div>
                                <label htmlFor="bank-proof" className="block text-sm font-medium text-slate-400 mb-1">Proof of Payment</label>
                                <input type="file" id="bank-proof" onChange={e => setBankProof(e.target.files ? e.target.files[0] : null)} className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-600 file:text-slate-200 hover:file:bg-slate-500" />
                            </div>
                            {uploadError && <p className="text-red-400 text-xs">{uploadError}</p>}
                            <button onClick={handleBankTransferSubmit} disabled={isUploading || !bankProof} className="w-full mt-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md disabled:bg-slate-600 flex justify-center items-center">
                                {isUploading ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : 'Submit Proof'}
                            </button>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};