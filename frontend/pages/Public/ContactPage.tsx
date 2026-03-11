import React from 'react';
import { MapPin, Phone, Mail, Instagram, Linkedin, Twitter } from 'lucide-react';

export const ContactPage = () => (
    <div className="min-h-screen bg-slate-950 pt-32">
        <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="text-center mb-24 animate-fade-in-up">
                <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6">Get in Touch</h1>
                <p className="text-xl text-slate-400">We are here to help your business grow.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">

                <div className="p-12 bg-gradient-to-br from-indigo-900/40 to-slate-900 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[60px]"></div>

                    <div className="relative z-10 space-y-10">
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-2">Vedanco IT Solutions</h3>
                            <p className="text-indigo-200 text-sm font-medium">Premier Software & IT Services</p>
                        </div>

                        <div className="space-y-8">
                            <div className="flex items-start gap-5 group">
                                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-white font-medium mb-1">Office Address</h4>
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        InfoCity, Super Mall - 1,<br />
                                        Office No. 421/M,<br />
                                        Gandhinagar, Gujarat – India
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-5 group">
                                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
                                    <Phone className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-white font-medium mb-1">Phone</h4>
                                    <a href="tel:+916353097642" className="text-slate-400 text-sm hover:text-white transition-colors">+91-6353097642</a>
                                </div>
                            </div>

                            <div className="flex items-center gap-5 group">
                                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
                                    <Mail className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-white font-medium mb-1">Email</h4>
                                    <a href="mailto:vedanco.offical@gmail.com" className="text-slate-400 text-sm hover:text-white transition-colors">vedanco.offical@gmail.com</a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 relative z-10">
                        <h4 className="text-white font-medium mb-6">Connect With Us</h4>
                        <div className="flex gap-4">
                            {[
                                { icon: Instagram, url: "https://www.instagram.com/vedanco_official?igsh=eXAwcXZuY2l5dDgz" },
                                { icon: Linkedin, url: "https://www.linkedin.com/company/vedanco/" },
                                { icon: Twitter, url: "https://x.com/vedanco_group?s=11" }
                            ].map((social, i) => (
                                <a key={i} href={social.url} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-cyan-500 hover:border-cyan-500 hover:scale-110 transition-all duration-300">
                                    <social.icon className="w-5 h-5" />
                                </a>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-12 bg-slate-900">
                    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); alert("Thanks for contacting us! We will get back to you shortly."); }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                                <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all" placeholder="John Doe" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                                <input type="email" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all" placeholder="you@company.com" required />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</label>
                            <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all appearance-none cursor-pointer">
                                <option>Sales Inquiry</option>
                                <option>Support Request</option>
                                <option>Partnership</option>
                                <option>Other</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Message</label>
                            <textarea rows={5} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all resize-none" placeholder="Tell us about your project..." required></textarea>
                        </div>

                        <button type="submit" className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 transform hover:-translate-y-1">
                            Send Message
                        </button>
                    </form>
                </div>

            </div>
        </div>
    </div>
);
