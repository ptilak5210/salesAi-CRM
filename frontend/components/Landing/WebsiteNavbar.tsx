import React, { useState, useEffect } from 'react';
import { Briefcase, X, Menu } from 'lucide-react';

type PublicViewType = 'home' | 'features' | 'how-it-works' | 'pricing' | 'contact' | 'about';

export const WebsiteNavbar = ({ onLogin, onSignup, currentView, onNavigate }: {
    onLogin: () => void,
    onSignup: () => void,
    currentView: PublicViewType,
    onNavigate: (view: PublicViewType) => void
}) => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const NavItem = ({ view, label }: { view: PublicViewType, label: string }) => (
        <button
            onClick={() => { onNavigate(view); setMobileMenuOpen(false); }}
            className={`relative px-1 py-2 text-sm font-medium transition-colors hover:text-white ${currentView === view ? 'text-cyan-400' : 'text-slate-300'
                } group`}
        >
            {label}
            <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 transform origin-left transition-transform duration-300 ${currentView === view ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}></span>
        </button>
    );

    return (
        <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled || mobileMenuOpen ? 'bg-slate-950/80 backdrop-blur-xl border-b border-white/5 py-4' : 'bg-transparent py-6'}`}>
            <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                <button onClick={() => onNavigate('home')} className="flex items-center gap-3 group">
                    <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2 rounded-xl shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform duration-300">
                        <Briefcase className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex flex-col leading-none text-left">
                        <span className="font-display font-bold text-xl text-white tracking-tight">SalesAI</span>
                        <span className="text-[10px] text-cyan-400 font-medium tracking-widest uppercase">Vedanco</span>
                    </div>
                </button>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-8">
                    <NavItem view="features" label="Features" />
                    <NavItem view="how-it-works" label="How It Works" />
                    <NavItem view="pricing" label="Pricing" />
                    <NavItem view="about" label="About Us" />
                    <NavItem view="contact" label="Contact" />
                </div>

                <div className="hidden md:flex items-center gap-4">
                    <button onClick={onLogin} className="text-slate-300 hover:text-white font-medium px-4 py-2 transition-colors text-sm">Log In</button>
                    <button onClick={onSignup} className="relative group overflow-hidden rounded-full p-[1px]">
                        <span className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-600 group-hover:from-cyan-300 group-hover:to-blue-500 transition-all"></span>
                        <span className="relative block px-6 py-2 bg-slate-950 text-white rounded-full text-sm font-bold group-hover:bg-opacity-90 transition-all">
                            Sign Up Free
                        </span>
                    </button>
                </div>

                {/* Mobile Toggle */}
                <button className="md:hidden text-slate-300 hover:text-white p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                    {mobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="md:hidden absolute top-full left-0 w-full bg-slate-900 border-b border-white/5 p-6 flex flex-col gap-4 animate-fade-in shadow-2xl">
                    <NavItem view="features" label="Features" />
                    <NavItem view="how-it-works" label="How It Works" />
                    <NavItem view="pricing" label="Pricing" />
                    <NavItem view="about" label="About Us" />
                    <NavItem view="contact" label="Contact" />
                    <div className="h-px bg-white/5 my-2"></div>
                    <button onClick={() => { onLogin(); setMobileMenuOpen(false); }} className="text-left py-3 text-slate-300 font-medium">Log In</button>
                    <button onClick={() => { onSignup(); setMobileMenuOpen(false); }} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-lg font-bold shadow-lg">Sign Up Free</button>
                </div>
            )}
        </nav>
    );
};
