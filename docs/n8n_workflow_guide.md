# SalesAI CRM — n8n Automation Workflow Guide

## Overview

This document explains the **SalesAI CRM n8n Workflow** (`SalesAI-Perfect-Flow-v2.json`).
The workflow automates WhatsApp lead responses, routing logic, and multi-day follow-ups.

---

## Architecture

```
WhatsApp Lead Message
        │
        ▼
[SalesAI Backend] ──── POST ──── [n8n Webhook: /webhook/lead-intake]
        │
        ▼
  Extract Lead Data (name, phone, userId, message, buttonId)
        │
        ▼
  ┌─────────────────────────────────────┐
  │    "Is Button or Follow-Up?"        │
  │         (Switch Node)               │
  ├─────────────────────────────────────┤
  │ Route 1: buttonId is NOT empty      │──► Button Press Handler
  │ Route 2: followup_step > 0          │──► Follow-Up Drip Campaign
  │ Route 3: buttonId empty, step = 0   │──► Normal Chat (AI Reply)
  └─────────────────────────────────────┘
```

---

## Workflow File

**File:** `docs/n8n_workflows/SalesAI-Perfect-Flow-v2.json`

**Import Instructions:**
1. Open your n8n dashboard → `https://ptilak535.app.n8n.cloud`
2. Click `+ New Workflow`
3. Click the `⋮` menu → **Import from File**
4. Select the JSON file above
5. **Update the following before activating:**

---

## Configuration Required After Import

### 1. Ngrok / Backend URL
All HTTP Request nodes point to your local backend via Ngrok.
Update this URL in ALL `Send WhatsApp (HTTP Request)` nodes:
```
https://YOUR-NGROK-DOMAIN.ngrok-free.app/api/n8n/send
```
> ⚠️ Run `ngrok http 3001 --domain=YOUR-DOMAIN` before testing.

### 2. API Key (Header Auth)
In n8n → Credentials → Header Auth:
- **Name:** `x-api-key`
- **Value:** `salesai_n8n_secret_key_2024`

> This must match `N8N_API_KEY` in your `.env` file.

### 3. Webhook URL
The workflow receives data at:
```
https://ptilak535.app.n8n.cloud/webhook/lead-intake
```
This URL must be saved in Supabase `whatsapp_credentials.n8n_webhook_url` for your user.

---

## Routing Logic

### Route 1: Button Press
Triggered when a lead taps a WhatsApp interactive button.

| Button ID | Action |
|---|---|
| `btn_services` | Send Services info message |
| `btn_pricing` | Send Pricing details |
| `btn_demo` | Send Calendly booking link |
| `btn_not_interested` | Move lead to Negative_Leads sheet |

### Route 2: Follow-Up Campaign
Triggered by `followup_step` field (1, 3, or 7).

| Step | Delay | Message |
|---|---|---|
| Day 1 | Immediate | "Kal aapne query ki thi. Kaise madad kar sakta hu?" |
| Day 3 | 72 hours | "Still interested in our CRM?" |
| Day 7 | 96 hours | "Last reminder — want to book a demo?" |

### Route 3: Normal Chat
Triggered by any regular text message.
- The AI Agent processes the message and replies via `/api/n8n/send`.

---

## Data Flow: How a Message Gets Sent Back

```
n8n HTTP Request Node
        │
        │  POST https://YOUR-NGROK-URL/api/n8n/send
        │  Headers: { x-api-key: salesai_n8n_secret_key_2024 }
        │  Body: { userId, to, message }
        │
        ▼
SalesAI Backend (/api/n8n/send)
        │
        ▼
waManager.sendMessage(userId, to, message)
        │
        ▼
WhatsApp → Lead's Phone ✅
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| AI not replying | Check Ngrok is running: `ngrok http 3001 --domain=YOUR-DOMAIN` |
| n8n gets error 404 | Ngrok tunnel is offline — restart it |
| n8n gets error 401 | API key mismatch — check `N8N_API_KEY` in `.env` |
| Message sent but lead doesn't receive | Check WhatsApp is connected in CRM Automations tab |
| Lead created but no AI reply | Verify `ai_agent_enabled=true` and `n8n_webhook_url` is set in Supabase |

---

## Environment Variables Required

```env
# .env (never commit this file)
N8N_API_KEY=salesai_n8n_secret_key_2024
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
