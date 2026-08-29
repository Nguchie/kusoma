# Kusoma — Implementation Guide

**Master spec:** `KUSOMA_System_Design.md`  
**This file:** step-by-step how to build it. Do not skip a numbered step. If a later step needs something earlier, that earlier step is listed under **Depends on**.

If this guide and the system design disagree, **follow the system design** and update this guide.

---

## How to use this as a group

1. Pick a **step owner** before starting the step. One person drives; others review the **Done when** checklist.
2. Finish the **Done when** list before moving on. Partial work blocks the next person.
3. Merge into `main` (or shared `dev`) after each **checkpoint** (end of a phase, or after a marked merge point).
4. Parallel work is allowed only where a step says **Can run in parallel with**. Everything else is sequential.
5. Keep secrets in `.env.local` / Railway env vars. Never commit keys.

**Suggested roles** (from system design §16):

| Role | Owns |
|------|------|
| **Infra** | Accounts, Railway, Redis, env vars, migrations on hosted DB |
| **Backend** | Drizzle schema, service layer, API routes, CBC client, AI orchestrator, workers |
| **Tutor UI** | PWA pages: onboarding, dashboard, students, reports, payments |
| **Chat UI** | Student chat page, identify/select, polling, image upload |
| **CBC / QA** | Confirm CBC API is live and seeded; test homework + practice paths; fallbacks |

Two people can build UI against the API shapes in system design §11 **after Step 1.12** (route stubs exist), even if the real logic lands later.

---

## Checkpoint 0 — Before any code

### Step 0.1 — Read the master spec

**Owner:** everyone  
**Depends on:** nothing

Read `KUSOMA_System_Design.md` sections 0–2, 13, 15, 16. Agree as a group:

- Single Next.js app (tutor PWA + student chat + API).
- No local curriculum DB; CBC API at runtime.
- Chat is web first; `WhatsAppClient` is a stub only (out of scope).
- M-Pesa Daraja live integration is out of scope; Phase 4 is **manual payment tracking**.
- CBC API must be deployed and seeded with **Mathematics Grade 5** before Phase 2.

**Done when:** everyone can explain those five points out loud.

---

### Step 0.2 — Accounts and access

**Owner:** Infra  
**Depends on:** 0.1  
**Can run in parallel with:** 0.3

Create or confirm access (share credentials via a password manager, not chat):

| Service | Why |
|---------|-----|
| GitHub (this repo) | Source of truth |
| Supabase | Postgres 15, Auth, Storage, RLS |
| Railway | Web service + later worker; Redis |
| Anthropic | Claude (`claude-sonnet-4-6`) |
| CBC Curriculum API | URL + API key; Maths Grade 5 seeded |
| (Later) Safaricom Daraja | Not needed until you leave “out of scope”; skip for this build |

**Done when:** the group has a shared list of who owns which login.

---

### Step 0.3 — Confirm CBC API prerequisite

**Owner:** CBC / QA  
**Depends on:** 0.2  
**Must complete before:** Phase 2 (system design §13)

From a machine with the key:

```bash
# Replace with real values. Expect JSON tree for Grade 5 Mathematics.
curl -sS -H "Authorization: Bearer $CBC_API_KEY" \
  "$CBC_API_URL/v1/curriculum/mathematics/5" | head
```

Also confirm (or ask the CBC team):

- `POST /v1/search` accepts `{ query, grade, subject, limit }`
- `GET /v1/nodes/{id}` returns strand / sub-strand / learning outcome / description
- `POST /v1/content/search` supports `content_type`: `exam_question` and `worked_example`

If Grade 5 Maths is empty, **stop Phase 2** until it is seeded. Phase 1 can still proceed.

**Done when:** Grade 5 Mathematics curriculum returns a tree. Note whether any exam questions / worked examples exist (affects how often AI fallback is used).

---

### Step 0.4 — Local tools

**Owner:** everyone who will write code  
**Depends on:** nothing  
**Can run in parallel with:** 0.2, 0.3

Install:

- Node.js 20+ (`node -v`)
- pnpm or npm (this guide uses **npm**; pick one and stick to it)
- Git
- A code editor

**Done when:** `node -v` shows 20 or higher.

---

## Phase 1 — Foundation

**Phase deliverable (system design §13):** Tutor can sign up, log in, manage a student roster.

---

### Step 1.1 — Initialize Next.js (App Router, TypeScript)

**Owner:** Backend or Infra  
**Depends on:** 0.4  

In the repo root (`kusoma`), the folder currently only has the design docs. Create the app **in place** (or in a subfolder if the group prefers — default: **repo root is the Next.js app**).

```bash
cd /path/to/kusoma
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

If the directory is not empty, create-next-app may refuse. Then either:

- init in a temp folder and move files into the repo, **keeping** `KUSOMA_System_Design.md` and this guide, or
- answer the CLI prompts to proceed in the existing folder.

**Choices to match the spec:**

- App Router: yes
- TypeScript: yes
- `src/` directory: yes (keeps `src/app`, `src/lib`, `src/server` clear for a group)

**Done when:** `npm run dev` starts and `http://localhost:3000` loads.

---

### Step 1.2 — Folder layout (create empty structure)

**Owner:** Backend  
**Depends on:** 1.1  

Create this layout so everyone knows where files go. Empty `index.ts` / `.gitkeep` is fine until later steps fill them.

```
src/
  app/
    (tutor)/                 # tutor PWA routes (auth-gated)
      dashboard/
      students/
      reports/
      payments/
      onboarding/
    chat/                    # student chat (not tutor auth)
    api/
      auth/
      onboarding/
      students/
      assignments/
      curriculum/
      reports/
      payments/
      dashboard/
      chat/
      webhooks/
        mpesa/
  components/
    tutor/
    chat/
    ui/
  lib/
    db/                      # Drizzle client + schema
    supabase/                # browser + server clients
    cbc/                     # CBC API wrapper
    messaging/               # MessagingClient
    ai/                      # orchestrator, prompts
    payments/
    reports/
    jobs/                    # queue producers (web app)
  server/
    services/                # business logic used by API + worker
  worker/                    # Railway worker entry (Phase 4)
  types/
```

Add a root `.gitignore` entries if missing:

```
.env
.env.local
.env*.local
node_modules
.next
```

**Done when:** the folders exist and the group agrees this is the map.

---

### Step 1.3 — Environment variable template

**Owner:** Infra  
**Depends on:** 1.1  

Create `.env.example` (committed) and `.env.local` (not committed) matching system design §14:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LLM
ANTHROPIC_API_KEY=

# CBC Curriculum API
CBC_API_URL=
CBC_API_KEY=

# Redis (needed Phase 2 session store + Phase 4 jobs)
REDIS_URL=

# M-Pesa (Phase 4+; leave blank this build)
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=

# App
APP_URL=http://localhost:3000
NODE_ENV=development

# Chat rate limits (system design §12.4)
CHAT_MIN_SECONDS_BETWEEN_MESSAGES=3
CHAT_DAILY_MESSAGE_CAP=80

# Signed student chat cookie
CHAT_SESSION_SECRET=
```

Generate `CHAT_SESSION_SECRET` (32+ random bytes, hex or base64).

Create `src/lib/env.ts` that reads these at startup and **throws** if required vars are missing for the current phase:

- Phase 1 required: Supabase URL, anon key, service role
- Phase 2 also: `ANTHROPIC_API_KEY`, `CBC_API_URL`, `CBC_API_KEY`, `CHAT_SESSION_SECRET`, `REDIS_URL`

**Done when:** `.env.example` is in git; `.env.local` is filled for Phase 1 on each developer machine.

---

### Step 1.4 — Supabase project

**Owner:** Infra  
**Depends on:** 0.2, 1.3  

1. Create a Supabase project (region close to Kenya / Railway, e.g. `eu-west` or `eu-central` if no Africa option).
2. Copy Project URL, anon key, service role key into `.env.local`.
3. Auth: enable **Phone** OTP and/or **Magic link** (Email). System design: **no passwords**.
4. Auth URL config: add `http://localhost:3000` and later the Railway `APP_URL`.
5. Storage: create a private bucket named `homework-images` (used in Phase 2). Skip upload policies until Step 2.x.

**Done when:** the dashboard shows the project; keys work in `.env.local`.

---

### Step 1.5 — Install data layer packages

**Owner:** Backend  
**Depends on:** 1.1, 1.4  

```bash
npm install drizzle-orm postgres @supabase/supabase-js @supabase/ssr
npm install -D drizzle-kit dotenv
```

**Done when:** packages are in `package.json`.

---

### Step 1.6 — Drizzle config and DB client

**Owner:** Backend  
**Depends on:** 1.5  

1. Add `drizzle.config.ts` at repo root pointing at `src/lib/db/schema.ts` and the Postgres URL.

   Use **Supabase Database → Connection string**. Prefer the **pooled** URI for the Next.js app (port 6543 / pooler) and **direct** URI for `drizzle-kit migrate` if pooler causes migration issues.

2. Add to `.env.local`:

```bash
DATABASE_URL=           # pooled, for the app
DATABASE_DIRECT_URL=    # direct, for migrations (optional but recommended)
```

3. Create `src/lib/db/index.ts` — Drizzle client using `postgres` + `DATABASE_URL`.
4. Add npm scripts:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:studio": "drizzle-kit studio"
```

**Done when:** `npx drizzle-kit generate` can run once a schema file exists (next step).

---

### Step 1.7 — Database schema (all nine tables)

**Owner:** Backend  
**Depends on:** 1.6  
**Source of truth:** system design §3 — copy column names, checks, indexes, and comments. Do not invent extra tables.

Create `src/lib/db/schema.ts` with Drizzle equivalents of:

1. `tutors`
2. `students`
3. `guardians`
4. `assignments`
5. `messages`
6. `practice_problems`
7. `student_performance`
8. `parent_reports`
9. `payments`

Rules from the spec:

- `tutors.user_id` → `auth.users(id)` `ON DELETE CASCADE`
- No FK from `cbc_node_id` / `cbc_content_chunk_id` to a local curriculum table (there is none)
- Check constraints exactly as in §3 (`grade` 1–9, `difficulty`, `status`, `mode`, `channel`, etc.)
- Indexes: `idx_students_phone`, `idx_students_tutor`, `idx_assignments_student_status`, `idx_messages_student_time`, `idx_problems_*`, `idx_payments_tutor_month`
- `student_performance` unique `(student_id, cbc_node_id)`

Also add `updated_at` triggers in SQL migration if you want DB-side updates; otherwise set `updated_at` in application code on every write.

**Done when:** schema file matches §3; group reviews column-by-column once.

---

### Step 1.8 — Generate and run migrations

**Owner:** Backend + Infra  
**Depends on:** 1.7  

```bash
npm run db:generate
npm run db:migrate
```

Confirm in Supabase Table Editor: all nine tables exist.

If `auth.users` reference fails, ensure the migration runs in a context that can reference `auth.users` (Supabase SQL editor / drizzle with sufficient privileges).

**Merge point:** schema is now the contract. Frontend can type against it.

**Done when:** nine tables visible in Supabase; a second teammate can migrate a fresh DB from the same files.

---

### Step 1.9 — Row Level Security (RLS)

**Owner:** Backend + Infra  
**Depends on:** 1.8  
**Source:** system design §12.2

Write a SQL file `supabase/rls.sql` (run in Supabase SQL editor) that:

1. Enables RLS on all nine tables.
2. Policies: a tutor (JWT `auth.uid()`) can only read/write rows belonging to them:
   - `tutors`: `user_id = auth.uid()`
   - `students`: `tutor_id` in that tutor’s row
   - `guardians`, `assignments`, `messages`, `practice_problems`, `student_performance`, `parent_reports`: via `student_id` → `students.tutor_id`
   - `payments`: `tutor_id` matches the tutor
3. Service role (worker, some server routes) **bypasses RLS** — never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

**Done when:** logged in as tutor A, tutor B’s students are not visible from the client using the anon key. Server routes that must cross tutors (none in Phase 1) use the service role only in the worker later.

---

### Step 1.10 — Supabase clients (browser vs server)

**Owner:** Backend  
**Depends on:** 1.4, 1.9  

Create:

- `src/lib/supabase/client.ts` — browser client (`@supabase/ssr` browser)
- `src/lib/supabase/server.ts` — server client (cookies) for App Router
- `src/lib/supabase/admin.ts` — service role, **server only**, never imported from client components

Cookie/session pattern: follow current `@supabase/ssr` Next.js App Router docs (middleware + `updateSession`).

Add `src/middleware.ts`:

- Refresh tutor session on `/dashboard`, `/students`, `/reports`, `/payments`, `/onboarding`, `/api/*` except `/api/chat/*` and `/api/webhooks/*`
- Do **not** require tutor JWT on `/chat` or `/api/chat/*`

**Done when:** a test page can `getUser()` on the server after login (login built in next step).

---

### Step 1.11 — Tutor auth API and login UI

**Owner:** Backend + Tutor UI  
**Depends on:** 1.10  
**API shapes:** system design §11.1

Implement:

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/api/auth/signup` | Create Supabase user (phone OTP or magic link). After auth user exists, insert `tutors` row (`display_name`, `phone`, `user_id`). |
| POST | `/api/auth/login` | Request magic link or phone OTP (no password). |
| GET | `/api/auth/me` | Current tutor profile from `tutors` joined via `user_id`. 401 if no session. |

UI (minimal is enough for Phase 1):

- `/login` — phone or email, “send code / send link”
- `/auth/callback` — exchange code for session (magic link)
- OTP verify screen if using phone

After first successful login, if no `tutors` row exists, create it (signup path).

**Done when:** a new person can sign up, log in, and `GET /api/auth/me` returns `display_name` and `phone`. Logout works.

---

### Step 1.12 — Students + guardians CRUD API

**Owner:** Backend  
**Depends on:** 1.11  
**API shapes:** system design §11.1

All routes: require tutor JWT; scope with `tutor_id` (RLS + explicit `WHERE`).

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/students` | List students for this tutor, include latest activity if available (null until messages exist). |
| POST | `/api/students` | Body: `first_name`, `grade` (1–9), `phone`, optional guardian `{ display_name, phone, receives_reports }`. |
| GET | `/api/students/:id` | Profile; `active` assignment if any; performance placeholder empty. |
| PATCH | `/api/students/:id` | Update name, grade, phone, `nudge_time`, `is_active`. |
| DELETE | `/api/students/:id` | Soft delete: `is_active = false`. |

Onboarding stubs (full flow is Phase 3):

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/onboarding/status` | `complete` if `tutors.onboarding_completed_at` set; else `profile` / `student` / `assignment` based on data. |
| POST | `/api/onboarding/complete` | Set `onboarding_completed_at = now()`. |

**Done when:** with REST client or UI, tutor can add, list, edit, and deactivate a student and optional guardian. Second tutor cannot see the first tutor’s students.

---

### Step 1.13 — Thin tutor UI for roster (Phase 1 minimum)

**Owner:** Tutor UI  
**Depends on:** 1.12  
**Can run in parallel with:** 1.14 once 1.12 is stubbed  

Build only what Phase 1 needs (full dashboard is Phase 3):

- `/students` — list + add student form
- `/students/[id]` — edit + deactivate

Use the APIs from 1.12. No curriculum browser yet.

**Done when:** a non-developer tutor-role teammate can add a student using the UI.

---

### Step 1.14 — CBC API client wrapper

**Owner:** Backend  
**Depends on:** 1.3  
**Can run in parallel with:** 1.7–1.13  
**Source:** system design §5.4, §5.6

Create `src/lib/cbc/client.ts`:

- Base URL + `CBC_API_KEY` header
- Timeouts: **3–4s** for search (homework path); **5s** for curriculum tree
- Methods (names can vary; behavior cannot):
  - `searchCurriculum({ query, grade, subject, limit })` → `POST /v1/search`
  - `getCurriculumTree(subject, grade)` → `GET /v1/curriculum/{subject}/{grade}`
  - `getNode(id)` → `GET /v1/nodes/{id}`
  - `searchContent({ query, grade, subject, content_type, cognitive_level?, limit })` → `POST /v1/content/search`
- On timeout/network error: return a typed `CbcError` / `null` — **never throw unhandled into the UI**
- All later CBC calls go **only** through this module

Add a tiny script or route `GET /api/health/cbc` (dev only) that calls the Grade 5 tree with 5s timeout.

**Done when:** health check succeeds against the real CBC API; timeout can be demoed by pointing at a black hole URL.

---

### Step 1.15 — Railway web service (skeleton)

**Owner:** Infra  
**Depends on:** 1.1, 1.3  

1. New Railway project; connect this GitHub repo.
2. One service: **web** — build `npm run build`, start `npm start` (Next.js).
3. Set env vars from §14 (Phase 1 subset + `DATABASE_URL`).
4. `APP_URL` = Railway public URL.
5. Add that URL to Supabase Auth redirect allow list.

Worker service is **not** created until Phase 4.

**Done when:** production URL loads; login works against production Supabase (or shared staging).

---

### Phase 1 checkpoint

**Owner:** QA  

- [ ] Tutor signs up and logs in (phone OTP or magic link)
- [ ] Tutor creates a student (and optional guardian)
- [ ] Tutor lists and deactivates a student
- [ ] RLS: tutor B cannot see tutor A data
- [ ] CBC wrapper health check works
- [ ] Railway web deploy is live

**Do not start Phase 2 until Step 0.3 (CBC Grade 5 Maths) is true.**

---

## Phase 2 — Chat core

**Phase deliverable:** Student opens chat, identifies by phone, gets homework help and topic practice (CBC content when available, AI otherwise).

---

### Step 2.1 — Redis for chat sessions

**Owner:** Infra  
**Depends on:** Phase 1 checkpoint  

Add Redis on Railway (or Upstash). Set `REDIS_URL` locally and on Railway.

Install:

```bash
npm install ioredis
```

Create `src/lib/redis.ts` — single shared connection helper.

**Done when:** a one-line ping from a server script returns `PONG`.

---

### Step 2.2 — MessagingClient interface

**Owner:** Backend  
**Depends on:** 1.2  
**Source:** system design §1, §15  

Create:

- `src/lib/messaging/types.ts` — `MessagingClient` with at least `sendText(toPhone: string, body: string): Promise<void>` (add `sendTemplate` if you need it for nudges later)
- `src/lib/messaging/web-chat-client.ts` — **active** implementation: persist outbound is already done in DB in §7.2; `WebChatClient.sendText` may no-op for HTTP request/response (the API returns the message) **or** write-through if you unify paths. Decide as a group: **the HTTP response is the student delivery for live chat; `sendText` is for worker-originated messages that only appear on poll.**
- `src/lib/messaging/whatsapp-client.ts` — **stub**: methods throw `Error('WhatsAppClient is not implemented')` or no-op with a log. Do not add Meta webhooks.
- `src/lib/messaging/index.ts` — export the active client (`WebChatClient`)

**Done when:** chat code imports `MessagingClient`, never WhatsApp APIs.

---

### Step 2.3 — Student chat session (signed cookie)

**Owner:** Backend  
**Depends on:** 2.1  
**Source:** §4, §11.2, §12.1  

Session is **not** Supabase Auth. It is a signed httpOnly cookie scoped to chat routes, mapping to exactly one `student_id`.

Implement:

1. Sign/verify with `CHAT_SESSION_SECRET` (e.g. HMAC or iron-session / jose).
2. Store session payload in Redis: `{ studentId, phone, expiresAt }` with TTL (e.g. 12 hours).
3. Cookie flags: `httpOnly`, `secure` in production, `sameSite=lax`, path `/` or `/chat` + `/api/chat`.

**Done when:** forging a cookie without the secret fails verification.

---

### Step 2.4 — Chat identify and select-student APIs

**Owner:** Backend  
**Depends on:** 2.3, 1.12  
**Source:** §4, §11.2  

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/api/chat/identify` | Body `{ phone }`. Lookup `students.phone` where `is_active`. If **one** student: set session cookie, return `{ student }`. If **several**: return `{ candidates: [{ id, firstName, grade }] }` **without** setting the final cookie (or set a short-lived “pending” token). If **none**: 404-style payload, no session. |
| POST | `/api/chat/select-student` | Body `{ studentId }` after shared-phone list. Verify that student is in the candidate set for that phone. Issue session cookie for that `student_id`. |

Phone matching: normalize (Kenya `+254` vs `07…`) in one helper used everywhere.

**Done when:** two students sharing a guardian phone can be disambiguated; session then only sees that student.

---

### Step 2.5 — Chat messages poll API

**Owner:** Backend  
**Depends on:** 2.3, 1.7  

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/chat/messages?since=` | Require chat session. Return messages for that `student_id` with `created_at > since`, oldest first. |

This is how worker nudges (Phase 4) appear. No websocket.

**Done when:** inserting a row in `messages` for that student shows up on the next poll.

---

### Step 2.6 — Image upload (homework photos)

**Owner:** Backend  
**Depends on:** 1.4 Storage bucket  

On `POST /api/chat/message` with multipart/image:

1. Auth via chat session
2. Upload to Supabase Storage `homework-images` / `{studentId}/{uuid}`
3. Store public or signed URL on `messages.image_url` and later `practice_problems.source_image_url`

Bucket should not be world-writable. Prefer signed URLs; service role upload from the API route.

**Done when:** an image lands in Storage and the message row has `content_type = 'image'` and `image_url`.

---

### Step 2.7 — Rate limiting on `/api/chat/message`

**Owner:** Backend  
**Depends on:** 2.1, 2.3  
**Source:** §12.4  

Per session token:

- Minimum interval: `CHAT_MIN_SECONDS_BETWEEN_MESSAGES` (default 3)
- Daily cap: `CHAT_DAILY_MESSAGE_CAP` per `student_id`

Use Redis keys `chat:rl:{studentId}:last` and `chat:rl:{studentId}:day:{YYYY-MM-DD}`.

Return 429 with a clear message; do not call Claude.

**Done when:** bursting messages is blocked; next day counter resets.

---

### Step 2.8 — Install Anthropic SDK and prompt templates

**Owner:** Backend  
**Depends on:** 1.3  

```bash
npm install @anthropic-ai/sdk
```

Create `src/lib/ai/prompts.ts` with the **exact** homework-help and topic-practice system prompts from system design §7.1 (template placeholders filled in code).

Create TypeScript types from §7.1:

- `StudentContext`
- `HomeworkHelpContext`
- `TopicPracticeContext`
- parsed JSON response types (`homework_guidance` | `homework_evaluation`, and `problem` | `evaluation` | `response` | `greeting`)

**Done when:** types compile; prompts are not paraphrased away from the spec rules (especially: do not solve for the student; short messages; language matching).

---

### Step 2.9 — Load student context helper

**Owner:** Backend  
**Depends on:** 1.7, 2.8  

`src/server/services/student-context.ts`:

- Student first name, grade
- Tutor `displayName`
- `student_performance` recent topics (common errors JSON)
- `streak_days`
- Last N `messages` (inbound/outbound) for the student

**Done when:** unit-test or a debug log shows a real student payload.

---

### Step 2.10 — Difficulty → cognitive_level map

**Owner:** Backend  
**Depends on:** nothing else  
**Source:** §6.3  

```ts
// foundational → recall,application
// intermediate → application,analysis
// advanced → analysis,evaluation,creation
```

One function in `src/lib/cbc/difficulty.ts`. Not a database table.

**Done when:** all three keys return the strings above.

---

### Step 2.11 — Topic practice: fetch or generate problem (§6.1)

**Owner:** Backend  
**Depends on:** 1.14, 2.8, 2.10  

Function `getNextPracticeProblem(student, assignment)`:

1. `POST` content search: `query = assignment.learning_outcome`, `grade`, `subject: "mathematics"`, `content_type: "exam_question"`, `cognitive_level` from §6.3, `limit: 5`
2. Filter out `practice_problems.cbc_content_chunk_id` already used for this student
3. If a unused CBC question remains: use `body` as problem, `answer` as `expected_answer`; `content_source = 'cbc_content'`
4. Else: Claude generates a problem scoped to the learning outcome; `content_source = 'ai_generated'`, `cbc_content_chunk_id = null`
5. Timeout/failure on CBC: treat as empty results → AI generate (same as §5.4 spirit)

**Done when:** a student with an assignment gets a problem; if CBC has no questions, AI path still works.

---

### Step 2.12 — Homework help: match curriculum + worked example (§5.2, §6.2)

**Owner:** Backend  
**Depends on:** 1.14, 2.8  

Function `prepareHomeworkHelp({ problemText, student })`:

1. If image: Claude Vision extracts `problemText` (~vision cost in §7.3)
2. `POST /v1/search` with 3–4s timeout, `limit: 3`, `subject: 'mathematics'`, student’s grade  
   On failure: `matchedNodes = []` (general tutoring prompt still runs)
3. `POST /v1/content/search` `content_type: "worked_example"`, `limit: 1`  
   If similarity ≥ 0.75, attach `referenceSolution.steps`
4. Build `HomeworkHelpContext` and call Claude with JSON response schema

**Done when:** text-only homework works with and without CBC; image homework extracts text then continues.

---

### Step 2.13 — `processAIResponse` (§7.2)

**Owner:** Backend  
**Depends on:** 1.7, 2.2, 2.8  

Implement the function from the spec, including:

1. Insert outbound `messages`
2. Insert `practice_problems` on `problem` / `homework_guidance`
3. Update latest problem on `evaluation` / `homework_evaluation`
4. Upsert `student_performance` on `(student_id, cbc_node_id)` with denormalized strand / sub-strand / learning outcome (§5.3)
5. `messagingClient.sendText` for paths that are not the same HTTP response

Parse Claude output as JSON; if parse fails, retry once or send a short fallback student message and log the error.

**Done when:** one homework turn writes message + problem + performance rows correctly.

---

### Step 2.14 — Inbound routing (§8)

**Owner:** Backend  
**Depends on:** 2.11, 2.12, 2.13  

`POST /api/chat/message` (sync, no queue):

1. Resolve student from session
2. Rate limit (2.7)
3. If image: store (2.6)
4. Mode:
   - Active assignment **and** pending unanswered problem → topic practice **evaluate**
   - Body is `start` (case-insensitive) **and** active assignment → topic practice **next problem** (§6.1)
   - Else → homework help (including images)
5. Claude + `processAIResponse`
6. Return `{ message: student_message, ... }` in the HTTP body
7. Insert inbound `messages` row (`direction: inbound`, `channel: web_chat`)

**Done when:** the three branches are covered by manual tests (below).

---

### Step 2.15 — Student chat page

**Owner:** Chat UI  
**Depends on:** 2.4, 2.5, 2.14 (can start against stubs after 2.4)  
**Source:** §9 is tutor; student UX is §4 + §8 + §11.2  

Routes under `/chat`:

1. Phone entry → `POST /api/chat/identify`
2. If multiple students → picker → `POST /api/chat/select-student`
3. Thread: list messages, poll `GET /api/chat/messages?since=`
4. Composer: text + file input for images
5. Special: sending `start` begins practice when an assignment exists

Keep the UI short-message friendly (mobile-first). PWA for **students** is optional; tutor PWA is Phase 3.

**Done when:** a teammate on a phone browser can identify and complete one homework exchange.

---

### Step 2.16 — Phase 2 test script (group)

**Owner:** QA  
**Depends on:** 2.15  

Use one tutor, two students (different phones), one shared phone pair, Grade 5 Maths assignment (create assignment via SQL or a temporary API if Phase 3 browser is not ready — **temporary:** `POST /api/students/:id/assignments` can be implemented here as a thin endpoint using CBC `getNode` + denormalized text, even though the browser is Phase 3).

**Recommended:** implement assignment create API in this step so practice can be tested (system design lists it under §11.1; UI is Phase 3).

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/api/students/:id/assignments` | Body `{ cbc_node_id, difficulty }`. Fetch node from CBC; insert denormalized `strand`, `sub_strand`, `learning_outcome`; set previous active assignment to `paused`. |
| PATCH | `/api/assignments/:id` | difficulty, status, notes |

Manual cases:

- [ ] Homework text → guidance, no full solution on first message
- [ ] Homework image → vision extract → guidance
- [ ] CBC down: still get help without matched nodes
- [ ] `start` with assignment → problem (CBC or AI)
- [ ] Answer problem → evaluation + `practice_problems` updated
- [ ] Shared phone → picker
- [ ] Rate limit 429
- [ ] Poll sees outbound messages

**Phase 2 checkpoint:** all boxes above.

---

## Phase 3 — Tutor platform

**Phase deliverable:** Tutor signs up, is guided through first student + topic, uses a full dashboard.

---

### Step 3.1 — Onboarding UI (§9.1)

**Owner:** Tutor UI  
**Depends on:** 1.11, 1.12, 2.16 assignment API, 1.14  

Linear steps, once, after first login (`onboarding_completed_at` null):

1. **Profile** — display name, phone → patch tutor
2. **Add first student** — name, grade, phone, optional guardian
3. **Assign a topic** — curriculum browser for that student’s grade, subject Mathematics only
4. **Done** — link to dashboard + **the URL/phone instructions for the student chat** (`APP_URL/chat`)

`GET /api/onboarding/status` drives which step. `POST /api/onboarding/complete` at the end.

Redirect: if incomplete, every tutor page except onboarding sends them back to `/onboarding`.

**Done when:** a new tutor account reaches dashboard with one student and one active assignment in ~15 minutes.

---

### Step 3.2 — Curriculum API proxy + browser UI (§5.2, §9.4, §11.1)

**Owner:** Backend + Tutor UI  
**Depends on:** 1.14  

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/curriculum` | Query `grade` + `subject` (default mathematics). Proxy tree. Timeout 5s. On error JSON `{ error: "Curriculum data is temporarily unavailable — try again in a moment" }` — **not** a blank page. |
| GET | `/api/curriculum/:grade/:subject` | Full tree. |

UI: tree Grade → strand → sub-strand → learning outcome; select node → create assignment (denormalized text from `GET /v1/nodes/{id}` at write time, §5.3).

**Done when:** Grade 5 Maths tree renders; assigning writes `assignments` with display text even if CBC is later down (dashboard still shows the text).

---

### Step 3.3 — Dashboard home (§9.2)

**Owner:** Tutor UI + Backend  

| Method | Path |
|--------|------|
| GET | `/api/dashboard/summary` |

Cards:

- Active students count
- Engagement today (students with inbound message today)
- Pending reports (`parent_reports.status = 'draft'`) — zero until Phase 4
- Overdue payments — zero / placeholder until Phase 4

Page: `/dashboard`

**Done when:** numbers match a known seed dataset.

---

### Step 3.4 — Student detail (§9.3)

**Owner:** Tutor UI  
**Depends on:** 2.13 performance writes  

Page `/students/[id]`:

**Top:** name, grade, current assignment, days since last activity (`student_performance.last_active_at` or last message).

**Middle:** unified topic performance — one row per `cbc_node_id`: strand/sub-strand, badge Homework / Practice / Both (derive from `practice_problems.mode`), accuracy, error patterns (`common_errors`), last engaged.

**Bottom tabs:**

- Homework Activity — chronological from problems/messages where `mode = homework_help`
- Practice Sessions — `mode = topic_practice`

**Actions:** assign topic (browser), view/send parent report (Phase 4 can be disabled), full message history.

**Done when:** a student who did both homework and practice shows one combined accuracy per topic.

---

### Step 3.5 — Message history view

**Owner:** Tutor UI  

| Method | Path |
|--------|------|
| GET | `/api/students/:id/messages` | Paginated, `created_at` desc |

Also:

| GET | `/api/students/:id/problems` |
| GET | `/api/students/:id/performance` |
| GET | `/api/students/:id/assignments` |

**Done when:** tutor can scroll the full chat log without using the student UI.

---

### Step 3.6 — PWA (tutor)

**Owner:** Tutor UI  
**Source:** tech stack `next-pwa` / Serwist  

- Web app manifest (name Kusoma, icons)
- Service worker: cache shell of tutor routes; **do not** cache API POST
- Installable on Android Chrome

**Done when:** “Add to Home Screen” works on a phone; dashboard loads offline shell (data may still need network).

---

### Phase 3 checkpoint

- [ ] New tutor onboarding end-to-end
- [ ] Curriculum timeout shows the exact unavailable message
- [ ] Student detail unified performance
- [ ] PWA install
- [ ] Assignment create pauses previous active assignment

---

## Phase 4 — Reports and payments

**Phase deliverable:** Automated nudges, weekly parent reports with tutor review, **manual** payment tracking (live Daraja out of scope, §15).

---

### Step 4.1 — BullMQ + second Railway service

**Owner:** Infra + Backend  
**Depends on:** 2.1  

```bash
npm install bullmq
```

Railway:

1. Redis already running
2. New service **worker** from same repo: start command e.g. `npm run worker` → `tsx src/worker/index.ts` or compiled `node dist/worker.js`
3. Worker env: `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS, §12.2)
4. Web service does **not** run workers

Queues (names from §10): `daily-practice`, `weekly-report`, `payment-reminder`

**Done when:** worker process stays up on Railway and connects to Redis.

---

### Step 4.2 — Repeatable schedules (EAT)

**Owner:** Backend  
**Source:** §10  

Kenya is UTC+3:

- Practice dispatcher: cron `0 12 * * *` UTC = 15:00 EAT (job then filters by each student’s `nudge_time` **or** run hourly and send when local time matches `nudge_time` — **implement per-student `nudge_time`**, default `15:00`)
- Weekly report: Sunday 10:00 EAT = `0 7 * * 0` UTC
- Payment reminder: 1st of month (define cron; send for outstanding balances)

Register repeatable jobs once (idempotent startup).

**Done when:** job keys exist in Redis; a forced `queue.add` runs the handler locally.

---

### Step 4.3 — `practice_nudge` job

**Owner:** Backend  
**Source:** §10  

For each **active** student with an **active** assignment:

- Insert `messages`: `mode: topic_practice`, `direction: outbound`, `contentType: template`, `channel: web_chat`, body like `Hi {firstName}, you have practice questions today. Open the chat to begin.`

Do not call WhatsApp. Student sees it on next poll.

**Done when:** chat poll shows the nudge; students without assignments are skipped.

---

### Step 4.4 — `weekly_report` job + AI draft

**Owner:** Backend  
**Source:** §10, §9.5  

For each active student with performance data:

- Claude drafts a parent-facing weekly summary (plain language, CBC topics, accuracy, effort)
- Insert `parent_reports`: `period_start` / `period_end` (week), `status: 'draft'`

**Done when:** drafts appear in DB Sunday (or on manual trigger in staging).

---

### Step 4.5 — Reports API and UI

**Owner:** Backend + Tutor UI  
**Source:** §11.1  

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/reports` | List pending/sent for this tutor’s students |
| GET | `/api/reports/:id` | Detail |
| PATCH | `/api/reports/:id` | Edit `report_body` or set `status: approved` |
| POST | `/api/reports/:id/send` | Only if approved. This build: mark `sent`, `sent_at`. Delivery to guardian: **write a `messages` row or store as sent text**; do **not** require WhatsApp. Optional: SMS later. |

UI: `/reports` — review, edit, approve, send.

**Done when:** tutor can edit a draft and mark sent.

---

### Step 4.6 — Payment tracking (manual)

**Owner:** Backend + Tutor UI  
**Source:** §15, §9.5, §11.1  

Skip Daraja STK and `/api/webhooks/mpesa` **or** leave webhook as `501` / no-op.

Implement:

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/payments` | Current month overview for tutor |
| GET | `/api/payments/history` | Paginated |
| POST | `/api/payments` (add if needed) | Manual: amount, student, `period_month`, status `completed` / `pending` |

Dashboard overdue card: pending for current `period_month`.

`payment_reminder` job: insert a guardian-facing message (chat or report note) for outstanding `pending` rows — still no M-Pesa API.

**Done when:** tutor can record “paid in cash / M-Pesa” manually and see history.

---

### Phase 4 checkpoint

- [ ] Nudge appears in student chat at/after nudge time
- [ ] Weekly draft reports land for review
- [ ] Tutor approve/send works without WhatsApp
- [ ] Manual payment row + overview
- [ ] Worker uses service role; tutors still isolated in the PWA

---

## Phase 5 — Pilot

**Owner:** whole group  
**Source:** §13 Phase 5  

### Step 5.1 — Seed the first real tutor

- Production Render + production Supabase
- Tutor completes onboarding
- Enroll real students (consent: phones, messages, no national IDs — §12.3)
- Give students `APP_URL/chat`

### Step 5.2 — Daily ops

- Watch engagement (dashboard)
- Spot-check AI: too much solving? wrong grade? language mix?
- CBC timeouts: how often fallback?
- Cost: compare to §7.3 (~$0.008 image homework, ~$0.005 practice)

### Step 5.3 — Fix what breaks

Log issues in GitHub Issues. Prefer fixing routing (§8), prompts (§7.1), and CBC timeouts (§5.4) before new features.

**Phase 5 checkpoint:** one tutor, real students, at least one week of homework + practice + one parent report reviewed.

---

## Parallel work map (do not start these early)

```
Time →
Infra:     0.2  1.4  1.8  1.9  1.15  2.1  4.1
Backend:   1.1–1.12  1.14  2.2–2.14  3.2 API  4.2–4.4
Tutor UI:  wait for 1.11 → 1.13  then 3.1–3.6  4.5–4.6
Chat UI:   wait for 2.4 stubs → 2.15
CBC/QA:    0.3 continuous, then 2.16, phase checkpoints
```

**Critical path:** 1.1 → schema → auth → students → CBC client → chat session → message pipeline → chat UI.

---

## Out of scope (do not implement “while we’re here”)

From system design §15:

- Real `WhatsAppClient`
- Local CBC replica / embeddings in Kusoma
- CBC types other than `worked_example` and `exam_question`
- Provenance UI (“KNEC 2019”)
- Multi-tutor academies
- Websocket chat
- Live M-Pesa Daraja

---

## Definition of done for any step

1. Code merged or on the shared branch
2. Env vars documented in `.env.example` if new
3. **Done when** checklist ticked in this file (or a shared tracker that copies these steps)
4. Next step’s **Depends on** is satisfied

When you finish a step, tick it here in a team copy or GitHub Project. Do not delete steps; mark them `[x]`.
Deploy on Render and add variables after the first deployment
