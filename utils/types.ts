
export type LeadStatus = 'New' | 'Contacted' | 'Replied' | 'Qualified' | 'Closed' | 'Follow Up';
export type LeadScoreTag = 'Hot' | 'Warm' | 'Cold';
export type Channel = 'WhatsApp' | 'LinkedIn' | 'Email';
export type UserRole = 'ADMIN' | 'CLIENT' | 'Owner' | 'Agent'; // Updated roles
export type PlanType = 'Starter' | 'Pro' | 'Business';
export type PublicViewType = 'home' | 'features' | 'how-it-works' | 'pricing' | 'contact' | 'about';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
}

export interface Company {
  id: string;
  name: string;
  plan: PlanType;
  limits: {
    leadsPerDay: number;
    messagesPerDay: number;
  };
  createdAt: string;
}

export interface ClientProfile {
  id: string;
  user_id: string;
  business_type: string;
  lead_source: string;
  business_name: string;
  whatsapp_number: string;
  created_at: string;
}

export interface WhatsAppCredential {
  id: string;
  user_id: string;
  phone_number_id: string;
  access_token: string;
  waba_id?: string;
  is_connected: boolean;
  ai_enabled?: boolean;
  auto_reply_enabled?: boolean;
  auto_reply_text?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  user: User;
  company: Company;
  token: string;
  hasClientProfile: boolean;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  role: string;
  status: LeadStatus;
  score: LeadScoreTag;
  source: string;
  lastContact: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'lead' | 'ai';
  content: string;
  timestamp: Date;
  channel: Channel;
}

export interface Conversation {
  leadId: string;
  messages: Message[];
  unreadCount: number;
}

export interface Deal {
  id: string;
  leadName: string;
  amount: number;
  stage: 'Discovery' | 'Proposal' | 'Negotiation' | 'Closed Won';
  probability: number;
}

export interface Meeting {
  id: string;
  title: string;
  attendee: string;
  date: string;
  time: string;
  type: string;
  status?: 'pending' | 'confirmed' | 'cancelled';
}

export interface DashboardStats {
  totalLeads: number;
  activeCampaigns: number;
  repliesReceived: number;
  meetingsBooked: number;
  conversionRate: number;
}
