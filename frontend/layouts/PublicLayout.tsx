import React from 'react';
import { WebsiteNavbar } from '../components/Landing/WebsiteNavbar';
import { Footer } from '../components/Landing/Footer';

export const PublicLayout = ({ children, onLogin, onSignup, currentView, onNavigate }: any) => (
    <div className="bg-slate-950 min-h-screen text-slate-200 font-sans selection:bg-cyan-500/30">
        <WebsiteNavbar onLogin={onLogin} onSignup={onSignup} currentView={currentView} onNavigate={onNavigate} />
        {children}
        <Footer onNavigate={onNavigate} />
    </div>
);
