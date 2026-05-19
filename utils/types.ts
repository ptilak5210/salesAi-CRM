
export type LeadStatus = 'New' | 'Contacted' | 'Replied' | 'Qualified' | 'Closed' | 'Follow Up';
export type LeadScoreTag = 'Hot' | 'Warm' | 'Cold';
export type Channel = 'WhatsApp' | 'LinkedIn' | 'Email';
export type UserRole = 'super_admin' | 'team_member' | 'ADMIN' | 'CLIENT' | 'Owner' | 'Agent';
export type PlanType = 'Starter' | 'Pro' | 'Business';
export type PublicViewType = 'home' | 'features' | 'how-it-works' | 'pricing' | 'contact' | 'about';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  owner_id: string;          // The auth.uid() of the workspace owner
  // Team member specific fields (populated for role === 'team_member')
  team_member_id?: string;   // UUID in team_members table
  title?: string;            // Display role: 'Manager' | 'Sales Executive' | 'Admin'
  pipeline_ids?: string[];   // Which pipelines this member can access
  permissions?: {
    can_export: boolean;
    can_import: boolean;
    can_delete: boolean;
    can_edit: boolean;
    can_view_analytics: boolean;
  };
}

export interface TeamMember {
  id: string;
  owner_id: string;
  auth_user_id?: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  pipeline_ids: string[];
  is_active: boolean;
  permissions?: {
    can_export: boolean;
    can_import: boolean;
    can_delete: boolean;
    can_edit: boolean;
    can_view_analytics: boolean;
  };
  created_at: string;
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
  ai_enabled: boolean;
  auto_reply_enabled: boolean;
  auto_reply_text: string | null;
  ai_agent_enabled?: boolean;
  n8n_webhook_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppContact {
  updated_at: string;
  ai_paused?: boolean;
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
  created_at?: string;
  updated_at?: string;
  assigned_to_name?: string | null;
  assigned_to_id?: string | null;
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

export interface Pipeline {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  bg_color: string;
  border_color: string;
  order_index: number;
}

export interface Deal {
  id: string;
  user_id?: string;
  pipeline_id: string;
  lead_id?: string;
  lead_name: string;
  company?: string;
  phone?: string;
  title: string;
  value: number;
  stage_id: string;
  stage?: string;
  score: 'Hot' | 'Warm' | 'Cold';
  expected_close_date?: string;
  closed_at?: string;
  loss_reason?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DealStageHistoryEntry {
  id: string;
  deal_id: string;
  from_stage_id?: string;
  to_stage_id: string;
  changed_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  attendee: string;
  date: string;
  time: string;
  type: string;
  agenda?: string;
  status?: 'pending' | 'confirmed' | 'cancelled';
}

export interface DashboardStats {
  totalLeads: number;
  activeCampaigns: number;
  repliesReceived: number;
  meetingsBooked: number;
  conversionRate: number;
}
