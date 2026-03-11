import React, { useState } from 'react';
import {
    Building2, Home, Megaphone, Globe, MoreHorizontal,
    Facebook, Search, Globe2, MessageCircle, Users,
    ArrowRight, ArrowLeft, Loader2, CheckCircle2
} from 'lucide-react';
import { AuthSession } from '../../../utils/types';
import { createClientProfile, getUserSession } from '../../auth/authService';

interface ClientSetupViewProps {
    session: AuthSession;
    onSetupComplete: (session: AuthSession) => void;
}

export const ClientSetupView = ({ session, onSetupComplete }: ClientSetupViewProps) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        business_type: '',
        lead_source: '',
        business_name: session.company.name !== 'My Workspace' ? session.company.name : '',
        whatsapp_number: ''
    });

    const businessTypes = [
        { id: 'Local Service', icon: Building2, desc: 'Pest Control, Cleaning, Repair etc.' },
        { id: 'Real Estate', icon: Home, desc: 'Agents, Brokers, Property Mgmt' },
        { id: 'Marketing Agency', icon: Megaphone, desc: 'Digital Marketing, PR, SEO' },
        { id: 'Online Business', icon: Globe, desc: 'E-commerce, SaaS, Info Products' },
        { id: 'Other', icon: MoreHorizontal, desc: 'Different type of business' }
    ];

    const leadSources = [
        { id: 'Facebook / Instagram Ads', icon: Facebook },
        { id: 'Google Ads', icon: Search },
        { id: 'Website', icon: Globe2 },
        { id: 'WhatsApp', icon: MessageCircle },
        { id: 'Referrals', icon: Users }
    ];

    const handleSelectType = (type: string) => {
        setFormData(prev => ({ ...prev, business_type: type }));
        setCurrentStep(2);
    };

    const handleSelectSource = (source: string) => {
        setFormData(prev => ({ ...prev, lead_source: source }));
        setCurrentStep(3);
    };

    const handleNextStep = () => {
        if (currentStep === 3 && !formData.business_name.trim()) return;
        setCurrentStep(prev => prev + 1);
    };

    const handlePrevStep = () => {
        setCurrentStep(prev => prev - 1);
    };

    const handleSubmit = async () => {
        if (!formData.whatsapp_number.trim()) return;

        setError('');
        setLoading(true);

        try {
            await createClientProfile({
                user_id: session.user.id,
                business_type: formData.business_type,
                lead_source: formData.lead_source,
                business_name: formData.business_name,
                whatsapp_number: formData.whatsapp_number
            });

            const updatedSession = await getUserSession();
            if (updatedSession) {
                onSetupComplete(updatedSession);
            } else {
                onSetupComplete({ ...session, hasClientProfile: true });
            }

        } catch (err: any) {
            setError(err.message || 'Failed to save profile. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col pt-12 md:pt-24 px-4">
            <div className="max-w-xl w-full mx-auto">

                {/* Progress Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">
                            Step {currentStep} of 4
                        </span>
                        {currentStep > 1 && !loading && (
                            <button
                                onClick={handlePrevStep}
                                className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back
                            </button>
                        )}
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-indigo-600 transition-all duration-500 ease-out ${currentStep === 1 ? 'w-1/4' :
                                    currentStep === 2 ? 'w-2/4' :
                                        currentStep === 3 ? 'w-3/4' : 'w-full'
                                }`}
                        />
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
                        <div className="mt-0.5 font-bold">!</div>
                        <p>{error}</p>
                    </div>
                )}

                {/* --- STEP 1: Business Type --- */}
                {currentStep === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <h1 className="text-3xl font-display font-bold text-slate-800 mb-2">What type of business do you run?</h1>
                        <p className="text-slate-500 mb-8 text-lg">Select the option that best describes your company.</p>

                        <div className="grid gap-3">
                            {businessTypes.map((type) => {
                                const Icon = type.icon;
                                const isSelected = formData.business_type === type.id;
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => handleSelectType(type.id)}
                                        className={`flex items-center p-4 rounded-2xl border-2 text-left transition-all ${isSelected
                                            ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100'
                                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800 text-lg">{type.id}</h3>
                                            <p className="text-slate-500 text-sm mt-0.5">{type.desc}</p>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* --- STEP 2: Lead Source --- */}
                {currentStep === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                        <h1 className="text-3xl font-display font-bold text-slate-800 mb-2">Where do most of your leads come from?</h1>
                        <p className="text-slate-500 mb-8 text-lg">Help us understand where you generate your business.</p>

                        <div className="grid gap-3">
                            {leadSources.map((source) => {
                                const Icon = source.icon;
                                const isSelected = formData.lead_source === source.id;
                                return (
                                    <button
                                        key={source.id}
                                        onClick={() => handleSelectSource(source.id)}
                                        className={`flex items-center p-4 rounded-2xl border-2 text-left transition-all ${isSelected
                                            ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100'
                                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-800 text-lg">{source.id}</h3>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* --- STEP 3: Business Name --- */}
                {currentStep === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                        <h1 className="text-3xl font-display font-bold text-slate-800 mb-2">What is your business name?</h1>
                        <p className="text-slate-500 mb-8 text-lg">This is how your AI agent will introduce itself to leads.</p>

                        <div className="space-y-6">
                            <input
                                autoFocus
                                type="text"
                                placeholder="e.g. ABC Pest Control"
                                value={formData.business_name}
                                onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleNextStep() }}
                                className="w-full px-6 py-5 text-xl bg-white border-2 border-slate-200 text-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                            />

                            <button
                                onClick={handleNextStep}
                                disabled={!formData.business_name.trim()}
                                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white px-8 py-5 rounded-2xl text-lg font-semibold transition-all shadow-md shadow-indigo-200"
                            >
                                Continue
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* --- STEP 4: WhatsApp Number --- */}
                {currentStep === 4 && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                        <h1 className="text-3xl font-display font-bold text-slate-800 mb-2">Which WhatsApp number should receive leads?</h1>
                        <p className="text-slate-500 mb-8 text-lg">We'll link this number to start automating your conversations.</p>

                        <div className="space-y-6">
                            <input
                                autoFocus
                                type="tel"
                                placeholder="+91 9876543210"
                                value={formData.whatsapp_number}
                                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                                className="w-full px-6 py-5 text-xl bg-white border-2 border-slate-200 text-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                            />

                            <button
                                onClick={handleSubmit}
                                disabled={!formData.whatsapp_number.trim() || loading}
                                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-black disabled:opacity-50 disabled:hover:bg-slate-900 text-white px-8 py-5 rounded-2xl text-lg font-semibold transition-all shadow-lg shadow-slate-200"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Setting up your workspace...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" />
                                        Go to Dashboard
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
