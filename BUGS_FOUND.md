# 🐛 SalesAI — Bug Report

## Bug 1: Onboarding Bypass (FIXED ✅)
**File:** `frontend/auth/authService.ts`
**Description:** After login, new users were not shown the onboarding questions (Business Type, Lead Source, Business Name). The `hasClientProfile` flag was being set to `true` by default, so any user went straight to the Dashboard without completing setup.
**Fix:** Removed the premature DB query from the auth lock flow. Added a separate async profile check in `App.tsx` using a dedicated `useEffect`.

---

## Bug 2: Infinite Loading / Auth Lock Loop (FIXED ✅)
**File:** `frontend/App.tsx`, `frontend/auth/authService.ts`
**Description:** After login, the user got stuck on a "Loading..." spinner indefinitely. The browser console showed:
```
AbortError: Lock "lock:sb-xxx-auth-token" was not released within 5000ms.
```
**Cause:** The `buildSession` function inside `onAuthStateChange` was calling `supabase.auth.getSession()` again, which competed for the same lock — causing an infinite deadlock.
**Fix:** Created `buildSessionFromSupabase()` that takes the already-provided session directly, without calling `getSession()` again.

---

## Bug 3: "Attachment Format Not Supported" in Inbox (FIXED ✅)
**File:** `frontend/pages/Dashboard/InboxView.tsx`, `backend/whatsapp/connection.ts`
**Description:** When images or media were received in WhatsApp, they were displayed in the inbox as: `[Attachment: Format not supported]` — a raw error string shown to the user.
**Fix:**
- Backend: Improved `extractMessageContentSync` to label media types properly (e.g., `[IMAGE]`, `[VIDEO]`, `[Audio]`).
- Frontend: Updated `renderMessageContent` fallback to show a clean "Attachment" UI with a paperclip icon instead of the raw error text.

---

## Bug 4: Image Sending via UI (FIXED ✅)
**File:** `frontend/pages/Dashboard/InboxView.tsx`
**Description:** Initially thought there was no backend handler for the attach button. Tested it — the UI successfully posts multi-part form data to `/api/whatsapp/send-media` and Baileys delivers the image perfectly with a 200 OK. The only issue was the thumbnail preview UI, which is now fixed.
**Status:** Fixed — working as expected.

---

## Bug 5: Facebook Lead Ads — Stuck "CONNECTING..." (OPEN ⚠️)
**File:** `frontend/pages/Dashboard/AutomationsView.tsx` (and backend Meta webhook)
**Description:** The Meta/Facebook connection always shows "CONNECTING..." state and never resolves. The webhook integration appears incomplete.
**Status:** Open — requires Meta webhook verification and token handling to be completed.

---

## Bug 6: Group Messages Showing Raw Image URLs (FIXED ✅)
**File:** `frontend/pages/Dashboard/InboxView.tsx`
**Description:** In the conversation list, group messages showed raw image URLs like `[IMAGE:https://bewnhdybsbpivtei...]` instead of a clean "📷 Photo" label.
**Fix:** Updated `formatMessagePreview` to handle all `[IMAGE:...]` and `[VIDEO:...]` variants (both base64 and https URLs), plus added a fallback for raw https media links.
