import React from 'react';
import { Zap, MessageCircle, Clock, Users, MessageSquare, BarChart3 } from 'lucide-react';

export const FeaturesPage = () => (
    <div className="min-h-screen bg-slate-950 pt-32">
        <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="text-center mb-24 animate-fade-in-up">
                <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6">Powerful Features</h1>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                    A complete suite of tools to supercharge your outreach.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
                {[
                    { icon: Zap, title: "AI Outreach Automation", desc: "Craft hyper-personalized sequences that feel human. Our AI adapts tone based on prospect data." },
                    { icon: MessageCircle, title: "Multi-Channel Messaging", desc: "Reach prospects where they are active. Seamlessly orchestrate Email, LinkedIn, and WhatsApp." },
                    { icon: Clock, title: "Smart Follow-Ups", desc: "Never let a lead go cold. The system automatically schedules timely follow-ups until you get a reply." },
                    { icon: Users, title: "AI Lead Qualification", desc: "Stop chasing bad leads. SalesAI scores every prospect based on intent signals and engagement." },
                    { icon: MessageSquare, title: "Unified Inbox", desc: "Manage all your conversations in one place. No more switching between tabs." },
                    { icon: BarChart3, title: "Analytics Dashboard", desc: "Get real-time visibility into pipeline health, conversion rates, and team performance." },
                ].map((feat, i) => (
                    <div key={i} className="group p-8 rounded-3xl glass-panel hover:bg-slate-800/80 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border-t border-white/10">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform duration-300 border border-white/5">
                            <feat.icon className="w-7 h-7" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-300 transition-colors">{feat.title}</h3>
                        <p className="text-slate-400 leading-relaxed text-sm">{feat.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    </div>
);
