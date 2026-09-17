# GlobalLink matching-engine (STT + NLU + matching microservice)

The piece of the architecture that doesn't fit WordPress/PHP, per the plan
doc: speech-to-text, intent extraction, and orchestrating a request to the
`globallink-leads` WP plugin's already-scored `/businesses` endpoint. This
service holds **no database of its own** — the WordPress plugin is the
single source of truth for businesses, categories, subscriptions and leads.

Deploy this the same way the existing `telegram-relay` service is deployed
(a small standalone Node process on a VPS) — it does not need to live on
the same box as WordPress.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check |
| POST | `/transcribe` | multipart `audio` file -> `{ text, language }` (OpenAI Whisper) |
| POST | `/extract-intent` | `{ transcript }` -> fixed-shape JSON (category, urgency, language, summary) |
| GET | `/match` | `?category_id=&lat=&lng=&language=&limit=` -> ranked businesses (proxies WP) |
| POST | `/leads` | Create + deliver a lead (proxies WP `POST /leads`) |
| POST | `/leads/:id/send-email` | Send the (optionally edited) auto-drafted email |
| PATCH | `/leads/:id/status` | Business marks a lead viewed/contacted/closed |

## Typical request flow (matches the 7-screen customer prototype)

1. App records audio -> `POST /transcribe` -> `{ text }`.
2. App sends that text -> `POST /extract-intent` -> `{ category_id, summary, language_requested, urgency, ... }`.
3. App calls `GET /match?category_id=...&lat=...&lng=...&language=...` -> ranked business list (Results/Compare screens).
4. Customer picks one -> app calls `POST /leads` with the transcript + intent JSON + chosen `business_id` + `channel` (call/email/whatsapp).
5. If `channel=email`, the app shows the WP-generated draft (EmailPreview screen); if the customer edits it, `POST /leads/:id/send-email` with the edited text before actually sending.
6. Business dashboard app screen polls `GET {WP_BASE_URL}/wp-json/globallink/v1/businesses/{id}/leads` directly (no need to route that read through this service) and calls `PATCH /leads/:id/status` here to update status.

## Setup

```bash
cp .env.example .env   # fill in WP_BASE_URL, WP_SERVICE_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
npm install
npm start               # or: npm run dev  (auto-restart on file change)
```

Requires Node 18+ (uses `node:fetch`-adjacent APIs indirectly via `axios`/`openai`; no native fetch is used directly, so Node 18 or 20 both work).

### Getting the WordPress auth value (WP_SERVICE_KEY)

The `globallink-leads` plugin generates its own random secret key the
moment it's activated — no server access needed. In wp-admin, go to
**GlobalLink Leads → تنظیمات**, copy the key shown there, and paste it into
`WP_SERVICE_KEY`. This is the preferred method because it works regardless
of hosting setup.

If your host DOES support WordPress core's Application Passwords feature
(wp-admin → Users → your user → Application Passwords) and you'd rather use
that instead, leave `WP_SERVICE_KEY` empty and fill in `WP_APP_USERNAME` /
`WP_APP_PASSWORD` — `wpClient.js` falls back to that automatically. Many
hosts and security plugins (Wordfence and similar) hide or disable
Application Passwords, which is why the service key exists as the default.

### Swapping providers

- STT: only OpenAI Whisper is implemented (`src/services/stt.js`). Google
  Cloud STT was the documented fallback in the plan doc — add a branch there
  if Whisper's Persian accuracy or pricing don't work out.
- NLU: both Anthropic and OpenAI chat-completions are implemented
  (`src/services/nlu.js`) — toggle with `NLU_PROVIDER` in `.env`. The prompt
  itself (`buildPrompt`) is provider-agnostic.

## What's intentionally NOT here

- No database — everything durable lives in WordPress via the REST API.
- No payment logic — subscriptions/Stripe live entirely in the
  `globallink-leads` plugin.
- No push-notification token storage — that's a `wp_user_id` <-> Expo token
  mapping the mobile app + WordPress own (see the plugin's
  `gl_leads_send_push` hook).
