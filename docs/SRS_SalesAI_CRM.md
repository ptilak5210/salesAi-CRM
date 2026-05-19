# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
## SalesAI — AI-Powered WhatsApp CRM & Sales Automation Platform

---

**Document Version:** 2.0  
**Prepared By:** Development Team — Gujarat Infotech Ltd SMC  
**Project Name:** SalesAI — Outreach & CRM Platform  
**Date:** May 2026  
**Classification:** Internal / Academic Submission  

---

## TABLE OF CONTENTS

1. Introduction
2. Overall Description
3. System Architecture
4. Functional Requirements
5. Non-Functional Requirements
6. Database Design
7. API Specification
8. n8n AI Automation Workflow
9. User Interface Requirements
10. Security Requirements
11. Integration Requirements
12. Testing Requirements
13. Deployment & Infrastructure
14. Risk Analysis
15. Glossary
16. Appendix

---

# SECTION 1: INTRODUCTION

## 1.1 Purpose

This Software Requirements Specification (SRS) document provides a comprehensive and detailed description of the SalesAI platform — an AI-powered Customer Relationship Management (CRM) and sales automation system built for small-to-medium businesses (SMBs). The document defines the complete functional, non-functional, architectural, and behavioral requirements of the system and is intended for use by:

- Software developers and engineers building the system
- Quality assurance testers validating system behavior
- Project managers overseeing delivery timelines
- Academic evaluators reviewing the technical scope
- Business stakeholders assessing alignment with business goals

## 1.2 Scope

SalesAI is a full-stack web application that integrates WhatsApp Business messaging (via the Baileys library), AI-driven lead qualification (via Google Gemini), automated follow-up workflows (via n8n), and a real-time CRM dashboard. The platform enables sales teams to:

- Capture and manage leads from multiple channels (WhatsApp, Meta Ads, CSV import)
- Communicate with leads via integrated WhatsApp inbox in real-time
- Automate lead qualification, follow-up sequences, and meeting booking using AI
- Monitor pipeline health through an analytics dashboard
- Schedule and manage meetings/activities

**In Scope:**
- Frontend React SPA (Single Page Application)
- Node.js/Express REST API backend
- Supabase PostgreSQL database with Row Level Security
- WhatsApp integration via Baileys library
- n8n workflow automation engine integration
- Google Gemini AI integration
- Real-time messaging via Socket.IO
- BullMQ/Redis message queue

**Out of Scope:**
- Native mobile applications (iOS/Android)
- WhatsApp Business API (Meta official API — uses Baileys instead)
- Payment gateway integration
- Multi-language support (Phase 1)

## 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|------|-----------|
| SRS | Software Requirements Specification |
| CRM | Customer Relationship Management |
| API | Application Programming Interface |
| WA | WhatsApp |
| AI | Artificial Intelligence |
| LLM | Large Language Model |
| n8n | Node-based workflow automation tool |
| SPA | Single Page Application |
| RLS | Row Level Security (Supabase/PostgreSQL feature) |
| JWT | JSON Web Token |
| QR | Quick Response (code) |
| JID | Jabber ID — WhatsApp's internal identifier format |
| Baileys | Open-source Node.js WhatsApp Web library |
| BullMQ | Redis-based job queue for Node.js |
| Socket.IO | Real-time bidirectional event-based communication library |
| Gemini | Google's large language model |
| Supabase | Open-source Firebase alternative (PostgreSQL backend) |
| SMB | Small-to-Medium Business |
| UX | User Experience |
| UI | User Interface |
| CRUD | Create, Read, Update, Delete |
| HTTP | Hypertext Transfer Protocol |
| HTTPS | HTTP Secure |
| CORS | Cross-Origin Resource Sharing |
| UUID | Universally Unique Identifier |
| CSV | Comma-Separated Values |
| Webhook | HTTP callback triggered by an event |

## 1.4 References

1. Baileys WhatsApp Library — https://github.com/WhiskeySockets/Baileys
2. Supabase Documentation — https://supabase.com/docs
3. n8n Workflow Automation — https://n8n.io/docs
4. Google Generative AI SDK — https://ai.google.dev
5. BullMQ Documentation — https://docs.bullmq.io
6. Socket.IO Documentation — https://socket.io/docs
7. Vite Build Tool — https://vitejs.dev
8. React 19 Documentation — https://react.dev
9. Express.js 5 — https://expressjs.com
10. Upstash Redis — https://console.upstash.com

## 1.5 Overview of Document

This document is organized into 16 major sections. Section 1 provides the introduction and purpose. Section 2 describes the overall product context. Sections 3–8 cover technical architecture, functional requirements, database design, and API specification. Section 8 specifically documents the n8n AI automation workflow in detail. Sections 9–16 address UI requirements, security, integrations, testing, deployment, and risk analysis.

---

# SECTION 2: OVERALL DESCRIPTION

## 2.1 Product Perspective

SalesAI operates as a standalone web-based CRM platform. It is designed to replace manual WhatsApp-based sales follow-ups with intelligent automation. The system sits at the intersection of three major technology domains:

1. **Messaging Infrastructure** — Real WhatsApp connectivity via Baileys
2. **AI Intelligence** — Lead qualification and auto-reply via Google Gemini
3. **Workflow Automation** — Multi-step follow-up sequences via n8n

The system interacts with external services but maintains its own database, authentication, and business logic layer.

```
┌─────────────────────────────────────────────────────────────┐
│                     SALESAI PLATFORM                        │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Frontend   │    │   Backend    │    │   Database   │   │
│  │  React SPA   │◄──►│  Node/Express│◄──►│  Supabase    │   │
│  │  (Vite)      │    │  + Socket.IO │    │  PostgreSQL  │   │
│  └──────────────┘    └──────┬───────┘    └──────────────┘   │
│                             │                               │
│              ┌──────────────┼──────────────┐                │
│              ▼              ▼              ▼                │
│        WhatsApp       Google Gemini     n8n Workflows       │
│        (Baileys)         (AI)          (Automation)         │
└─────────────────────────────────────────────────────────────┘
```

## 2.2 Product Functions

The primary functions of SalesAI are:

| Function Category | Sub-functions |
|------------------|---------------|
| **Lead Management** | Add leads, import from CSV, view pipeline, score leads, update status |
| **WhatsApp Inbox** | Real-time messaging, media sharing, group chats, read receipts |
| **AI Automation** | Auto-reply, AI lead qualification, n8n workflow triggers |
| **Activity Management** | Schedule meetings, confirm/decline activities, calendar view |
| **Analytics Dashboard** | Pipeline metrics, lead scores, activity tracking |
| **Integrations** | Meta/Facebook Ads, n8n webhooks, CSV import/export |
| **Authentication** | Email/password login, OAuth, session management |

## 2.3 User Classes and Characteristics

### 2.3.1 Sales Agent
- **Description:** Primary user of the CRM dashboard
- **Technical Skill:** Low to medium
- **Access:** Full CRM access — leads, inbox, activities, automations
- **Frequency of Use:** Daily, multiple sessions per day

### 2.3.2 Business Owner / Admin
- **Description:** Sets up integrations, monitors analytics
- **Technical Skill:** Medium
- **Access:** All modules + onboarding/setup configuration
- **Frequency of Use:** Weekly for reports, daily during campaigns

### 2.3.3 n8n Workflow Designer
- **Description:** Configures automated follow-up sequences
- **Technical Skill:** High
- **Access:** n8n platform + SalesAI webhook configuration
- **Frequency of Use:** During setup and workflow updates

### 2.3.4 Lead (External)
- **Description:** Customer/prospect communicating via WhatsApp
- **Technical Skill:** None required (uses standard WhatsApp)
- **Interaction:** Receives and sends WhatsApp messages only

## 2.4 Operating Environment

| Component | Environment |
|-----------|-------------|
| Frontend | Chrome 120+, Firefox 120+, Edge 120+, Safari 16+ |
| Backend | Node.js 20+ LTS on local/cloud server |
| Database | Supabase (hosted PostgreSQL 15) |
| Cache/Queue | Upstash Redis (cloud) |
| WhatsApp | Baileys library connecting via WhatsApp Web protocol |
| AI | Google Gemini 1.5 Flash / Pro via API |
| Automation | n8n (self-hosted or cloud) |
| OS (Development) | Windows 11 / macOS / Linux |

## 2.5 Design and Implementation Constraints

1. **WhatsApp Protocol:** Baileys uses unofficial WhatsApp Web protocol — not Meta's official Business API. This means behavior may change with WhatsApp updates.
2. **Single User Per Session:** Each WhatsApp account can be connected to one CRM user at a time.
3. **Redis Required:** BullMQ message queue requires an active Redis instance (Upstash recommended).
4. **Supabase Auth Dependency:** All authentication is handled via Supabase Auth — no custom auth server.
5. **Port Configuration:** Backend must run on port 3001; frontend on port 3000 or 5173.
6. **CORS Policy:** Frontend origins strictly whitelisted in backend CORS configuration.
7. **File Upload Limit:** Media files capped at 64MB per upload (multer configuration).

## 2.6 Assumptions and Dependencies

**Assumptions:**
- Users have a valid WhatsApp account on a smartphone
- Users have internet connectivity for real-time messaging
- n8n instance is accessible via HTTPS webhook URL
- Supabase project is configured with correct schema and RLS policies

**Dependencies:**
- @whiskeysockets/baileys v7.0.0-rc.9
- @supabase/supabase-js v2.98.0
- @google/genai v1.44.0
- bullmq v5.71.0
- socket.io v4.8.3
- express v5.2.1
- react v19.2.3
- vite v6.2.0

---

# SECTION 3: SYSTEM ARCHITECTURE

## 3.1 High-Level Architecture

SalesAI follows a **three-tier architecture** with additional integration layers:

```
TIER 1: PRESENTATION LAYER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
React 19 SPA (Vite bundler)
├── Public Pages (Landing, Features, Pricing, About, Contact)
├── Authentication Pages (Login, Signup)
├── Dashboard Pages (Dashboard, Leads, Inbox, Activities, Automations)
└── Onboarding (Client Setup, Welcome Screen)

TIER 2: APPLICATION LAYER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Node.js + Express.js v5 REST API (Port 3001)
├── REST API Endpoints
├── Socket.IO WebSocket Server
├── WhatsApp Connection Manager (Baileys)
├── Message Queue Worker (BullMQ)
├── Auth Middleware (JWT via Supabase)
└── AI Service (Google Gemini)

TIER 3: DATA LAYER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Supabase (PostgreSQL 15)
├── 8 Core Tables with RLS Policies
├── Realtime Subscriptions
└── Auth Module

INTEGRATION LAYER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── WhatsApp Web (via Baileys)
├── Google Gemini AI API
├── n8n Webhook Automation
├── Upstash Redis (BullMQ)
└── Meta/Facebook Lead Ads (planned)
```

## 3.2 Component Architecture

### 3.2.1 Frontend Component Tree

```
App.tsx (Root Component)
├── PublicLayout
│   ├── WebsiteNavbar
│   ├── HomeView
│   ├── FeaturesPage
│   ├── HowItWorksPage
│   ├── PricingPage
│   ├── AboutPage
│   └── ContactPage
├── AuthScreen
│   ├── LoginForm
│   └── SignupForm
├── ClientSetupView (Onboarding)
└── Dashboard Layout
    ├── Sidebar (Navigation)
    ├── MobileBottomNav
    ├── MobileDrawer
    └── Main Content Area
        ├── DashboardView (Overview)
        ├── LeadsView (Lead Management)
        ├── InboxView (WhatsApp Messaging)
        ├── ActivitiesView (Calendar/Meetings)
        ├── AutomationsView (Integrations)
        └── Modals
            ├── ConnectWhatsAppModal (QR Scan)
            ├── ConnectMetaModal (Meta Ads)
            ├── AddLeadModal
            └── WelcomeScreen
```

### 3.2.2 Backend Module Structure

```
backend/
├── index.ts                 (Main Express server + Socket.IO)
├── middleware/
│   └── auth.ts              (JWT verification middleware)
├── routes/
│   ├── contacts.ts          (WhatsApp contacts CRUD)
│   ├── conversations.ts     (Message history)
│   └── session.ts           (Session management)
├── services/
│   └── aiService.ts         (Google Gemini integration)
├── whatsapp/
│   ├── connection.ts        (Baileys WhatsApp manager)
│   └── supabaseAuthState.ts (Persist Baileys auth to DB)
└── queue/
    └── messageQueue.ts      (BullMQ worker)

automation/
└── geminiService.ts         (Gemini AI automation)

database/
├── supabase.ts              (Supabase admin client)
├── RECOVERY_FULL_SCHEMA.sql (Full DB schema)
└── migrations/              (DB migration files)
```

## 3.3 Data Flow Architecture

### 3.3.1 Inbound WhatsApp Message Flow

```
WhatsApp Phone → Baileys Library → WhatsApp Connection Manager
     → Save to whatsapp_messages (Supabase)
     → Emit via Socket.IO to frontend InboxView
     → Check ai_agent_enabled flag:
          YES → Forward to n8n webhook → AI processes → Reply via /api/n8n/send
          NO  → Check ai_enabled flag:
                    YES → Generate reply via Gemini → Send via Baileys
                    NO  → Check auto_reply_enabled:
                              YES → Send fixed auto-reply text
                              NO  → No automated response (manual only)
```

### 3.3.2 Outbound Message Flow (from CRM)

```
User types message in InboxView
     → POST /api/whatsapp/send (with JWT Bearer token)
     → requireAuth middleware validates JWT
     → waManager.sendMessage() via Baileys
     → Message saved to whatsapp_messages
     → Delivered to WhatsApp contact
     → Socket.IO emits back to frontend (read receipt/delivered)
```

### 3.3.3 n8n Workflow Triggered Message Flow

```
n8n Workflow execution completes
     → POST /api/n8n/send (with X-API-KEY header)
     → API key validation (N8N_API_KEY env variable)
     → waManager.sendMessage() via Baileys
     → Message logged to DB with sender='ai'
     → Socket.IO notification to frontend
```

## 3.4 Real-Time Communication Architecture

Socket.IO is used for bidirectional real-time communication between backend and frontend:

| Event | Direction | Description |
|-------|-----------|-------------|
| `join-inbox` | Client→Server | User joins their private room for messages |
| `start-whatsapp-auth` | Client→Server | Initiates WhatsApp QR scan flow |
| `whatsapp-qr` | Server→Client | Emits QR code image for scanning |
| `whatsapp-connected` | Server→Client | Notifies successful WA connection |
| `whatsapp-disconnected` | Server→Client | Notifies WA disconnection |
| `whatsapp-error` | Server→Client | Notifies connection error |
| `new-message` | Server→Client | Real-time new message delivery |
| `message-status` | Server→Client | Delivery/read receipt updates |
| `disconnect` | Client→Server | Socket disconnect event |

## 3.5 Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend Framework | React | 19.2.3 | UI Component Library |
| Build Tool | Vite | 6.2.0 | Fast dev server & bundler |
| Language | TypeScript | 5.8.2 | Type-safe development |
| Backend Framework | Express.js | 5.2.1 | REST API server |
| Runtime | Node.js | 20+ LTS | JavaScript runtime |
| Database | PostgreSQL (Supabase) | 15 | Primary data store |
| Auth | Supabase Auth | 2.98.0 | User authentication |
| WhatsApp | Baileys | 7.0.0-rc.9 | WA Web protocol client |
| Real-time | Socket.IO | 4.8.3 | WebSocket server |
| Message Queue | BullMQ | 5.71.0 | Async job processing |
| Cache | Upstash Redis | — | Queue backing store |
| AI/LLM | Google Gemini | @google/genai 1.44.0 | AI reply generation |
| Automation | n8n | Cloud/Self-hosted | Workflow automation |
| Icons | Lucide React | 0.562.0 | UI icon library |
| File Upload | Multer | 2.1.1 | Media file handling |

---

---

# SECTION 4: FUNCTIONAL REQUIREMENTS

## 4.1 Authentication Module

### FR-AUTH-001: User Registration
- **Description:** New users can register with email and password
- **Input:** Email address, password (min 8 chars), full name
- **Process:** Supabase Auth creates account, sends verification email, inserts record in users table
- **Output:** JWT access token, user session object
- **Priority:** CRITICAL

### FR-AUTH-002: User Login
- **Description:** Registered users can log in with email/password
- **Input:** Email, password
- **Process:** Supabase Auth validates credentials, returns session tokens
- **Output:** JWT access token + refresh token, redirect to dashboard
- **Priority:** CRITICAL

### FR-AUTH-003: Google OAuth Login
- **Description:** Users can sign in using their Google account
- **Input:** Google OAuth redirect
- **Process:** Supabase OAuth flow, auto-creates user record if new
- **Output:** Authenticated session
- **Priority:** HIGH

### FR-AUTH-004: Session Persistence
- **Description:** User session is restored on page refresh without re-login
- **Input:** Cached Supabase session in localStorage
- **Process:** onAuthStateChange fires INITIAL_SESSION event, rebuilds app session
- **Output:** User stays logged in for up to token expiry
- **Priority:** CRITICAL

### FR-AUTH-005: Logout
- **Description:** User can securely sign out from all sessions
- **Input:** Click logout button in sidebar
- **Process:** Supabase signOut(), clear sessionStorage, reset app state
- **Output:** Redirect to home page, session destroyed
- **Priority:** HIGH

### FR-AUTH-006: Client Profile Check
- **Description:** After login, system checks if user has completed onboarding
- **Input:** User ID from JWT
- **Process:** Query clients table for user_id; if missing, redirect to ClientSetupView
- **Output:** Either onboarding screen or dashboard
- **Priority:** CRITICAL

## 4.2 Onboarding Module

### FR-ONBOARD-001: Business Profile Setup
- **Description:** New users complete a one-time business profile form
- **Input:** Business name, business type
- **Process:** Insert record into clients table, mark onboarding_completed = TRUE
- **Output:** User redirected to dashboard; WhatsApp connection modal shown
- **Priority:** HIGH

### FR-ONBOARD-002: Welcome Screen
- **Description:** After first WhatsApp connection, show a welcome/tutorial overlay
- **Input:** WhatsApp connection success event
- **Process:** Show WelcomeScreen component with guided steps
- **Output:** User understands how to use the platform
- **Priority:** MEDIUM

## 4.3 Lead Management Module

### FR-LEAD-001: View All Leads
- **Description:** User can view all their leads in a table/list view
- **Input:** Authenticated GET request to Supabase leads table
- **Process:** Query leads WHERE user_id = auth.uid() ORDER BY created_at DESC
- **Output:** List of leads with name, email, phone, status, score, source
- **Priority:** CRITICAL

### FR-LEAD-002: Add New Lead Manually
- **Description:** User can add individual leads via the AddLeadModal form
- **Input:** Name, email, phone number, status, score, source
- **Process:** Validate inputs, INSERT into leads table with user_id
- **Output:** Lead appears in list; real-time Supabase subscription triggers UI update
- **Priority:** CRITICAL

### FR-LEAD-003: Lead Status Management
- **Description:** Sales agents can update lead status throughout the pipeline
- **Input:** Select new status from dropdown
- **Status Values:** New → Contacted → Replied → Qualified → Closed
- **Process:** UPDATE leads SET status = ? WHERE id = ? AND user_id = ?
- **Output:** Lead status updated, UI reflects change
- **Priority:** HIGH

### FR-LEAD-004: Lead Scoring
- **Description:** Each lead has a temperature score indicating purchase intent
- **Input:** Manual selection or AI assessment
- **Score Values:** Cold, Warm, Hot
- **Process:** Store in leads.score column; display with color coding
- **Output:** Visual score indicator (blue=Cold, orange=Warm, red=Hot)
- **Priority:** HIGH

### FR-LEAD-005: Bulk CSV Import
- **Description:** User can upload Excel/CSV to import multiple leads at once
- **Input:** CSV/XLSX file with columns: name, email, phone, status, score, source
- **Process:** Parse file, validate each row, batch INSERT into leads table
- **Output:** All valid leads imported; error report for invalid rows
- **Priority:** HIGH

### FR-LEAD-006: Data Export
- **Description:** User can download all their leads as CSV
- **Input:** Click "Export" button in LeadsView
- **Process:** Fetch all leads, convert to CSV format, trigger browser download
- **Output:** Downloaded CSV file with all lead data
- **Priority:** MEDIUM

### FR-LEAD-007: Real-Time Lead Updates
- **Description:** LeadsView auto-updates when new leads are added
- **Input:** Supabase Realtime subscription on leads table
- **Process:** On INSERT/UPDATE/DELETE events, refresh leads list
- **Output:** UI updates without page reload
- **Priority:** HIGH

## 4.4 WhatsApp Inbox Module

### FR-INBOX-001: WhatsApp Connection Setup
- **Description:** User connects their personal/business WhatsApp via QR code
- **Input:** User clicks "Setup" on WhatsApp Connection card
- **Process:** 
  1. Frontend emits 'start-whatsapp-auth' via Socket.IO
  2. Backend starts Baileys session
  3. QR code emitted via 'whatsapp-qr' Socket.IO event
  4. User scans QR with WhatsApp app
  5. Connection confirmed; DB updated
- **Output:** WhatsApp session active; is_connected = TRUE in DB
- **Priority:** CRITICAL

### FR-INBOX-002: View All Conversations
- **Description:** Inbox shows list of all WhatsApp contacts/conversations
- **Input:** GET /api/whatsapp/chats (authenticated)
- **Process:** Fetch whatsapp_contacts + latest message per contact
- **Output:** Sorted list of chats (newest first) with contact name, last message, timestamp
- **Priority:** CRITICAL

### FR-INBOX-003: Real-Time Message Receipt
- **Description:** New incoming WhatsApp messages appear instantly in inbox
- **Input:** Lead sends WhatsApp message
- **Process:** Baileys receives message → saves to DB → Socket.IO emits to frontend
- **Output:** New message appears in conversation; chat list updates
- **Priority:** CRITICAL

### FR-INBOX-004: Send Text Messages
- **Description:** User can send text messages to leads from the CRM inbox
- **Input:** Type message, press Send
- **Process:** POST /api/whatsapp/send → Baileys sendMessage() → DB log
- **Output:** Message delivered to WhatsApp; appears in conversation
- **Priority:** CRITICAL

### FR-INBOX-005: Send Media Files
- **Description:** User can send images, documents, and videos to leads
- **Input:** Select file via file picker
- **Process:** POST /api/whatsapp/send-media (multipart form) → Baileys sendMedia()
- **Output:** Media delivered to WhatsApp contact
- **Priority:** HIGH

### FR-INBOX-006: Infinite Scroll Message History
- **Description:** Conversation history loads older messages on scroll
- **Input:** User scrolls to top of conversation
- **Process:** GET /api/whatsapp/messages/:jid?cursor=timestamp&limit=20
- **Output:** Older messages prepended to conversation view
- **Priority:** HIGH

### FR-INBOX-007: Human Takeover (Pause AI)
- **Description:** Agent can pause AI replies for a specific contact
- **Input:** Toggle "Human Takeover" for a conversation
- **Process:** PATCH /api/whatsapp/human-takeover → update ai_paused = TRUE
- **Output:** AI no longer auto-replies to that contact; agent handles manually
- **Priority:** HIGH

### FR-INBOX-008: Group Chat Support
- **Description:** System handles WhatsApp group messages
- **Input:** Group message received via Baileys
- **Process:** Store with is_group = TRUE, JID ending in @g.us
- **Output:** Group conversations appear in inbox with group name
- **Priority:** MEDIUM

### FR-INBOX-009: Contact Profile Display
- **Description:** Show contact's WhatsApp profile picture and name in inbox
- **Input:** Contact data from whatsapp_contacts table
- **Process:** Display profile_picture_url; fallback to initials avatar
- **Output:** Visual contact identity in inbox
- **Priority:** MEDIUM

### FR-INBOX-010: WhatsApp Status Indicator
- **Description:** Show whether WhatsApp is currently connected or offline
- **Input:** Real-time socket connection status
- **Process:** Poll connection status; update badge color
- **Output:** Green "CONNECTED" badge or red "OFFLINE" indicator
- **Priority:** HIGH

## 4.5 Automation Module

### FR-AUTO-001: Basic Auto-Responder
- **Description:** Send fixed reply when a lead messages for the first time
- **Input:** auto_reply_enabled = TRUE, auto_reply_text configured
- **Process:** On first inbound message from a lead, send configured reply
- **Output:** Lead receives automatic acknowledgment message
- **Priority:** HIGH

### FR-AUTO-002: AI Basic Reply (Gemini)
- **Description:** Gemini AI generates contextual replies to lead messages
- **Input:** ai_enabled = TRUE in whatsapp_credentials
- **Process:** Message content sent to Google Gemini → response generated → sent via Baileys
- **Output:** AI-generated reply delivered to lead
- **Priority:** HIGH

### FR-AUTO-003: n8n AI Agent Integration
- **Description:** Forward all messages to n8n webhook for advanced AI processing
- **Input:** ai_agent_enabled = TRUE, n8n_webhook_url configured
- **Process:**
  1. Inbound message received by Baileys
  2. POST to configured n8n_webhook_url with message payload
  3. n8n workflow processes: qualifies lead, routes decision, sends follow-up
  4. n8n calls POST /api/n8n/send to deliver reply via SalesAI
- **Output:** Full AI-powered conversation automation
- **Priority:** CRITICAL

### FR-AUTO-004: Webhook URL Configuration
- **Description:** User can set and update their n8n webhook URL
- **Input:** HTTPS webhook URL from n8n
- **Process:** PATCH /api/whatsapp/ai-agent-config → update n8n_webhook_url in DB
- **Output:** URL saved; used for all subsequent AI agent routing
- **Priority:** HIGH

### FR-AUTO-005: Webhook Connection Test
- **Description:** User can test if their n8n webhook is reachable
- **Input:** Click "Send Test Ping" button
- **Process:** POST /api/whatsapp/ai-agent-test → sends test payload to webhook URL
- **Output:** Success or failure message displayed to user
- **Priority:** HIGH

### FR-AUTO-006: AI Mode Conflict Prevention
- **Description:** When n8n AI agent is enabled, basic AI is auto-disabled
- **Input:** User enables ai_agent_enabled
- **Process:** Backend sets ai_enabled = FALSE when ai_agent_enabled = TRUE
- **Output:** No conflicting AI responses
- **Priority:** HIGH

### FR-AUTO-007: Meta Lead Ads Integration
- **Description:** Capture leads automatically from Facebook/Instagram ads
- **Input:** Meta webhook with lead data
- **Process:** Parse lead form data, INSERT into leads table
- **Output:** Lead appears in CRM automatically
- **Priority:** MEDIUM (planned)

## 4.6 Activities & Meetings Module

### FR-ACT-001: View All Activities
- **Description:** User can see all scheduled meetings and activities
- **Input:** GET /api/activities (authenticated)
- **Process:** Query activities WHERE user_id = ? ORDER BY date ASC
- **Output:** List of upcoming meetings with title, attendee, date, time, type, status
- **Priority:** HIGH

### FR-ACT-002: Create New Activity
- **Description:** User can schedule a meeting or call
- **Input:** Title, attendee name, date, time, type (Zoom/Phone/Google Meet)
- **Process:** POST /api/activities → INSERT into activities table
- **Output:** Activity created, appears in calendar view
- **Priority:** HIGH

### FR-ACT-003: Confirm Activity
- **Description:** User can confirm a pending activity
- **Input:** Click "Confirm" on pending activity
- **Process:** PUT /api/activities/:id/approve → status = 'confirmed'
- **Output:** Activity status updated to confirmed
- **Priority:** HIGH

### FR-ACT-004: Cancel/Decline Activity
- **Description:** User can cancel an activity
- **Input:** Click "Decline" on activity
- **Process:** PUT /api/activities/:id/decline → status = 'cancelled'
- **Output:** Activity marked as cancelled
- **Priority:** HIGH

### FR-ACT-005: Edit Activity
- **Description:** User can modify details of an existing activity
- **Input:** Updated title, date, time, attendee, type
- **Process:** PUT /api/activities/:id → UPDATE activities SET ...
- **Output:** Activity updated
- **Priority:** MEDIUM

### FR-ACT-006: Delete Activity
- **Description:** User can permanently delete an activity
- **Input:** Click delete button
- **Process:** DELETE /api/activities/:id WHERE user_id = ?
- **Output:** Activity removed from list
- **Priority:** MEDIUM

## 4.7 Analytics Dashboard Module

### FR-DASH-001: Lead Pipeline Overview
- **Description:** Dashboard shows total leads by status
- **Input:** Leads data from Supabase
- **Process:** Count leads grouped by status and score
- **Output:** Visual cards: Total Leads, Hot Leads, Warm Leads, Meetings Today
- **Priority:** HIGH

### FR-DASH-002: Recent Activities Widget
- **Description:** Dashboard shows upcoming meetings
- **Input:** Activities data
- **Process:** Filter activities by today/upcoming dates
- **Output:** Activity cards with confirm/decline quick actions
- **Priority:** HIGH

### FR-DASH-003: Deals Pipeline (Placeholder)
- **Description:** Kanban view of deals in negotiation stages
- **Status:** Placeholder in Phase 1; full implementation in Phase 2
- **Priority:** LOW (Phase 2)

### FR-DASH-004: Analytics & Reports (Placeholder)
- **Description:** Conversion rates, response times, AI performance metrics
- **Status:** Placeholder in Phase 1; full implementation in Phase 2
- **Priority:** LOW (Phase 2)

---

# SECTION 5: NON-FUNCTIONAL REQUIREMENTS

## 5.1 Performance Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-PERF-001 | API response time for CRUD operations | < 300ms (95th percentile) |
| NFR-PERF-002 | WhatsApp message delivery latency | < 2 seconds |
| NFR-PERF-003 | Real-time Socket.IO message delivery | < 500ms |
| NFR-PERF-004 | Frontend initial page load (Vite production build) | < 3 seconds |
| NFR-PERF-005 | Database query execution time | < 100ms |
| NFR-PERF-006 | File upload processing (media < 64MB) | < 10 seconds |
| NFR-PERF-007 | n8n webhook response time | < 5 seconds (timeout) |

## 5.2 Reliability Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-REL-001 | System uptime | 99.5% monthly |
| NFR-REL-002 | WhatsApp session auto-restore on reconnect | Must auto-restore within 30s |
| NFR-REL-003 | Unhandled exception recovery | Process must NOT crash (uncaughtException handler) |
| NFR-REL-004 | Message queue persistence | Messages must survive backend restart |
| NFR-REL-005 | Database transaction integrity | All DB writes must be atomic |

## 5.3 Security Requirements

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-SEC-001 | All API routes require valid JWT | requireAuth middleware on all protected routes |
| NFR-SEC-002 | Database Row Level Security | Supabase RLS policies on all tables |
| NFR-SEC-003 | n8n API endpoint uses API key | X-API-KEY header validation |
| NFR-SEC-004 | CORS restricted to known origins | localhost:3000, localhost:5173 only |
| NFR-SEC-005 | Passwords never stored in plain text | Supabase Auth handles hashing (bcrypt) |
| NFR-SEC-006 | WhatsApp session keys encrypted | Stored as JSONB in DB, not plain text |
| NFR-SEC-007 | HTTPS required in production | All external communications via TLS |

## 5.4 Scalability Requirements

| ID | Requirement | Note |
|----|-------------|------|
| NFR-SCALE-001 | Support up to 1000 leads per user | Supabase free tier supports this |
| NFR-SCALE-002 | Support up to 50,000 messages per user | With pagination and indexing |
| NFR-SCALE-003 | Support up to 100 concurrent WebSocket connections | Socket.IO room isolation |
| NFR-SCALE-004 | Message queue handles burst of 500 msgs/min | BullMQ with Redis |

## 5.5 Usability Requirements

| ID | Requirement |
|----|-------------|
| NFR-USE-001 | Mobile responsive design (320px – 1920px) |
| NFR-USE-002 | Dashboard navigation within 2 clicks from any screen |
| NFR-USE-003 | Loading states shown for all async operations |
| NFR-USE-004 | Error messages displayed in plain language |
| NFR-USE-005 | Form validation with inline error messages |
| NFR-USE-006 | Keyboard accessible UI components |

## 5.6 Maintainability Requirements

| ID | Requirement |
|----|-------------|
| NFR-MAINT-001 | TypeScript used across entire codebase |
| NFR-MAINT-002 | Component-based UI architecture (React) |
| NFR-MAINT-003 | Database schema versioned in /database/migrations |
| NFR-MAINT-004 | Environment variables for all configuration |
| NFR-MAINT-005 | Structured logging in backend (ISO timestamp prefix) |

---

---

# SECTION 6: DATABASE DESIGN

## 6.1 Entity Relationship Overview

The SalesAI database consists of 8 core tables hosted on Supabase (PostgreSQL 15). All tables implement Row Level Security (RLS) to ensure strict data isolation between users.

```
auth.users (Supabase Auth)
     │
     ├──────────────────────────────────────────────────────┐
     │                                                      │
     ▼                                                      ▼
public.users                                     public.clients
(profile data)                              (business onboarding)
     │
     ├─────────────────────────────────────────────────────────────────┐
     │                    │                   │                        │
     ▼                    ▼                   ▼                        ▼
public.leads      public.activities   public.whatsapp_credentials   public.whatsapp_sessions
(CRM leads)       (meetings/calls)    (connection config)           (Baileys auth state)
                                            │
                              ┌─────────────┴───────────────┐
                              ▼                             ▼
                  public.whatsapp_contacts         public.whatsapp_messages
                  (inbox contacts list)            (message history)
```

## 6.2 Table Definitions

### 6.2.1 users
Stores public user profile data linked to Supabase Auth.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, FK → auth.users | User identifier (matches Auth) |
| email | TEXT | NOT NULL | User email address |
| name | TEXT | NULLABLE | Display name |
| avatar_url | TEXT | NULLABLE | Profile picture URL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Account creation timestamp |

**RLS Policies:**
- SELECT: `auth.uid() = id`
- UPDATE: `auth.uid() = id`

### 6.2.2 leads
Core CRM table storing all lead/prospect information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Lead identifier |
| user_id | UUID | FK → auth.users, NOT NULL | Owner user |
| name | TEXT | NULLABLE | Lead full name |
| display_name | TEXT | NULLABLE | Alternative display name |
| email | TEXT | NULLABLE | Lead email address |
| mobile | TEXT | NULLABLE | WhatsApp phone number |
| status | TEXT | DEFAULT 'New' | Pipeline status |
| score | TEXT | DEFAULT 'Cold' | Lead temperature |
| source | TEXT | DEFAULT 'Manual' | Lead acquisition source |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last modification time |

**Status Values:** New, Contacted, Replied, Qualified, Closed
**Score Values:** Cold, Warm, Hot
**Source Values:** Manual, LinkedIn, Website, Import, Referral, Meta Ads

**RLS Policies:** Full CRUD restricted to `auth.uid() = user_id`

### 6.2.3 activities
Tracks meetings, calls, and other scheduled activities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Activity identifier |
| user_id | UUID | FK → auth.users, NOT NULL | Owner user |
| title | TEXT | NOT NULL | Activity title/description |
| attendee | TEXT | NOT NULL | Lead/contact name |
| date | TEXT | NOT NULL | Scheduled date (string format) |
| time | TEXT | NOT NULL | Scheduled time (string format) |
| type | TEXT | NOT NULL | Meeting type (Zoom/Phone/Meet) |
| status | TEXT | DEFAULT 'confirmed' | Activity status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Status Values:** pending, confirmed, cancelled (CHECK constraint enforced)
**RLS Policies:** Full CRUD restricted to `auth.uid() = user_id`

### 6.2.4 clients
Stores business onboarding profile per user.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Client profile ID |
| user_id | UUID | FK → auth.users, UNIQUE | One profile per user |
| business_name | TEXT | NULLABLE | Business/company name |
| business_type | TEXT | NULLABLE | Industry/type |
| onboarding_completed | BOOLEAN | DEFAULT FALSE | Onboarding status flag |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**RLS Policies:** SELECT and UPDATE restricted to `auth.uid() = user_id`

### 6.2.5 whatsapp_contacts
Stores all WhatsApp contacts that have interacted with the user.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Contact record ID |
| user_id | UUID | FK → auth.users, NOT NULL | Owner user |
| lead_phone | TEXT | NOT NULL | Phone number (digits only) |
| jid | TEXT | NOT NULL | WhatsApp JID (phone@s.whatsapp.net or group@g.us) |
| contact_name | TEXT | NULLABLE | WhatsApp display name |
| profile_picture_url | TEXT | NULLABLE | Profile picture URL |
| is_group | BOOLEAN | DEFAULT FALSE | Whether this is a group chat |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | First contact timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- UNIQUE on (user_id, jid) — prevents duplicate contacts
- INDEX on (user_id, lead_phone) — fast phone lookups

**RLS Policies:** Full CRUD restricted to `auth.uid() = user_id`

### 6.2.6 whatsapp_messages
Stores complete message history for all WhatsApp conversations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Message record ID |
| user_id | UUID | FK → auth.users, NOT NULL | Owner user |
| message_id | TEXT | NULLABLE | WhatsApp message ID |
| lead_phone | TEXT | NOT NULL | Contact phone number |
| jid | TEXT | NOT NULL | WhatsApp JID |
| content | TEXT | NOT NULL | Message text content |
| sender | TEXT | NOT NULL | Message sender type |
| status | TEXT | DEFAULT 'sent' | Delivery status |
| contact_name | TEXT | NULLABLE | Sender display name |
| is_group | BOOLEAN | DEFAULT FALSE | Group message flag |
| timestamp | TIMESTAMPTZ | DEFAULT NOW() | Message timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |

**Sender Values:** user (sales agent), lead (customer), ai (automated)
**Status Values:** pending, sent, delivered, read, received, error, played

**Indexes:**
- UNIQUE on (user_id, message_id) WHERE message_id IS NOT NULL
- INDEX on (user_id, jid, timestamp DESC) — optimized for conversation queries
- INDEX on (user_id, lead_phone, timestamp DESC) — phone-based lookups

### 6.2.7 whatsapp_credentials
Stores per-user WhatsApp connection configuration and AI settings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Credential record ID |
| user_id | UUID | FK → auth.users, UNIQUE | One record per user |
| phone_number_id | TEXT | NULLABLE | WhatsApp phone ID |
| access_token | TEXT | NULLABLE | Meta API token (if used) |
| is_connected | BOOLEAN | DEFAULT FALSE | Active connection status |
| ai_enabled | BOOLEAN | DEFAULT FALSE | Basic Gemini AI flag |
| ai_agent_enabled | BOOLEAN | DEFAULT FALSE | n8n AI Agent flag |
| n8n_webhook_url | TEXT | NULLABLE | n8n webhook endpoint URL |
| auto_reply_enabled | BOOLEAN | DEFAULT FALSE | Auto-responder flag |
| auto_reply_text | TEXT | DEFAULT '' | Fixed auto-reply message |
| session_name | TEXT | DEFAULT 'default' | Baileys session identifier |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

### 6.2.8 whatsapp_sessions
Stores Baileys authentication state (encryption keys, session data).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PK | Auto-increment ID |
| user_id | UUID | FK → auth.users, NOT NULL | Owner user |
| key_id | TEXT | NOT NULL | Baileys state key name |
| key_data | JSONB | NOT NULL | Encrypted session data |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Index:** UNIQUE on (user_id, key_id) — fast session key lookups
**Note:** This table is service-role only — not accessible via frontend.

## 6.3 Database Functions

### get_recent_whatsapp_chats(user_id UUID)
Returns optimized chat list with latest message per contact for inbox display.

```sql
SELECT DISTINCT ON (m.jid)
    m.jid, m.lead_phone,
    COALESCE(c.contact_name, m.contact_name) AS contact_name,
    c.profile_picture_url,
    COALESCE(m.is_group, c.is_group, FALSE) AS is_group,
    m.content AS last_message,
    m.timestamp AS last_timestamp,
    m.sender AS last_sender
FROM whatsapp_messages m
LEFT JOIN whatsapp_contacts c ON c.jid = m.jid
WHERE m.user_id = p_user_id
ORDER BY m.jid, m.timestamp DESC, m.id DESC
```

---

# SECTION 7: API SPECIFICATION

## 7.1 Authentication

All protected API endpoints require a Bearer JWT token in the Authorization header:
```
Authorization: Bearer <supabase_jwt_token>
```

The n8n send endpoint uses API key authentication instead:
```
X-API-KEY: <N8N_API_KEY>
```

## 7.2 Base URL
- Development: `http://localhost:3001`
- Production: Configured per deployment environment

## 7.3 API Endpoints

### 7.3.1 Health Check

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/health | None | Server health check |

**Response:**
```json
{ "status": "ok", "message": "Backend is running smoothly" }
```

### 7.3.2 WhatsApp Credentials

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/whatsapp/credentials | JWT | Get user WA credentials |
| PATCH | /api/whatsapp/credentials/disconnect | JWT | Disconnect WhatsApp |
| PATCH | /api/whatsapp/ai-toggle | JWT | Toggle basic AI replies |
| PATCH | /api/whatsapp/ai-agent-toggle | JWT | Toggle n8n AI agent |
| PATCH | /api/whatsapp/ai-agent-config | JWT | Set n8n webhook URL |
| POST | /api/whatsapp/ai-agent-test | JWT | Test n8n webhook |
| GET | /api/whatsapp/ai-agent-logs | JWT | Get AI activity logs |
| PATCH | /api/whatsapp/human-takeover | JWT | Pause/resume AI per contact |
| PATCH | /api/whatsapp/auto-reply-config | JWT | Set auto-reply settings |

### 7.3.3 WhatsApp Messaging

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/whatsapp/chats | JWT | List all conversations |
| POST | /api/whatsapp/send | JWT | Send text message |
| POST | /api/whatsapp/send-media | JWT | Send media file |
| GET | /api/whatsapp/messages/:identifier | JWT | Get message history |
| POST | /api/n8n/send | API Key | n8n sends WA message |

**POST /api/whatsapp/send Request Body:**
```json
{
  "to": "919876543210@s.whatsapp.net",
  "message": "Hello! How can I help you?",
  "quotedMsgId": "optional-message-id",
  "contact_name": "Sarah Miller"
}
```

**GET /api/whatsapp/messages/:jid Query Parameters:**
- `cursor` — ISO timestamp for pagination
- `limit` — Number of messages per page (default: 20)

**POST /api/n8n/send Request Body:**
```json
{
  "userId": "uuid-of-crm-user",
  "to": "919876543210@s.whatsapp.net",
  "message": "Your meeting is confirmed for tomorrow at 2 PM!",
  "contact_name": "John Doe"
}
```

### 7.3.4 Activities

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/activities | JWT | List all activities |
| POST | /api/activities | JWT | Create new activity |
| PUT | /api/activities/:id | JWT | Update activity |
| DELETE | /api/activities/:id | JWT | Delete activity |
| PUT | /api/activities/:id/approve | JWT | Confirm pending activity |
| PUT | /api/activities/:id/decline | JWT | Cancel activity |

**POST /api/activities Request Body:**
```json
{
  "title": "Product Demo Call",
  "attendee": "Sarah Miller",
  "date": "2026-05-15",
  "time": "14:00",
  "type": "Zoom",
  "status": "confirmed"
}
```

### 7.3.5 Error Response Format

All API errors follow this format:
```json
{
  "error": "Human-readable error message"
}
```

**HTTP Status Codes Used:**
| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (missing fields) |
| 401 | Unauthorized (invalid/missing token) |
| 500 | Internal Server Error |
| 502 | Bad Gateway (webhook unreachable) |

---
