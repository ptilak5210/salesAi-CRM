import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

type PublicViewType = 'home' | 'features' | 'how-it-works' | 'pricing' | 'contact' | 'about';

export const HeroSlider = ({ onSignup, onNavigate }: { onSignup: () => void, onNavigate: (view: PublicViewType) => void }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const slides = [
        {
            title: "Automate Your Sales Outreach with Intelligent AI",
            subtitle: "AI that works 24/7 to convert leads into meetings. Let SalesAI handle the manual work while you focus on closing.",
            cta: "Get Started Free",
            action: onSignup,
            bg: "bg-slate-950"
        },
        {
            title: "Smart Follow-Ups That Never Miss",
            subtitle: "AI-driven follow-ups that increase conversions by 300%. Nurture every lead with personalized context.",
            cta: "View Demo",
            action: onSignup,
            bg: "bg-slate-950"
        },
        {
            title: "One Dashboard. Complete Sales Control.",
            subtitle: "Leads, conversations, meetings, and analytics in one unified place. Connect WhatsApp, LinkedIn, and Email effortlessly.",
            cta: "Explore Features",
            action: () => onNavigate('features'),
            bg: "bg-slate-950"
        }
    ];

    const nextSlide = useCallback(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, [slides.length]);

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    };

    useEffect(() => {
        if (!isPaused) {
            const interval = setInterval(nextSlide, 6000);
            return () => clearInterval(interval);
        }
    }, [isPaused, nextSlide]);

    return (
        <div
            className="relative h-screen min-h-[700px] flex items-center overflow-hidden bg-slate-950"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse-slow delay-500"></div>
                <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[100px]"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 contrast-125 brightness-100"></div>
            </div>

            {slides.map((slide, index) => (
                <div
                    key={index}
                    className={`absolute inset-0 transition-all duration-1000 ease-in-out flex items-center justify-center ${index === currentSlide
                        ? 'opacity-100 translate-y-0 z-10'
                        : 'opacity-0 translate-y-8 z-0'
                        }`}
                >
                    <div className="relative z-20 max-w-5xl mx-auto px-6 text-center space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-cyan-300 text-sm font-medium animate-fade-in-up">
                            <Sparkles className="w-4 h-4" />
                            <span>Next Gen Sales Automation</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-white leading-[1.1] animate-fade-in-up delay-100">
                            {index === currentSlide && (
                                <>
                                    {slide.title.split(' ').map((word, i) => (
                                        <span key={i} className="inline-block mr-3">{word}</span>
                                    ))}
                                </>
                            )}
                        </h1>

                        <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-200">
                            {slide.subtitle}
                        </p>

                        <div className="flex justify-center pt-6 animate-fade-in-up delay-300">
                            <button
                                onClick={slide.action}
                                className="group relative px-8 py-4 bg-white text-slate-900 rounded-full font-bold text-lg hover:bg-cyan-50 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(34,211,238,0.5)] flex items-center justify-center gap-2"
                            >
                                {slide.cta}
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            ))}

            <button onClick={prevSlide} className="absolute left-6 top-1/2 -translate-y-1/2 z-30 p-3 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-all border border-transparent hover:border-white/10 backdrop-blur-sm">
                <ChevronLeft className="w-8 h-8" />
            </button>
            <button onClick={nextSlide} className="absolute right-6 top-1/2 -translate-y-1/2 z-30 p-3 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-all border border-transparent hover:border-white/10 backdrop-blur-sm">
                <ChevronRight className="w-8 h-8" />
            </button>

            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 flex gap-4">
                {slides.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setCurrentSlide(i)}
                        className={`h-1.5 rounded-full transition-all duration-500 ${i === currentSlide ? 'bg-cyan-400 w-12 shadow-[0_0_10px_#22d3ee]' : 'bg-white/20 w-8 hover:bg-white/40'}`}
                    />
                ))}
            </div>
        </div>
    );
};
