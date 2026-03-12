import React, { useState, useEffect } from 'react';
import { Briefcase, Menu, Calendar, BarChart3, Zap, PieChart, Settings, Bell } from 'lucide-react';
import { Lead, Message, AuthSession, Deal, Meeting, PublicViewType } from '../utils/types';
import { MobileBottomNav, MobileDrawer } from './components/Navigation/MobileNav';
import { Sidebar } from './components/Navigation/Sidebar';
import { PlaceholderView } from './components/Dashboard/PlaceholderView';
import { PublicLayout } from './layouts/PublicLayout';
import { HomeView } from './pages/Public/HomeView';
import { FeaturesPage } from './pages/Public/FeaturesPage';
import { HowItWorksPage } from './pages/Public/HowItWorksPage';
import { PricingPage } from './pages/Public/PricingPage';
import { AboutPage } from './pages/Public/AboutPage';
import { ContactPage } from './pages/Public/ContactPage';
import { AuthScreen } from './pages/Auth/AuthScreen';
import { DashboardView } from './pages/Dashboard/DashboardView';
import { LeadsView } from './pages/Dashboard/LeadsView';
import { InboxView } from './pages/Dashboard/InboxView';
import { AutomationsView } from './pages/Dashboard/AutomationsView';
import { ActivitiesView } from './pages/Dashboard/ActivitiesView';
import { ConnectMetaModal } from './components/Dashboard/ConnectMetaModal';
import { WelcomeScreen } from './components/Onboarding/WelcomeScreen';
import { ClientSetupView } from './pages/ClientSetup/ClientSetupView';
import { supabase } from './lib/supabase';
import { getUserSession, signOut } from './auth/authService';

// --- MOCK DATA ---
const MOCK_LEADS: Lead[] = [
  { id: '1', name: 'Sarah Miller', email: 'sarah@techcorp.com', phone: '+917490961147', company: 'TechCorp Inc.', role: 'CTO', status: 'Replied', score: 'Hot', source: 'LinkedIn', lastContact: '10 mins ago' },
  { id: '2', name: 'David Chen', email: 'david@growth.io', phone: '+919999999999', company: 'Growth.io', role: 'VP Sales', status: 'Contacted', score: 'Warm', source: 'Website', lastContact: '2 hours ago' },
  { id: '3', name: 'Emily Wilson', email: 'emily@retail.net', phone: '+918888888888', company: 'RetailNet', role: 'Director', status: 'New', score: 'Cold', source: 'Import', lastContact: 'Never' },
  { id: '4', name: 'James Rod', email: 'james@bigbiz.com', phone: '+917777777777', company: 'BigBiz', role: 'CEO', status: 'Qualified', score: 'Hot', source: 'Referral', lastContact: '1 day ago' },
];

const MOCK_CONVERSATION: Message[] = [
  { id: 'm1', sender: 'user', content: "Hi Sarah, I noticed TechCorp is scaling fast. We help companies like yours automate sales follow-ups. Would you be open to a 10-min chat?", timestamp: new Date(Date.now() - 86400000), channel: 'LinkedIn' },
  { id: 'm2', sender: 'lead', content: "Hi! Thanks for reaching out. That sounds interesting. How does the pricing work?", timestamp: new Date(Date.now() - 3600000), channel: 'LinkedIn' },
];

const MOCK_DEALS: Deal[] = [
  { id: '1', leadName: 'TechCorp Inc.', amount: 15000, stage: 'Negotiation', probability: 80 },
  { id: '2', leadName: 'BigBiz Enterprise', amount: 45000, stage: 'Proposal', probability: 50 },
  { id: '3', leadName: 'Startup One', amount: 5000, stage: 'Closed Won', probability: 100 },
];

const MOCK_MEETINGS: Meeting[] = [
  { id: '1', title: 'Product Demo', attendee: 'Sarah Miller', date: 'Today', time: '2:00 PM', type: 'Zoom' },
  { id: '2', title: 'Discovery Call', attendee: 'David Chen', date: 'Tomorrow', time: '10:00 AM', type: 'Google Meet' },
];

const App = () => {
  const [session, setSession] = useState<AuthSession | null>(null);
  // On refresh, restore the last view from sessionStorage so user stays on same page
  const [view, setView] = useState<string>(() => sessionStorage.getItem('appView') || 'home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true); // Prevent landing page flash

  // Persist view changes to sessionStorage (only authenticated views, not public ones)
  const AUTH_VIEWS = ['dashboard', 'leads', 'inbox', 'meetings', 'deals', 'automation', 'analytics', 'settings', 'client-setup'];
  const setViewAndSave = (v: string) => {
    if (AUTH_VIEWS.includes(v)) sessionStorage.setItem('appView', v);
    else sessionStorage.removeItem('appView');
    setView(v);
  };

  // Mock Data for View
  const [leads, setLeads] = useState<Lead[]>([]);
  const [conversation, setConversation] = useState(MOCK_CONVERSATION);
  const [activities, setActivities] = useState<Meeting[]>([]);

  const handleLogin = () => setView('login');
  const handleSignup = () => setView('signup');

  const handleAuthSuccess = (newSession: AuthSession) => {
    console.log('[App] Auth Success. hasClientProfile:', newSession.hasClientProfile);
    setSession(newSession);
    if (!newSession.hasClientProfile) {
      setViewAndSave('client-setup');
    } else {
      setViewAndSave('dashboard');
      const metaKey = `metaConnected_${newSession.user.id}`;
      if (localStorage.getItem(metaKey) !== 'true') {
        setTimeout(() => setMetaModalOpen(true), 500);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setSession(null);
      sessionStorage.removeItem('appView'); // Clear saved view on logout
      setView('home');
    } catch (e) {
      console.error(e);
    }
  };

  // Auth Hydration — uses Supabase's onAuthStateChange which fires INITIAL_SESSION
  // synchronously from localStorage on page refresh. No more stuck loading spinner.
  useEffect(() => {
    let mounted = true;

    // Safety fallback: if nothing fires within 6s, show the landing page
    const safetyTimeout = setTimeout(() => {
      if (mounted) setIsAuthLoading(false);
    }, 6000);

    const redirectToDashboard = (activeSession: any) => {
      if (!activeSession.hasClientProfile) {
        setViewAndSave('client-setup');
      } else {
        // Restore last saved view, or default to 'dashboard'
        const savedView = sessionStorage.getItem('appView');
        const targetView = (savedView && AUTH_VIEWS.includes(savedView)) ? savedView : 'dashboard';
        setViewAndSave(targetView);
        const metaKey = `metaConnected_${activeSession.user.id}`;
        if (localStorage.getItem(metaKey) !== 'true') {
          setTimeout(() => setMetaModalOpen(true), 500);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, supabaseSession) => {
      if (!mounted) return;
      console.log('[App] Auth State Change:', event);

      if (event === 'INITIAL_SESSION') {
        // Fired immediately on mount from cached session in localStorage.
        // If session exists, build our app session; otherwise just hide loader.
        if (supabaseSession) {
          try {
            const activeSession = await getUserSession();
            if (mounted && activeSession) {
              setSession(activeSession);
              redirectToDashboard(activeSession);
            }
          } catch (e) {
            console.error('Session build failed on INITIAL_SESSION', e);
          }
        }
        // Always hide loader after initial check — whether logged in or not
        if (mounted) {
          clearTimeout(safetyTimeout);
          setIsAuthLoading(false);
        }

      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Token refresh or explicit login — update session silently if already on dashboard
        try {
          const activeSession = await getUserSession();
          if (mounted && activeSession) {
            setSession(activeSession);
            if (view === 'home' || view === 'login' || view === 'signup') {
              redirectToDashboard(activeSession);
            }
          }
        } catch (e) {
          console.error('Session update failed', e);
        }

      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        sessionStorage.removeItem('appView');
        setView('home');
        if (mounted) setIsAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []); // Run only once on mount

  // 2. Fetch Leads from Supabase
  useEffect(() => {
    if (!session) return;

    const fetchLeads = async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching leads:', error);
      } else if (data) {
        setLeads(data.map(lead => ({
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.whatsapp || lead.mobile || '', // Use whatsapp as primary phone
          company: lead.display_name || lead.name,
          role: 'Client',
          status: lead.status || 'New',
          score: lead.score || 'Cold',
          source: 'Manual',
          lastContact: lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : 'Recent'
        })));
      }
    };

    fetchLeads();

    // Subscribe to leads changes
    const channel = supabase.channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const fetchActivities = async () => {
    if (!session) return;
    try {
      const response = await fetch('http://localhost:3001/api/activities', {
        headers: { 'Authorization': `Bearer ${session.token}` }
      });
      const { data } = await response.json();
      if (data) setActivities(data);
    } catch (e) {
      console.error("Failed to fetch activities:", e);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [session]);

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: text,
      timestamp: new Date(),
      channel: 'LinkedIn'
    };
    setConversation([...conversation, newMsg]);
  };

  // View Router
  const renderView = () => {
    // Show minimal loading screen while checking auth — prevents landing page flash
    if (isAuthLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] flex-col gap-4">
          <div className="w-12 h-12 border-4 border-[#e2e8f0] border-t-[#6366f1] rounded-full animate-spin" />
          <p className="text-[#94a3b8] text-sm font-sans">Loading…</p>
        </div>
      );
    }

    // Public Views
    if (!session) {
      if (view === 'login') return <AuthScreen onAuthSuccess={handleAuthSuccess} onBack={() => setView('home')} initialMode="login" />;
      if (view === 'signup') return <AuthScreen onAuthSuccess={handleAuthSuccess} onBack={() => setView('home')} initialMode="signup" />;

      return (
        <PublicLayout onLogin={handleLogin} onSignup={handleSignup} currentView={view as PublicViewType} onNavigate={setView}>
          {view === 'home' && <HomeView onSignup={handleSignup} onNavigate={setView} />}
          {view === 'features' && <FeaturesPage />}
          {view === 'how-it-works' && <HowItWorksPage />}
          {view === 'pricing' && <PricingPage onSignup={handleSignup} />}
          {view === 'about' && <AboutPage />}
          {view === 'contact' && <ContactPage />}
        </PublicLayout>
      );
    }

    // Client Setup View (authenticated but no profile)
    if (session && !session.hasClientProfile) {
      return (
        <ClientSetupView
          session={session}
          onSetupComplete={(newSession) => {
            setSession(newSession);
            setViewAndSave('dashboard');
            const metaKey = `metaConnected_${newSession.user.id}`;
            if (localStorage.getItem(metaKey) !== 'true') {
              setTimeout(() => setMetaModalOpen(true), 500);
            }
          }}
        />
      );
    }

    // Dashboard Views
    const dashboardContent = () => {
      switch (view) {
        case 'dashboard': return <DashboardView session={session} leads={leads} MOCK_DEALS={MOCK_DEALS} activities={activities} refreshActivities={fetchActivities} />;
        case 'leads': return <LeadsView leads={leads} />;
        case 'inbox': return <InboxView leads={leads} session={session} />;
        case 'meetings': return <ActivitiesView session={session!} activities={activities} leads={leads} refreshActivities={fetchActivities} />;
        case 'deals': return <PlaceholderView title="Deals Pipeline" icon={BarChart3 as any} />;
        case 'automation': return <AutomationsView onOpenMetaModal={() => setMetaModalOpen(true)} onWhatsAppSuccess={() => setShowWelcome(true)} session={session} />;
        case 'analytics': return <PlaceholderView title="Analytics & Reports" icon={PieChart as any} />;
        case 'settings': return <PlaceholderView title="Settings" icon={Settings as any} />;
        default: return <DashboardView session={session} leads={leads} MOCK_DEALS={MOCK_DEALS} activities={activities} refreshActivities={fetchActivities} />;
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar currentView={view} onChangeView={setViewAndSave} onLogout={handleLogout} user={session.user} />
        <MobileDrawer
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          currentView={view}
          onChangeView={setViewAndSave}
          onLogout={handleLogout}
          user={session.user}
        />

        <main className={`flex-1 md:ml-64 ${view === 'inbox' ? 'p-0 max-w-none' : 'p-4 md:p-8 pb-24 md:pb-8 max-w-[1600px] mx-auto'} w-full relative`}>
          {/* Global Header */}
          {view !== 'inbox' && (
            <div className="flex items-center justify-between md:justify-end mb-6 md:mb-8">
            <div className="md:hidden flex items-center gap-2 font-display font-bold text-lg text-slate-800">
              <Briefcase className="w-6 h-6 text-indigo-600" /> SalesAI
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setMetaModalOpen(true)}
                aria-label="Notifications"
                className="relative p-2.5 bg-white rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 hover:shadow-sm transition-all shadow-sm"
              >
                <Bell className="w-[18px] h-[18px]" />
                <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
              </button>
              <button
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open Menu"
                className="md:hidden p-2.5 bg-white rounded-lg border border-slate-200 text-slate-600 shadow-sm"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

          {dashboardContent()}
          <ConnectMetaModal
            isOpen={metaModalOpen}
            onClose={() => setMetaModalOpen(false)}
            userId={session?.user?.id}
            onSuccess={() => {
              setMetaModalOpen(false);
              setShowWelcome(true);
            }}
          />
          {showWelcome && (
            <WelcomeScreen
              onContinue={() => setShowWelcome(false)}
              userName={session?.user?.name || session?.user?.email?.split('@')[0]}
            />
          )}
        </main>

        <MobileBottomNav currentView={view} onChangeView={setView} />
      </div>
    );
  };

  return renderView();
};

export default App;