import React, { useEffect, useState } from 'react';
import { Briefcase, ChevronRight } from 'lucide-react';

interface WelcomeScreenProps {
    onContinue: () => void;
    userName?: string;
}

export const WelcomeScreen = ({ onContinue, userName }: WelcomeScreenProps) => {
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        setAnimate(true);
    }, []);

    return (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col items-center overflow-hidden animate-fade-in">
            {/* Dynamic Confetti Styles */}
            <style dangerouslySetInnerHTML={{
                __html: [...Array(20)].map((_, i) => `
                    .confetti-${i} {
                        --size: ${Math.random() * 8 + 4}px;
                        --left: ${Math.random() * 100}%;
                        --top: ${Math.random() * 100}%;
                        --delay: ${Math.random() * 2}s;
                        --opacity: ${Math.random()};
                    }
                `).join('\n')
            }} />

            {/* Gradient Header with Confetti Effect */}
            <div className="w-full h-48 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 relative overflow-hidden">
                <div className="absolute inset-0 opacity-30">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className={`absolute bg-white rounded-full animate-pulse confetti-particle confetti-${i}`}
                        />
                    ))}
                </div>

                {/* Logo Area */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-xl">
                        <Briefcase className="w-10 h-10 text-white" />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className={`flex flex-col items-center px-8 pt-16 text-center max-w-xl transition-all duration-1000 transform ${animate ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <h1 className="text-4xl md:text-5xl font-display font-extrabold text-slate-900 mb-6 tracking-tight">
                    Welcome to SalesAI
                </h1>

                <p className="text-xl text-slate-600 font-medium mb-4">
                    Congratulations{userName ? `, ${userName}` : ''}! Your account is now active and ready to use.
                </p>

                <p className="text-lg text-slate-500 leading-relaxed mb-12">
                    Let's get started and turn more of your leads into clients!
                </p>

                {/* Bottom Action */}
                <div className="w-full mt-auto pb-12">
                    <button
                        onClick={onContinue}
                        className="w-full md:w-auto min-w-[300px] bg-[#1ab0c6] hover:bg-[#159cb0] text-white py-5 px-8 rounded-2xl font-bold text-lg uppercase tracking-widest transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        CONTINUE <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Background Decorations */}
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl -z-10"></div>
            <div className="absolute top-48 -right-24 w-80 h-80 bg-purple-50 rounded-full blur-3xl -z-10"></div>
        </div>
    );
};
