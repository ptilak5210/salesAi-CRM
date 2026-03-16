<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1qZwEWBA3u0dIvEAidJCo2xKGp94Uz1gr

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies: `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app: `npm run dev`

## Database (Supabase)

- **WhatsApp (contacts, messages, RLS):** Run **[database/MIGRATE_WHATSAPP.sql](database/MIGRATE_WHATSAPP.sql)** in the Supabase SQL Editor. It is idempotent (safe to run more than once).
- **WhatsApp Auto-Responder:** Run **[database/ADD_AUTO_REPLY.sql](database/ADD_AUTO_REPLY.sql)** to add `auto_reply_enabled` and `auto_reply_text` to `whatsapp_credentials`.

If you see "policy already exists", run **MIGRATE_WHATSAPP.sql**; it drops policies before recreating them.

**Checklist for Inbox and auto-reply:** (1) Run **ADD_AUTO_REPLY.sql** so auto-reply settings are stored. (2) Ensure the backend is reachable from the frontend (CORS and Socket.IO are configured so the Inbox socket can connect with credentials; frontend typically runs on port 3000 or 5173, backend on 3001).

## Project setup (full flow)

1. **Install and run:** `npm install`, set `GEMINI_API_KEY` in `.env.local`, then `npm run dev`.
2. **Supabase:** In the Supabase SQL Editor, run **MIGRATE_WHATSAPP.sql**, then **ADD_AUTO_REPLY.sql** (see Database section above).
3. **Connect WhatsApp:** In the app go to **Dashboard → Automations**. Under "WhatsApp Connection" click **Setup** and scan the QR code with WhatsApp on your phone. Wait until it shows **CONNECTED**.
4. **Auto-respond when a client writes:** In **Automations**, open **Auto-Responder** (same section). Turn **Enable auto-reply** on and set the message (e.g. "Thank you! We'll reply shortly."). Click **Save**. When a lead sends a message, they will get this reply automatically. Optionally use **AI Agent Replier** instead for AI-generated replies.
5. **Inbox:** Use **Dashboard → Inbox** to view and send messages. If you see "WhatsApp offline", ensure WhatsApp is connected in Automations and that the backend is running; status refreshes every few seconds.

## Troubleshooting

- **Backend must run on port 3001** for the Inbox and WhatsApp send to work. Use `npm run dev:backend` (or your usual backend start command). If the frontend can’t reach the backend, Inbox will show offline and sends will fail.
- **Messages not reaching WhatsApp:** When you send from the CRM Inbox, check the backend logs. You should see a log like `==> Hit /api/whatsapp/send` when a send is requested. If sends still don’t reach WhatsApp, look for send errors in the backend logs and confirm WhatsApp is connected in Automations.


bilobed whatsapp 
node js library


auth-supabase
oauth-supabase
database-supabase


whatsapp-qr 


redis
https://console.upstash.com/redis/87808327-26ed-46a2-b43b-674fb6b91e1b?teamid=0