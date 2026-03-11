import React, { useState } from 'react';
import { X, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AddLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const COUNTRY_CODES = [
    { code: '+91', country: 'IN' },
    { code: '+1', country: 'US/CA' },
    { code: '+44', country: 'UK' },
    { code: '+61', country: 'AU' },
];

export const AddLeadModal = ({ isOpen, onClose, onSuccess }: AddLeadModalProps) => {
    const [clientName, setClientName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [mobileCode, setMobileCode] = useState('+91');
    const [mobileNumber, setMobileNumber] = useState('');
    const [whatsappCode, setWhatsappCode] = useState('+91');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!clientName.trim()) {
            setError('Client Name is required');
            return;
        }

        setLoading(true);

        try {
            // Note: Update this if the table structure requires different fields
            const fullMobile = mobileNumber ? `${mobileCode}${mobileNumber}` : null;
            const fullWhatsapp = whatsappNumber ? `${whatsappCode}${whatsappNumber}` : null;

            const { error: dbError } = await supabase
                .from('leads')
                .insert([{
                    name: clientName.trim(),
                    display_name: displayName.trim() || clientName.trim(), // Optional but default to clientName
                    mobile: fullMobile,
                    whatsapp: fullWhatsapp,
                    email: email.trim(),
                    status: 'New', // Default CRM status
                    score: 'Cold' // Default CRM score
                }]);

            if (dbError) throw new Error(dbError.message);

            // Trigger success callback to refresh the leads list parent
            onSuccess();
            onClose();

            // Reset form
            setClientName('');
            setDisplayName('');
            setMobileNumber('');
            setWhatsappNumber('');
            setEmail('');
        } catch (err: any) {
            setError(err.message || 'Failed to add new client.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800">Add New Client</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    <form id="add-lead-form" onSubmit={handleSubmit} className="space-y-5">
                        {/* Client Name */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                Client Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                placeholder="e.g. Katherine Lim"
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                required
                            />
                        </div>

                        {/* Display Name */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Display Name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="e.g. Katherine"
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all mb-1"
                            />
                            <p className="text-xs text-slate-500">Display name is what your clients will see.</p>
                        </div>

                        {/* Mobile Number */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mobile Number</label>
                            <div className="flex gap-2">
                                <select
                                    value={mobileCode}
                                    onChange={(e) => setMobileCode(e.target.value)}
                                    className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                                >
                                    {COUNTRY_CODES.map(c => (
                                        <option key={c.code} value={c.code}>{c.country} ({c.code})</option>
                                    ))}
                                </select>
                                <input
                                    type="tel"
                                    value={mobileNumber}
                                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Phone number"
                                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* WhatsApp Number */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">WhatsApp Number</label>
                            <div className="flex gap-2">
                                <select
                                    value={whatsappCode}
                                    onChange={(e) => setWhatsappCode(e.target.value)}
                                    className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                                >
                                    {COUNTRY_CODES.map(c => (
                                        <option key={c.code} value={c.code}>{c.country} ({c.code})</option>
                                    ))}
                                </select>
                                <input
                                    type="tel"
                                    value={whatsappNumber}
                                    onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
                                    placeholder="WhatsApp number"
                                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Email Address */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="e.g. email@example.com"
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </form>
                </div>

                {/* Footer Validation / Actions */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 mt-auto">
                    <button
                        type="submit"
                        form="add-lead-form"
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading && <Loader className="w-4 h-4 animate-spin" />}
                        SAVE
                    </button>
                </div>
            </div>
        </div>
    );
};
