# Kusoma

Independent tutors in Kenya only see a student for a few hours a week. Between sessions, homework sits unanswered, practice does not follow the CBC topic they assigned, and parents get little besides “they’re doing fine.” Generic chatbots do not know Grade 5 Maths strands, and tutors have no simple way to see who engaged, where a child is stuck, or to send a weekly note home.

Kusoma closes that gap: the tutor assigns a real CBC Mathematics topic, the student practices and gets homework help in chat (identify by phone, no login), and the tutor sees progress and can share a parent report. Tutoring is grounded in Kenya’s curriculum via a separate CBC API.

Tutors get a PWA dashboard (roster, assignments, engagement, weekly parent-report drafts). Claude runs on Amazon Bedrock. Chat sessions live in Redis; scheduled nudges and reports run in a worker. Auth and data sit in Supabase.

Student chat is web-first; the messaging layer is built so WhatsApp can be added later without changing tutoring logic.

## Stack

- **Next.js 16.3.3** (App Router, React 19, `proxy.ts` instead of `middleware.ts`), TypeScript, Tailwind CSS v4
- **Supabase** — Postgres, Auth (tutor accounts), Storage (`homework-images` bucket)
- **Drizzle ORM** + `drizzle-kit` for schema and migrations (`postgres` driver)
- **Amazon Bedrock** via `@anthropic-ai/bedrock-sdk` — Claude Sonnet 4.6 for problem generation, answer marking, image OCR and report drafts. There is no Anthropic API key; credentials are AWS IAM or a Bedrock bearer token
- **Redis** (`ioredis`) — student chat sessions and rate limits; **BullMQ** for scheduled jobs
- **CBC curriculum API** — external HTTP service (`/v1/curriculum/...`, `/v1/nodes/...`, search endpoints) for curriculum trees and content

## Prerequisites

- Node.js 20+ and npm
- A Supabase project (Postgres + Auth + Storage)
- Redis — local (`redis://127.0.0.1:6379`) or hosted (Upstash / Render)
- An AWS account with Bedrock access to Claude Sonnet 4.6 in your region (`bedrock:InvokeModel`)
- Access to the CBC curriculum API (base URL + key)

## Environment variables

Copy `.env.example` to `.env.local`. The worker and helper scripts load `.env.local` explicitly.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser + server clients) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key for browser/session clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client — homework image uploads and signed URLs. Server only |
| `DATABASE_URL` | Postgres connection for the app. Transaction pooler, port 6543 |
| `DATABASE_DIRECT_URL` | Session pooler (port 5432) used by `drizzle-kit`; falls back to `DATABASE_URL` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | IAM credentials for Bedrock. Skipped when `AWS_BEARER_TOKEN_BEDROCK` is set |
| `AWS_REGION` | Bedrock region, e.g. `eu-central-1`. Without it no Claude client is built at all |
| `AWS_SESSION_TOKEN` | Optional — for temporary credentials |
| `AWS_BEARER_TOKEN_BEDROCK` | Optional — Bedrock API key used instead of IAM keys |
| `CLAUDE_MODEL` | Optional inference profile override. Defaults to `global.anthropic.claude-sonnet-4-6`; try `eu.` or `us.` prefixes if global CRIS is not enabled |
| `CBC_API_URL` | Base URL of the CBC curriculum API |
| `CBC_API_KEY` | Bearer token for the CBC API |
| `REDIS_URL` | Chat session store, chat rate limiting, BullMQ queues |
| `CHAT_SESSION_SECRET` | HMAC secret for the signed student chat cookie. Must be at least 32 characters |
| `CHAT_MIN_SECONDS_BETWEEN_MESSAGES` | Per-student chat throttle. Default `3` |
| `CHAT_DAILY_MESSAGE_CAP` | Per-student daily message cap. Default `80` |
| `APP_URL` | App origin. Default `http://localhost:3000` |
| `NODE_ENV` | `development` enables `/api/jobs/run` and unregisters the service worker |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL` | Read into config but unused — see [Not built yet](#not-built-yet). Leave blank |

[src/lib/env.ts](src/lib/env.ts) validates env at startup (via [src/instrumentation.ts](src/instrumentation.ts)). Two things to know:

- `KUSOMA_PHASE` is `1`, so only the Supabase vars and `DATABASE_URL` are enforced at boot. The Bedrock, CBC, Redis and chat-secret vars are in the Phase 2 list and are not checked at startup — a missing one surfaces when chat, curriculum or a job first runs.
- `next build` is detected and skips the check (placeholders stand in), so a green build does **not** mean the deploy is configured. Set the real values on the host.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in values

npm run db:migrate           # applies drizzle/0000_clever_mach_iv.sql
npm run dev                  # http://localhost:3000
```

Two things the migration does **not** cover — do them once in Supabase:

1. Run [supabase/rls.sql](supabase/rls.sql) in the SQL editor (or against `DATABASE_DIRECT_URL`). It grants `authenticated` / `service_role`, revokes `anon`, and adds per-tutor row policies. It is idempotent.
2. Create a Storage bucket named `homework-images` — chat image uploads go there using the service role key.

Other scripts:

```bash
npm run db:generate          # regenerate SQL after editing src/lib/db/schema.ts
npm run db:studio
npm run redis:ping           # verify REDIS_URL
npm run chat:session-verify  # sanity-check CHAT_SESSION_SECRET signing
npm run build && npm run start
npm run lint
```

## Routes

### Pages

| Route | Notes |
| --- | --- |
| `/` | Landing; links to tutor sign-in and student chat |
| `/signup`, `/login`, `/login/verify`, `/auth/callback` | Tutor auth — email + password, email magic link, or SMS OTP |
| `/onboarding` | Tutor profile and first student; required before the dashboard unlocks |
| `/dashboard` | Summary cards |
| `/students`, `/students/[id]`, `/students/[id]/messages` | Roster; detail with topic performance, activity and assignment panel; chat transcript |
| `/reports`, `/reports/[id]` | Draft parent reports; editor with approve/send |
| `/payments` | Current-month overview, record a payment, history |
| `/chat` | Student chat — phone identification, then messaging |
| `/offline` | Service worker fallback (the SW registers in production only) |

[src/proxy.ts](src/proxy.ts) refreshes the Supabase session on tutor routes and skips `/chat`, `/api/chat/*`, `/api/webhooks/*` and `/api/health/*`. The `(tutor)` layout redirects anyone who is not an onboarded tutor.

### API

Tutor-authenticated (`requireTutor`):

| Route | Methods |
| --- | --- |
| `/api/auth/signup`, `/api/auth/login`, `/api/auth/verify`, `/api/auth/callback`, `/api/auth/logout` | `POST` |
| `/api/auth/me` | `GET`, `PATCH` |
| `/api/onboarding/status` | `GET` |
| `/api/onboarding/complete` | `POST` |
| `/api/dashboard/summary` | `GET` |
| `/api/students` | `GET`, `POST` |
| `/api/students/[id]` | `GET`, `PATCH`, `DELETE` |
| `/api/students/[id]/assignments` | `GET`, `POST` |
| `/api/students/[id]/messages`, `/api/students/[id]/problems`, `/api/students/[id]/performance` | `GET` |
| `/api/assignments/[id]` | `PATCH` |
| `/api/curriculum`, `/api/curriculum/[grade]/[subject]` | `GET` — proxies the CBC API; subject defaults to `mathematics` |
| `/api/reports` | `GET` |
| `/api/reports/[id]` | `GET`, `PATCH` |
| `/api/reports/[id]/send` | `POST` |
| `/api/payments` | `GET`, `POST` |
| `/api/payments/[id]` | `PATCH` |
| `/api/payments/history` | `GET` |
| `/api/jobs/run` | `POST` — dev only; returns 404 when `NODE_ENV=production` |

Student chat (signed cookie + Redis session, `requireChatSession`):

| Route | Methods |
| --- | --- |
| `/api/chat/identify` | `POST` — phone lookup; returns candidates when several students share a number |
| `/api/chat/select-student` | `POST` |
| `/api/chat/message` | `POST` — JSON `{ body }` or multipart with `image`; runs the AI turn synchronously (`maxDuration = 60`) |
| `/api/chat/messages` | `GET` — transcript polling |
| `/api/chat/logout` | `POST` |

Other:

| Route | Methods |
| --- | --- |
| `/api/health/cbc` | `GET` — CBC API reachability check |
| `/api/webhooks/mpesa` | `GET`, `POST` — returns 501, not enabled |

## Worker

BullMQ jobs run in a separate process, not inside `next dev`. [src/worker/index.ts](src/worker/index.ts) loads `.env.local` and needs `REDIS_URL` and `DATABASE_URL`; report drafting additionally reads the AWS variables from the same file.

```bash
npm run worker                          # long-running: registers schedulers and workers
npm run worker:once -- practice_nudge   # run one job and exit
npm run worker:once -- weekly_report
npm run worker:once -- payment_reminder
```

Schedules (cron patterns are UTC; the jobs themselves compute Africa/Nairobi dates):

| Queue | Pattern | Job |
| --- | --- | --- |
| `daily-practice` | `*/15 * * * *` | Nudges students with an active assignment whose nudge time falls in the window; deduped per Nairobi day |
| `weekly-report` | `0 7 * * 0` | Drafts a 7-day parent report per student via Claude, saved with status `draft`; falls back to a templated summary when Bedrock is not configured |
| `payment-reminder` | `0 7 1 * *` | Messages students whose current-month payment is still `pending` |

In development the same three job functions can be triggered over HTTP: `POST /api/jobs/run` with `{ "job": "practice_nudge" }`.

## Not built yet

Worth knowing before demoing:

- **WhatsApp** — [WhatsAppClient](src/lib/messaging/whatsapp-client.ts) is a named stub whose methods reject. `WebChatClient` is the only live channel, and "sending" a message means inserting an outbound `messages` row the student sees on their next poll. There are no Meta webhooks.
- **M-Pesa / Daraja** — `/api/webhooks/mpesa` returns 501 and [src/lib/payments/index.ts](src/lib/payments/index.ts) is empty. Payments are recorded manually by the tutor (amount, month, status, optional receipt number); nothing initiates an STK push or reconciles a real transaction.
- **Parent report delivery** — approving and sending a report flips its status to `sent` and writes a note into the student's chat thread. Nothing reaches the guardian's phone; `guardians.receives_reports` is stored but unused.
- **Auth channels** — SMS OTP only works if the Supabase project has an SMS provider configured. Email magic link and email + password work as-is.
- **CBC dependency** — curriculum browsing, topic assignment and CBC-sourced content all call the external CBC API. Without `CBC_API_URL` / `CBC_API_KEY` those paths return a `not_configured` error rather than degrading.
- **Bedrock dependency** — without `AWS_REGION` plus credentials, no Claude client is constructed and chat returns a 503 (`Claude is not configured`).
