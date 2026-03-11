import React from 'react';
import { HeroSlider } from '../../components/Landing/HeroSlider';

export const HomeView = ({ onSignup, onNavigate }: any) => (
    <div className="animate-fade-in">
        <HeroSlider onSignup={onSignup} onNavigate={onNavigate} />
    </div>
);
