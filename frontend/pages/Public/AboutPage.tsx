import React from 'react';
import { Briefcase, Rocket, Target, Lightbulb, Zap, Shield, BarChart3, Heart } from 'lucide-react';

export const AboutPage = () => (
    <div className="min-h-screen bg-slate-950 pt-32">
        <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="text-center mb-24 animate-fade-in-up">
                <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6">About Us</h1>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                    Innovating the future of sales automation.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-32 items-center">
                <div className="order-2 md:order-1 animate-fade-in-up delay-100">
                    <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg"><Briefcase className="w-6 h-6 text-white" /></div>
                        Vedanco IT Solutions
                    </h2>
                    <p className="text-slate-300 leading-relaxed mb-6 text-lg">
                        Vedanco IT Solutions is a premier software development and IT services company dedicated to delivering quality and innovation.
                        We specialize in building robust SaaS platforms that solve real-world business problems.
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        With a team of expert engineers and designers, we created SalesAI to bridge the gap between complex sales processes and efficient automation.
                        Our commitment is to provide tools that empower businesses to scale without limits.
                    </p>
                </div>
                <div className="order-1 md:order-2 glass-panel p-8 rounded-3xl animate-fade-in-up delay-200 hover:-translate-y-2 transition-transform duration-500">
                    <div className="w-full h-64 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center border border-white/5 mb-6 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <Rocket className="w-20 h-20 text-slate-700 group-hover:text-cyan-400 transition-colors duration-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">What is SalesAI?</h3>
                    <p className="text-slate-400 mb-6">
                        SalesAI is our flagship outreach automation platform designed for modern businesses. It leverages advanced Gemini AI to personalize communication.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-32">
                <div className="glass-panel p-10 rounded-3xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors duration-300">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-[80px] group-hover:bg-indigo-600/20 transition-all"></div>
                    <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-8">
                        <Target className="w-7 h-7" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">Our Mission</h3>
                    <p className="text-slate-400 leading-relaxed text-lg">
                        To help businesses automate their sales workflows, improve efficiency, and achieve sustainable growth by reducing manual effort through intelligent AI solutions.
                    </p>
                </div>
                <div className="glass-panel p-10 rounded-3xl relative overflow-hidden group hover:border-cyan-500/30 transition-colors duration-300">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-600/10 rounded-full blur-[80px] group-hover:bg-cyan-600/20 transition-all"></div>
                    <div className="w-14 h-14 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center text-cyan-400 mb-8">
                        <Lightbulb className="w-7 h-7" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">Our Vision</h3>
                    <p className="text-slate-400 leading-relaxed text-lg">
                        To become a trusted global provider of AI SaaS solutions, supporting startups and enterprises alike in their journey towards digital transformation.
                    </p>
                </div>
            </div>

            <div className="text-center mb-20">
                <h2 className="text-3xl font-bold text-white mb-12">Why Choose Vedanco?</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { title: "Innovation", desc: "Latest Gemini AI models.", icon: Zap, color: "text-amber-400" },
                        { title: "Reliability", desc: "99.9% Uptime guarantee.", icon: Shield, color: "text-emerald-400" },
                        { title: "Scalability", desc: "Grow with no limits.", icon: BarChart3, color: "text-blue-400" },
                        { title: "Support", desc: "24/7 Expert assistance.", icon: Heart, color: "text-rose-400" },
                    ].map((item, i) => (
                        <div key={i} className="group p-8 glass-panel rounded-2xl hover:bg-slate-800 transition-all duration-300 hover:-translate-y-1">
                            <div className={`w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center ${item.color} border border-white/5 mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                                <item.icon className="w-6 h-6" />
                            </div>
                            <h4 className="text-lg font-bold text-white mb-2">{item.title}</h4>
                            <p className="text-slate-400 text-sm">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);
