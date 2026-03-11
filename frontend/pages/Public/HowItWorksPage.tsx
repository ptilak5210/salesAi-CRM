import React from 'react';
import { UserIcon, Users, Send, MessageSquare, Calendar, CheckCircle } from 'lucide-react';

export const HowItWorksPage = () => (
    <div className="min-h-screen bg-slate-950 pt-32">
        <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="text-center mb-24 animate-fade-in-up">
                <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6">How SalesAI Works</h1>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto">From cold lead to closed deal — a fully automated workflow.</p>
            </div>

            <div className="relative mb-32 max-w-5xl mx-auto">
                <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500 via-purple-500 to-transparent md:-translate-x-px"></div>

                <div className="space-y-20">
                    {[
                        { step: 1, title: "Create Account", desc: "Sign up and set up your company workspace. Define your ideal customer profile.", icon: UserIcon },
                        { step: 2, title: "Add Leads", desc: "Import contacts via CSV or sync directly from your CRM. The AI enriches their data.", icon: Users },
                        { step: 3, title: "AI Sends Outreach", desc: "SalesAI crafts personalized messages and sends them via Email or LinkedIn.", icon: Send },
                        { step: 4, title: "AI Handles Replies", desc: "When a prospect replies, our AI drafts an intelligent response or answers questions.", icon: MessageSquare },
                        { step: 5, title: "Meeting Booking", desc: "Qualified leads are guided to book a demo on your calendar automatically.", icon: Calendar },
                        { step: 6, title: "Close Deals", desc: "Track revenue, analyze performance, and celebrate your wins.", icon: CheckCircle }
                    ].map((item, i) => (
                        <div key={i} className={`relative flex items-center md:justify-between ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} group`}>
                            <div className="hidden md:block w-5/12"></div>

                            <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-slate-900 border-4 border-slate-800 group-hover:border-cyan-500 z-10 flex items-center justify-center text-white transition-colors duration-300 shadow-xl">
                                <item.icon className="w-5 h-5" />
                            </div>

                            <div className="ml-24 md:ml-0 md:w-5/12 glass-panel p-8 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all hover:-translate-y-1 relative">
                                <div className="absolute top-8 -left-2 w-4 h-4 bg-slate-800 rotate-45 border-l border-b border-white/5 md:hidden"></div>
                                <div className={`hidden md:block absolute top-8 w-4 h-4 bg-slate-800 rotate-45 border-l border-b border-white/5 ${i % 2 === 0 ? '-left-2' : '-right-2 border-r border-t border-l-0 border-b-0'}`}></div>

                                <span className="text-cyan-500 font-bold text-sm tracking-wider uppercase mb-2 block">Step {item.step}</span>
                                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);
