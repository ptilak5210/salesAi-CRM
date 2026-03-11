import React from 'react';
import { Button } from '../Button';

export const PlaceholderView = ({ title, icon: Icon }: any) => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 bg-white rounded-2xl border border-slate-100 shadow-sm animate-fade-in">
        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 animate-bounce-slow">
            <Icon className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{title}</h2>
        <p className="text-slate-500 max-w-md">
            This module is currently under development. Check back soon for updates!
        </p>
        <Button variant="outline" className="mt-8" onClick={() => { }}>
            Notify Me When Ready
        </Button>
    </div>
);
