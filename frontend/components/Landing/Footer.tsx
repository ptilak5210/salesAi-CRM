import React from 'react';
import { Briefcase, Linkedin, Twitter, Instagram, MapPin, Phone, Mail } from 'lucide-react';

type PublicViewType = 'home' | 'features' | 'how-it-works' | 'pricing' | 'contact' | 'about';

export const Footer = ({ onNavigate }: { onNavigate: (view: PublicViewType) => void }) => (
    <footer className="bg-slate-950 text-slate-400 pt-20 pb-10 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                <div className="space-y-6">
                    <h3 className="text-white text-xl font-display font-bold flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-cyan-400" /> Vedanco IT Solutions
                    </h3>
                    <p className="text-sm leading-relaxed">
                        Empowering businesses with intelligent automation and cutting-edge software solutions. We transform how you connect with customers through AI.
                    </p>
                    <div className="flex gap-4">
                        <a href="https://www.linkedin.com/company/vedanco/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center hover:border-cyan-500 hover:text-cyan-400 transition-all">
                            <Linkedin className="w-4 h-4" />
                        </a>
                        <a href="https://x.com/vedanco_group?s=11" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center hover:border-cyan-500 hover:text-cyan-400 transition-all">
                            <Twitter className="w-4 h-4" />
                        </a>
                        <a href="https://www.instagram.com/vedanco_official?igsh=eXAwcXZuY2l5dDgz" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center hover:border-cyan-500 hover:text-cyan-400 transition-all">
                            <Instagram className="w-4 h-4" />
                        </a>
                    </div>
                </div>

                <div>
                    <h4 className="text-white font-semibold mb-6">Product</h4>
                    <ul className="space-y-3 text-sm">
                        <li><button onClick={() => onNavigate('features')} className="hover:text-cyan-400 transition-colors">Features</button></li>
                        <li><button onClick={() => onNavigate('pricing')} className="hover:text-cyan-400 transition-colors">Pricing</button></li>
                        <li><button onClick={() => onNavigate('how-it-works')} className="hover:text-cyan-400 transition-colors">How It Works</button></li>
                    </ul>
                </div>

                <div>
                    <h4 className="text-white font-semibold mb-6">Company</h4>
                    <ul className="space-y-3 text-sm">
                        <li><button onClick={() => onNavigate('about')} className="hover:text-cyan-400 transition-colors">About Us</button></li>
                        <li><button onClick={() => onNavigate('contact')} className="hover:text-cyan-400 transition-colors">Contact Us</button></li>
                        <li><a href="#" className="hover:text-cyan-400 transition-colors">Careers</a></li>
                        <li><a href="#" className="hover:text-cyan-400 transition-colors">Blog</a></li>
                    </ul>
                </div>

                <div>
                    <h4 className="text-white font-semibold mb-6">Contact</h4>
                    <ul className="space-y-4 text-sm">
                        <li className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
                            <span>
                                InfoCity, Super Mall - 1,<br />
                                Office No. 421/M,<br />
                                Gandhinagar, Gujarat – India
                            </span>
                        </li>
                        <li className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-cyan-500 shrink-0" />
                            <a href="tel:+916353097642" className="hover:text-white transition-colors">+91-6353097642</a>
                        </li>
                        <li className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-cyan-500 shrink-0" />
                            <a href="mailto:vedanco.offical@gmail.com" className="hover:text-white transition-colors">vedanco.offical@gmail.com</a>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="pt-8 border-t border-slate-900 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
                <p>&copy; {new Date().getFullYear()} Vedanco IT Solutions. All rights reserved.</p>
                <div className="flex gap-6">
                    <a href="#" className="hover:text-cyan-400">Privacy Policy</a>
                    <a href="#" className="hover:text-cyan-400">Terms of Service</a>
                </div>
            </div>
        </div>
    </footer>
);
