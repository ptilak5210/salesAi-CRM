import React from 'react';
import { CheckCircle } from 'lucide-react';

export const PricingPage = ({ onSignup }: { onSignup: () => void }) => (
    <div className="min-h-screen bg-slate-950 pt-32">
        <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="text-center mb-24 animate-fade-in-up">
                <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6">Simple Pricing</h1>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto">Choose the plan that fits your growth stage.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {[
                    {
                        name: "Starter",
                        price: "$49",
                        desc: "Perfect for solo founders.",
                        features: ["500 Leads/month", "Basic Email Automation", "Standard Templates", "Community Support"]
                    },
                    {
                        name: "Pro",
                        price: "$149",
                        desc: "For growing teams.",
                        recommended: true,
                        features: ["2,500 Leads/month", "Email + LinkedIn Outreach", "Advanced AI Personalization", "Smart Analytics", "Priority Support"]
                    },
                    {
                        name: "Business",
                        price: "$399",
                        desc: "Ultimate scale.",
                        features: ["Unlimited Leads", "Omni-channel (Email, LI, WhatsApp)", "Dedicated Success Manager", "Custom AI Training", "API Access"]
                    }
                ].map((plan, i) => (
                    <div key={i} className={`relative p-8 rounded-3xl glass-panel flex flex-col transition-all duration-300 ${plan.recommended ? 'border-cyan-500 shadow-2xl shadow-cyan-500/10 md:-translate-y-4 z-10' : 'hover:border-slate-600'}`}>
                        {plan.recommended && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide shadow-lg">Most Popular</div>}

                        <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                        <p className="text-slate-400 text-sm mb-6">{plan.desc}</p>

                        <div className="text-5xl font-display font-bold text-white mb-8 tracking-tight">{plan.price}<span className="text-lg text-slate-500 font-sans font-normal ml-1">/mo</span></div>

                        <ul className="space-y-4 mb-8 flex-1">
                            {plan.features.map((f, j) => (
                                <li key={j} className="flex items-center gap-3 text-slate-300 text-sm">
                                    <CheckCircle className="w-5 h-5 text-cyan-500 shrink-0" /> {f}
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={onSignup}
                            className={`w-full py-4 rounded-xl font-bold transition-all ${plan.recommended ? 'bg-white text-slate-900 hover:bg-cyan-50' : 'bg-slate-800 text-white hover:bg-slate-700 border border-white/10'}`}
                        >
                            {plan.name === 'Business' ? 'Contact Sales' : `Get Started`}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    </div>
);
