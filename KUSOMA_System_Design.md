# Kusoma — System Design

## 0. Overview

Kusoma is a platform for independent tutors in Kenya. A tutor manages their own roster of students, assigns each student a CBC (Competency-Based Curriculum) topic to work on, and gets a dashboard showing who's engaging and where they're struggling. Between in-person sessions, students get AI-assisted homework help and topic practice through a chat interface. Weekly progress reports go to parents, and payment tracking runs through M-Pesa.

For this build, the student-facing chat runs over a web interface rather than WhatsApp. The messaging layer is built behind an interface specifically so a different channel (WhatsApp, or anything else) can be added later without touching the tutoring logic — the web chat is the first implementation of that interface, not a permanent architectural decision.

Kusoma also connects to the CBC Curriculum API, a separate service that holds Kenya's curriculum structure and real content extracted from past exam papers and worked examples. That connection is central to how Kusoma's AI tutoring works and is covered in detail in §5 and §6.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        RAILWAY                                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Next.js App                             │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐   │   │
│  │  │ Tutor PWA   │  │ Student Chat │  │ API Routes     │   │   │
│  │  │ (App Router)│  │ (web         │  │ /api/*         │   │   │
│  │  │             │  │  interface)  │  │                │   │   │
│  │  │ /dashboard  │  │              │  │ - students     │   │   │
│  │  │ /students/* │  │ /chat        │  │ - assignments  │   │   │
│  │  │ /reports    │  │              │  │ - curriculum   │   │   │
│  │  │ /payments   │  │              │  │ - payments     │   │   │
│  │  │ /onboarding │  │              │  │ - chat         │   │   │
│  │  └─────────────┘  └──────┬───────┘  └───────┬────────┘   │   │
│  │                          │                   │            │   │
│  │                    ┌─────┴───────────────────┴─────┐      │   │
│  │                    │      Service Layer            │      │   │
│  │                    │  - AI Orchestrator            │      │   │
│  │                    │  - Messaging Client (interface)│      │   │
│  │                    │    └─ WebChatClient (active)  │      │   │
│  │                    │    └─ WhatsAppClient (stub)   │      │   │
│  │                    │  - Payment Service            │      │   │
│  │                    │  - Report Generator           │      │   │
│  │                    └──────────────────────────────┘       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────┐                                               │
│  │ Redis        │ ← BullMQ job queue (scheduled jobs)           │
│  └──────────────┘                                               │
│                                                                 │
│  ┌──────────────┐                                               │
│  │ Worker       │ ← Separate Railway service, same repo         │
│  │ Process      │   Processes: daily practice dispatch,         │
│  │              │   parent reports, payment reminders           │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌──────────────┐   ┌───────────────┐   ┌───────────────┐
   │  Supabase    │   │  Safaricom    │   │  CBC API      │
   │  - Postgres  │   │  Daraja API   │   │  (Railway)    │
   │  - Auth      │   │  (M-Pesa)     │   │  ← called     │
   │  - Storage   │   └───────────────┘   │  directly at  │
   └──────────────┘                       │  runtime (§5) │
          │                               └───────────────┘
          ▼
   ┌──────────────┐
   │  LLM API     │
   │  (Claude)    │
   └──────────────┘
```

### Why this shape

**Single Next.js app for the tutor dashboard, the student chat, and the API.** No CORS, no separate deploys, no version skew between frontend and backend. Railway runs Next.js as a persistent Node.js server, so API routes are always-on.

**A `MessagingClient` interface, not a hardcoded channel.** Every place the system needs to send a message to a student goes through this interface. `WebChatClient` is the implementation used for the student chat. `WhatsAppClient` exists as a named stub with the same interface, unimplemented — plugging in a real channel later is a matter of writing one class, not restructuring the tutoring logic.

**No webhook, no queue, for the student-facing chat.** A browser tab talking directly to the API can hold the connection open and wait for a response — there's no external platform imposing a response-time limit or requiring an async queue in between. The real-time chat path (homework help, topic practice) is a synchronous request/response.

**A separate worker process for scheduled jobs.** Daily practice nudges, weekly parent reports, and payment reminders are time-triggered rather than request-triggered, so they run in a separate Railway service consuming from Redis/BullMQ. This keeps the main web server responsive.

**Supabase for Postgres + Auth.** Managed Postgres with connection pooling, row-level security, and Supabase Auth for tutor login (phone OTP or magic link).

**No local curriculum database.** Kusoma does not maintain its own copy of curriculum data. It calls the CBC API directly, at runtime, for both curriculum structure and real content (§5, §6).

---

## 2. Tech Stack

| Layer              | Technology                        | Notes                                                              |
|--------------------|-----------------------------------|------------------------------------------------------------------------|
| Framework          | Next.js 14+ (App Router)          | Serves the tutor dashboard, student chat, and API in one deploy.       |
| Language           | TypeScript                        | End-to-end type safety from DB to frontend.                            |
| ORM                | Drizzle                           | Lightweight, SQL-close, good Supabase/Postgres support.                |
| Database           | Supabase (Postgres 15)            | Managed, connection pooling, RLS, Auth, Storage.                       |
| Auth               | Supabase Auth                     | Phone OTP or magic link. No passwords.                                 |
| Job Queue          | BullMQ + Redis                    | Reliable async processing with retries, for scheduled jobs only.       |
| Hosting            | Railway                           | Always-on Node.js. Two services: web + worker, same repo.              |
| Student messaging  | Web chat page in the Next.js app  | `MessagingClient` interface, `WebChatClient` active, `WhatsAppClient` stubbed. |
| LLM                | Anthropic Claude API (claude-sonnet-4-6) | Homework guidance, practice generation, structured output, cost-effective. |
| Curriculum & content | CBC Curriculum API              | Separate service. Called directly at runtime — no local replica (§5).  |
| Payments           | Safaricom Daraja API              | M-Pesa STK push, payment confirmation callbacks.                      |
| PWA                | next-pwa / Serwist                | Service worker, offline caching, manifest generation.                  |

There is no local vector database and no Kusoma-side embedding dependency. The CBC API owns curriculum search and content search entirely, including embedding the query text server-side — Kusoma sends plain text and gets back matches.

---

## 3. Database Schema

Nine tables.

```sql
-- ============================================================
-- Kusoma Database Schema
-- Supabase Postgres — references auth.users for tutor identity
-- ============================================================

-- 1. Tutors
-- Primary users. One row per registered tutor, linked to Supabase Auth.
CREATE TABLE tutors (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text NOT NULL,
    phone       text NOT NULL,
    is_active   boolean NOT NULL DEFAULT true,
    onboarding_completed_at timestamptz,     -- set once the guided setup flow (§9.1) finishes
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Students
-- Enrolled under a tutor. Identified by phone number in the chat interface.
CREATE TABLE students (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id    uuid NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    first_name  text NOT NULL,
    grade       smallint NOT NULL CHECK (grade BETWEEN 1 AND 9),
    phone       text NOT NULL,           -- identifies the student in the chat interface
    nudge_time  time DEFAULT '15:00',    -- when the daily practice nudge fires for this student
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_phone ON students(phone);
CREATE INDEX idx_students_tutor ON students(tutor_id);

-- 3. Guardians
-- Parent/guardian linked to a student. Receives weekly reports.
CREATE TABLE guardians (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    display_name    text NOT NULL,
    phone           text NOT NULL,
    receives_reports boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- 4. Assignments
-- Tutor assigns a student to work on a specific CBC topic.
-- The topic is identified by the CBC API's node ID. There is no local
-- curriculum table to join against (see §5), so the display text is
-- captured once, at assignment time, from the CBC API response.
CREATE TABLE assignments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    cbc_node_id         uuid NOT NULL,        -- CBC API's curriculum node ID; no local FK possible
    strand              text NOT NULL,
    sub_strand          text NOT NULL,
    learning_outcome    text NOT NULL,
    difficulty          text NOT NULL DEFAULT 'intermediate'
                        CHECK (difficulty IN ('foundational', 'intermediate', 'advanced')),
    status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'completed', 'paused')),
    tutor_notes         text,
    assigned_at         timestamptz NOT NULL DEFAULT now(),
    completed_at        timestamptz
);
CREATE INDEX idx_assignments_student_status ON assignments(student_id, status);

-- 5. Messages
-- Every chat message, inbound and outbound. The complete interaction log.
-- assignment_id is nullable: homework help interactions have no pre-configured assignment.
CREATE TABLE messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    assignment_id   uuid REFERENCES assignments(id),
    mode            text NOT NULL DEFAULT 'homework_help'
                    CHECK (mode IN ('homework_help', 'topic_practice')),
    direction       text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    content_type    text NOT NULL DEFAULT 'text'
                    CHECK (content_type IN ('text', 'image', 'template', 'button_reply')),
    body            text NOT NULL,
    image_url       text,                    -- Supabase Storage URL if the student sent a photo
    channel         text NOT NULL DEFAULT 'web_chat'
                    CHECK (channel IN ('web_chat', 'whatsapp')),
    wa_message_id   text,                    -- populated only when channel = 'whatsapp'
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_student_time ON messages(student_id, created_at DESC);

-- 6. Practice Problems
-- Tracks both AI-generated practice AND homework problems the student brought,
-- as well as which came from the CBC API's real content versus AI generation.
CREATE TABLE practice_problems (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id            uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    assignment_id         uuid REFERENCES assignments(id),          -- nullable for homework help
    detected_cbc_node_id  uuid,               -- curriculum node matched via CBC API search (homework help)
    mode                  text NOT NULL DEFAULT 'homework_help'
                          CHECK (mode IN ('homework_help', 'topic_practice')),
    content_source        text NOT NULL DEFAULT 'ai_generated'
                          CHECK (content_source IN ('ai_generated', 'cbc_content')),
    cbc_content_chunk_id  uuid,               -- CBC API content_chunks.id, when content_source = 'cbc_content'
    problem_text          text NOT NULL,
    source_image_url      text,               -- if the student sent a photo of their homework
    expected_answer       text,               -- from the CBC API when content_source = 'cbc_content';
                                               -- nullable for homework help (AI determines on the fly)
    student_answer        text,
    is_correct            boolean,
    error_type            text,               -- 'conceptual', 'computational', 'misread'
    error_detail          text,
    ai_explanation         text,
    created_at             timestamptz NOT NULL DEFAULT now(),
    attempted_at            timestamptz
);
CREATE INDEX idx_problems_student ON practice_problems(student_id, created_at DESC);
CREATE INDEX idx_problems_assignment ON practice_problems(assignment_id);
CREATE INDEX idx_problems_detected_node ON practice_problems(detected_cbc_node_id);

-- 7. Student Performance
-- Aggregated per student per curriculum topic, regardless of mode.
-- In topic_practice: tied to an assignment. In homework_help: tied to a
-- detected topic (no assignment). Both modes feed one unified accuracy
-- figure per topic. Display text is denormalized for the same reason as
-- Table 4 — there's no local curriculum table to join against.
CREATE TABLE student_performance (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id        uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    cbc_node_id       uuid NOT NULL,
    strand            text NOT NULL,
    sub_strand        text NOT NULL,
    learning_outcome  text NOT NULL,
    assignment_id     uuid REFERENCES assignments(id),       -- nullable for homework-derived rows
    total_problems    integer NOT NULL DEFAULT 0,
    correct_count     integer NOT NULL DEFAULT 0,
    common_errors     jsonb NOT NULL DEFAULT '[]',
    streak_days       integer NOT NULL DEFAULT 0,
    last_active_at    timestamptz,
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE(student_id, cbc_node_id)
);

-- 8. Parent Reports
-- AI-generated weekly summaries, reviewed by the tutor before dispatch.
CREATE TABLE parent_reports (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    period_start    date NOT NULL,
    period_end      date NOT NULL,
    report_body     text NOT NULL,
    status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'approved', 'sent')),
    sent_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- 9. Payments
-- M-Pesa payment records.
CREATE TABLE payments (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id                uuid NOT NULL REFERENCES tutors(id),
    student_id              uuid REFERENCES students(id),
    amount                  integer NOT NULL,     -- KES, whole units
    period_month            date NOT NULL,        -- first day of the billing month
    mpesa_checkout_request_id text,               -- from STK push initiation
    mpesa_receipt           text,                 -- from confirmation callback
    status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'completed', 'failed')),
    paid_at                 timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_tutor_month ON payments(tutor_id, period_month);
```

### Relationships

```
tutors 1──∞ students 1──∞ guardians
                     1──∞ assignments  ──(cbc_node_id → CBC API, no local FK)
                     1──∞ messages
                     1──∞ practice_problems  ──(detected_cbc_node_id, cbc_content_chunk_id → CBC API)
                     1──∞ student_performance  ──(cbc_node_id → CBC API)
                     1──∞ parent_reports
tutors 1──∞ payments ∞──1 students
```

`assignments`, `practice_problems`, and `student_performance` all hold a `uuid` referencing an ID that lives in the CBC API's own database. Postgres can't enforce a foreign key across two separate services, so these columns carry no `REFERENCES` constraint — referential integrity depends on the CBC API's node and content-chunk IDs not changing once assigned, not on a database-level check.

---

## 4. Student Identification

Students are identified by phone number, matched against `students.phone`, the same way a WhatsApp-based lookup would work — nothing about student identity is tied to a specific channel. When a phone number is shared across multiple students under the same tutor (a common case — the parent's phone), the chat interface asks the student to select which one they are, and remembers the choice for the rest of the session.

---

## 5. CBC Curriculum API Connection

### 5.0 In plain terms

The CBC API is a separate service whose job is knowing the Kenyan curriculum. It has two layers of data: the curriculum tree (grade → strand → sub-strand → learning outcome — the syllabus outline) and a content layer (real past exam questions with answers, real worked examples broken into steps, and other extracted material — see §6).

Kusoma doesn't keep its own copy of any of this. It calls the CBC API directly, live, every time it needs curriculum information:

- Student asks a homework question → Kusoma asks the CBC API "what topic is this, and is there a real worked example for it?" → uses the answer to help the student.
- Tutor browses the curriculum to assign a topic → Kusoma asks the CBC API "show me Grade 5 Math" → tutor picks from the list.

This keeps Kusoma's own build simpler — no sync step, no local curriculum database, no vector search infrastructure of its own. The trade-off is that if the CBC API is ever slow or unavailable, curriculum matching and browsing are affected too, since Kusoma is asking in the moment rather than working from its own copy. Each call site has a short timeout and a defined fallback (§5.4) so this degrades a feature gracefully instead of breaking a live interaction.

### 5.1 What Kusoma does not have

No local curriculum table, no vector search extension, and no query-embedding step of its own. The CBC API's search endpoint takes a plain text query and does the embedding and matching server-side — Kusoma sends text, gets back ranked results.

### 5.2 Runtime call sites

```
Homework help:
  Student sends homework text or image
    → Claude Vision extracts problem text (if image)
    → POST {CBC_API_URL}/v1/search
        { query: problemText, grade: student.grade, subject: 'mathematics', limit: 3 }
    → matched curriculum nodes used in the homework-help prompt (§7.1)
    → (also feeds into content grounding, §6.2)

Curriculum browser (Tutor PWA):
  Tutor opens the curriculum picker for a student's grade
    → GET {CBC_API_URL}/v1/curriculum/mathematics/{grade}
    → tree rendered directly from the response
  Tutor assigns a topic
    → GET {CBC_API_URL}/v1/nodes/{id}
    → INSERT INTO assignments (..., cbc_node_id, strand, sub_strand, learning_outcome)
```

### 5.3 Denormalizing display text

Because there's no local curriculum table to join against, anywhere the dashboard needs to show strand/sub-strand/learning-outcome text on every page load, that text is captured once at write time rather than fetched from the CBC API on every render:

- `assignments.strand`, `assignments.sub_strand`, `assignments.learning_outcome` — populated from the CBC API response at the moment a tutor creates the assignment.
- `student_performance.strand`, `student_performance.sub_strand`, `student_performance.learning_outcome` — populated the same way, for the topic-by-topic breakdown in the student detail view.

### 5.4 Handling CBC API failure or latency

Both call sites in §5.2 are on a live request path a tutor or student is actively waiting on:

- **Homework help:** timeout at 3–4 seconds. On timeout or error, skip curriculum matching and fall back to a general tutoring prompt without matched curriculum context — the AI still helps with the problem, just without KICD-specific teaching guidance for that one interaction.
- **Curriculum browser:** timeout at 5 seconds. On timeout or error, show "Curriculum data is temporarily unavailable — try again in a moment" rather than a blank or broken screen.

### 5.5 Rate limits

The CBC API's default is 100 requests/minute per key. At single-tutor pilot scale, with a handful of students doing homework help and one tutor browsing curriculum, this isn't a constraint worth designing around. Content search (§6) adds a second call per interaction on top of this, which is still well within limit at this scale.

### 5.6 Environment variables

```
CBC_API_URL=
CBC_API_KEY=
```

Required at runtime by the main API routes — homework help and the curriculum browser both depend on the CBC API being reachable. No OpenAI key is needed anywhere in Kusoma; the CBC API owns all embedding generation.

---

## 6. Content-Grounded Tutoring

### 6.0 In plain terms

Beyond the curriculum outline, the CBC API holds real content extracted from actual documents: real past exam questions with real marked answers, and real worked examples already broken into individual steps. Wherever that content exists for the topic a student is working on, Kusoma uses it directly instead of asking the AI to invent a problem or improvise an explanation from scratch:

- **Topic practice:** Kusoma first checks whether the CBC API has a real past exam question for the assigned topic. If yes, the student gets that question, and grading is a comparison against the real answer.
- **Homework help:** Kusoma first checks whether the CBC API has a worked example close to what the student is asking about. If yes, the AI grounds its step-by-step hints in those real steps.

If the CBC API doesn't have matching content for a given topic — which will happen for topics the content library hasn't covered yet — Kusoma falls back to the AI generating the problem or explanation on its own, exactly as it would if this content layer didn't exist. The AI-generation path always works; the CBC content path is used opportunistically on top of it.

### 6.1 Topic Practice: Real Questions Before Generated Ones

```
Student replies "start" (or the tutor's assigned topic needs a new problem):
  1. POST {CBC_API_URL}/v1/content/search
     {
       query: assignment.learning_outcome,
       grade: student.grade,
       subject: "mathematics",
       content_type: "exam_question",
       cognitive_level: <mapped from assignment.difficulty, see §6.3>,
       limit: 5
     }
  2. Filter out any result already served to this student
     (check practice_problems.cbc_content_chunk_id for this student_id)
  3. IF a usable, not-yet-seen result remains:
       → Use it directly as the problem. Student sees `body`; expected
         answer is the result's `answer` field.
       → practice_problems row: content_source = 'cbc_content',
         cbc_content_chunk_id = result.id, expected_answer = result.answer
     ELSE (no results, or all already seen):
       → AI generates a problem within the assignment's scope, as usual.
       → practice_problems row: content_source = 'ai_generated',
         cbc_content_chunk_id = null
  4. Send the problem to the student
```

Answer evaluation doesn't change based on source — the student's reply is compared against `expected_answer` and produces `error_type`/`error_detail` the same way regardless of where the problem came from.

### 6.2 Homework Help: Grounding Guidance in Real Worked Examples

Runs after curriculum-node matching (§5.2) finds `matched_nodes`, and before the AI call:

```
  1. POST {CBC_API_URL}/v1/content/search
     {
       query: problemText,
       grade: student.grade,
       subject: "mathematics",
       content_type: "worked_example",
       limit: 1
     }
  2. IF a result comes back with similarity ≥ 0.75:
       → Pass its `steps` array into the homework-help prompt as a
         reference solution the AI reveals progressively — one step's
         action, then (after the student attempts it) that step's
         explanation plus the next step's action.
       → The AI still writes the message to the student in its own
         words; the worked example anchors what it says, not the wording.
     ELSE:
       → Fall back to the matched curriculum-node context only
         (§7.1); the AI improvises the explanation.
  3. Log content_source and cbc_content_chunk_id on the resulting
     practice_problems row, same convention as §6.1.
```

### 6.3 Difficulty Mapping

`assignments.difficulty` maps onto the CBC API's `cognitive_level` filter:

| Kusoma difficulty | CBC API `cognitive_level` filter |
|---|---|
| `foundational` | `recall,application` |
| `intermediate` | `application,analysis` |
| `advanced` | `analysis,evaluation,creation` |

This is a small fixed lookup in code, not a database table.

### 6.4 Why This Is Worth the Extra Call

Two API calls per interaction instead of one is a real cost — extra latency, another point of failure, handled by the same timeout/fallback approach as §5.4. It's worth it because a practice question sourced from a real past exam paper, graded against the real marking-scheme answer, is a materially stronger claim than "the AI wrote this problem and is also the one checking it." The worked-example grounding means the reasoning a student sees traces back to a real document rather than solely to the LLM's own math.

### 6.5 What's Not Wired Up

The CBC API also holds `lesson_plan`, `assessment_rubric`, `localized_case_study`, and `revision_material` content — none of it is used by Kusoma. These are aimed more at teacher-tool use cases than the student-facing tutoring loop that's the core of Kusoma. `content_source` and `cbc_content_chunk_id` are captured on `practice_problems` (§3, Table 6) so surfacing provenance in the UI ("this question is from KNEC 2019") is possible without a schema change, but that UI isn't built yet.

---

## 7. AI Orchestration

### 7.1 Prompt Assembly

Two modes share a base context and a common response schema.

**Shared context:**

```typescript
interface StudentContext {
    student: {
        firstName: string;
        grade: number;
    };
    tutor: {
        displayName: string;
    };
    performance: {
        recentTopics: Array<{
            strand: string;
            subStrand: string;
            totalProblems: number;
            correctCount: number;
            commonErrors: Array<{ type: string; detail: string; count: number }>;
        }>;
        streakDays: number;
    };
    recentMessages: Array<{
        direction: 'inbound' | 'outbound';
        body: string;
        createdAt: Date;
    }>;
}

interface HomeworkHelpContext extends StudentContext {
    mode: 'homework_help';
    problemText: string;
    sourceImageUrl?: string;
    matchedNodes: Array<{
        strand: string;
        subStrand: string;
        learningOutcome: string;
        description: string | null;
    }>;
    referenceSolution?: {              // present only when §6.2 finds a matching worked example
        steps: Array<{ stepNumber: number; action: string; explanation: string }>;
    };
}

interface TopicPracticeContext extends StudentContext {
    mode: 'topic_practice';
    assignment: {
        strand: string;
        subStrand: string;
        learningOutcome: string;
        difficulty: 'foundational' | 'intermediate' | 'advanced';
    };
    pendingProblem: {
        problemText: string;
        expectedAnswer: string;
        source: 'ai_generated' | 'cbc_content';   // §6.1
    } | null;
}
```

**HOMEWORK HELP system prompt:**

```
You are Kusoma, a teaching assistant for {{student.firstName}},
a Grade {{student.grade}} student in Kenya's CBC curriculum.
You work under {{tutor.displayName}}, who is the primary tutor.

MODE: HOMEWORK HELP
The student has sent a homework problem they need help with.

THE PROBLEM:
{{problemText}}

MATCHED CURRICULUM CONTEXT (from CBC syllabus):
{{#each matchedNodes}}
- {{this.strand}} > {{this.subStrand}}: {{this.learningOutcome}}
  Teaching approach: {{this.description}}
{{/each}}

{{#if referenceSolution}}
REFERENCE SOLUTION (a real worked example for a similar problem — use this
to ground your hints, but explain in your own words):
{{#each referenceSolution.steps}}
Step {{this.stepNumber}}: {{this.action}}
  Why: {{this.explanation}}
{{/each}}
{{/if}}

STUDENT HISTORY ON RELATED TOPICS:
{{#each performance.recentTopics}}
- {{this.strand}} > {{this.subStrand}}: {{this.correctCount}}/{{this.totalProblems}} correct
  {{#if this.commonErrors.length}}
  Known errors: {{#each this.commonErrors}}{{this.detail}}; {{/each}}
  {{/if}}
{{/each}}

RULES:
1. Do NOT solve the problem for the student. Guide them step by step.
   Ask them what they think the first step is. If they don't know,
   give a hint, not the answer.
2. If a reference solution is provided above, base your hints on its
   steps — reveal one step's action at a time, and only give that
   step's explanation after the student has attempted it.
3. If the student sends just the problem with no attempt, ask them
   to try first.
4. Only reveal the full worked solution AFTER the student has made
   a genuine attempt and is still stuck after 2-3 hints.
5. Match the student's language — Swahili, English, or mixed.
6. Keep messages SHORT. 2-3 sentences. This is a chat interface.
7. If the student has known errors on this topic, watch for the
   same pattern and address it proactively.
8. Stay on the homework problem. If they ask something unrelated,
   redirect gently and save it for {{tutor.displayName}}.

Respond with valid JSON:
{
  "type": "homework_guidance" | "homework_evaluation",
  "student_message": "<text to send to the student>",
  "detected_topic": { "strand": "...", "sub_strand": "..." },
  "evaluation_data": {
    "is_correct": true | false,
    "error_type": "conceptual|computational|misread|none",
    "error_detail": "<specific description>"
  }
}
```

**TOPIC PRACTICE system prompt:**

```
You are Kusoma, a teaching assistant for {{student.firstName}},
a Grade {{student.grade}} student in Kenya's CBC curriculum.

MODE: TOPIC PRACTICE
Assigned topic: {{assignment.strand}} > {{assignment.subStrand}}:
{{assignment.learningOutcome}} (difficulty: {{assignment.difficulty}})

{{#if pendingProblem}}
PENDING PROBLEM (student has not yet answered):
{{pendingProblem.problemText}}
Expected answer: {{pendingProblem.expectedAnswer}}
{{#if pendingProblem.source === 'cbc_content'}}
This is a real past exam question — grade strictly against the
provided answer.
{{/if}}
{{/if}}

STUDENT PERFORMANCE ON THIS TOPIC:
{{#each performance.recentTopics}}
- {{this.correctCount}}/{{this.totalProblems}} correct
{{/each}}

RULES: same as homework help (§7.1) for tone, language, and message
length. If no pendingProblem is present, generate a new problem at
the assignment's difficulty level, scoped strictly to the assigned
learning outcome.

Respond with valid JSON:
{
  "type": "problem" | "evaluation" | "response" | "greeting",
  "student_message": "<text to send>",
  "detected_topic": { "strand": "{{assignment.strand}}", "sub_strand": "{{assignment.subStrand}}" },
  "problem_data": { "expected_answer": "..." },
  "evaluation_data": { "is_correct": true|false, "error_type": "...", "error_detail": "..." }
}
```

`detected_topic` is always present in both modes and feeds `student_performance` uniformly — whether a student engaged with a topic through homework or through assigned practice, the performance record is the same row (§3, Table 7).

### 7.2 Response Processing

```typescript
async function processAIResponse(
    parsed: AIResponse,
    studentId: string,
    mode: 'homework_help' | 'topic_practice',
    assignmentId: string | null,
    detectedCbcNodeId: string | null,
    contentSource: 'ai_generated' | 'cbc_content',
    cbcContentChunkId: string | null,
    inboundMessage: string,
    sourceImageUrl?: string,
): Promise<void> {
    // 1. Log outbound message
    await db.insert(messages).values({
        studentId, assignmentId, mode,
        direction: 'outbound',
        body: parsed.student_message,
        contentType: 'text',
    });

    // 2. Log the problem (either mode)
    if (parsed.type === 'problem' || parsed.type === 'homework_guidance') {
        await db.insert(practiceProblems).values({
            studentId, assignmentId,
            detectedCbcNodeId,
            mode, contentSource, cbcContentChunkId,
            problemText: mode === 'homework_help' ? inboundMessage : parsed.student_message,
            expectedAnswer: parsed.problem_data?.expected_answer,
            sourceImageUrl,
        });
    }

    // 3. Handle evaluations (both modes)
    if (parsed.evaluation_data &&
        (parsed.type === 'evaluation' || parsed.type === 'homework_evaluation')) {
        await updateLatestProblem(studentId, {
            studentAnswer: inboundMessage,
            isCorrect: parsed.evaluation_data.is_correct,
            errorType: parsed.evaluation_data.error_type,
            errorDetail: parsed.evaluation_data.error_detail,
            aiExplanation: parsed.student_message,
            attemptedAt: new Date(),
        });
    }

    // 4. Update unified performance
    if (detectedCbcNodeId) {
        await upsertPerformance(studentId, detectedCbcNodeId, assignmentId);
    }

    // 5. Send to the student
    await messagingClient.sendText(studentPhone, parsed.student_message);
}
```

### 7.3 Cost Estimation

- Vision call to extract a problem from an image: ~$0.003 per image
- Curriculum search (§5.2): negligible, no embedding cost to Kusoma
- Content search (§6): negligible, same reason
- Tutoring LLM call: ~$0.005
- **Total per homework help interaction with an image: ~$0.008**
- **Total per topic practice interaction: ~$0.005**

At 100 students doing 3 homework problems + 2 practice problems per day: roughly $102/month, well within margin at KES 100–150/student/month.

---

## 8. Inbound Message Routing

```
Student sends a message (text or image)
        │
        ▼
POST /api/chat/message
        │
        ▼
  1. Resolve student from session (§4)
  2. If image attached: store in Supabase Storage, get URL
  3. Determine mode:
     ┌──────────────────────────────────────────────────────────┐
     │  IF student has an active assignment AND is mid-practice  │
     │    (pending unanswered problem exists)                    │
     │    → TOPIC PRACTICE: evaluate answer                     │
     │                                                          │
     │  ELSE IF student replies "start" AND has an active        │
     │    assignment                                             │
     │    → TOPIC PRACTICE: generate/fetch next problem (§6.1)  │
     │                                                          │
     │  ELSE (all other messages, including images)              │
     │    → HOMEWORK HELP                                       │
     └──────────────────────────────────────────────────────────┘
  4. Route to the appropriate path (§6, §7)
  5. Call Claude, parse the structured response
  6. Process the response (§7.2)
  7. Return the AI's message in the HTTP response
```

This runs synchronously inside the API route — no queue, no webhook (§1). Scheduled outbound messages (practice nudges, weekly reports, payment reminders — §10) are the exception: those are generated by the worker on a schedule and written to `messages` for the chat interface to pick up on its next poll, since they aren't triggered by an inbound request.

---

## 9. Tutor Platform

### 9.1 Onboarding

A short, linear sequence shown once after a tutor's first login:

1. **Profile** — display name, phone number.
2. **Add first student** — name, grade, phone number, optional guardian.
3. **Assign a topic** — curriculum browser, scoped to the student's grade, pre-filtered to Mathematics.
4. **Done** — links to the dashboard, and separately, the phone number the tutor should give the student to open the chat interface.

This exists because a tutor should have a student active within about 15 minutes of signing up — not achievable if onboarding is a bare login screen followed by an empty dashboard.

### 9.2 Dashboard

Home page with summary cards: active students, engagement today, pending reports, overdue payments.

### 9.3 Student Detail

Top section: student name, grade, current assignment, days since last activity.

Middle section — unified topic performance (both modes feed this): topic-by-topic breakdown across everything the student has engaged with, regardless of whether it came from homework or assigned practice. Each row shows strand/sub-strand, a source badge ("Homework" / "Practice" / "Both"), accuracy, error patterns, and last-engaged date. This is the key view — it lets a tutor see, in one place, that a student is strong on one topic from homework activity but weak on another from assigned practice, and decide what to do next.

Bottom section, two tabs: Homework Activity (chronological, problem/attempt/guidance/result) and Practice Sessions (assigned-topic drills, problem-by-problem).

Action buttons: assign a practice topic, view/send parent report, view full message history.

### 9.4 Curriculum Browser

Browses the CBC tree live from the CBC API (§5.2) for the student's grade. Tutor selects a topic to create an assignment.

### 9.5 Reports and Payments

Reports: list of pending/sent parent reports, review/edit before approving, dispatch to the guardian on approval. Payments: current-month overview, M-Pesa STK push initiation, payment history.

---

## 10. Background Jobs

| Job | Schedule | What it does |
|---|---|---|
| `practice_nudge` | Per-student, default 3:00 PM EAT (`students.nudge_time`) | Only for students with an active assignment. Writes a message for the chat interface to surface on next poll. |
| `weekly_report` | Sunday, 10:00 AM EAT | AI-drafted summary per active student, saved as `status = 'draft'` for tutor review. |
| `payment_reminder` | 1st of the month | Payment reminder message per guardian with an outstanding balance. |

```typescript
const practiceQueue = new Queue('daily-practice', { connection });
const reportQueue = new Queue('weekly-report', { connection });
const paymentQueue = new Queue('payment-reminder', { connection });

await practiceQueue.add('dispatch', {}, { repeat: { pattern: '0 12 * * *' } });
await reportQueue.add('generate', {}, { repeat: { pattern: '0 7 * * 0' } });

new Worker('daily-practice', async (job) => {
    const activeStudents = await getActiveStudentsWithAssignments();
    for (const student of activeStudents) {
        await db.insert(messages).values({
            studentId: student.id,
            mode: 'topic_practice',
            direction: 'outbound',
            contentType: 'template',
            channel: 'web_chat',
            body: `Hi ${student.firstName}, you have practice questions today. Open the chat to begin.`,
        });
    }
}, { connection });

new Worker('weekly-report', async (job) => {
    const students = await getActiveStudentsWithPerformance();
    for (const student of students) {
        const reportBody = await generateReportWithAI(student);
        await db.insert(parentReports).values({
            studentId: student.id,
            periodStart: startOfWeek(),
            periodEnd: endOfWeek(),
            reportBody,
            status: 'draft',
        });
    }
}, { connection });
```

---

## 11. API Design

All `/api/*` routes except chat and webhook routes require a Supabase Auth JWT and are scoped to the authenticated tutor via RLS or an application-level `WHERE` clause.

### 11.1 Tutor Dashboard API

```
Auth
  POST   /api/auth/signup           Tutor registration
  POST   /api/auth/login            Request magic link or phone OTP
  GET    /api/auth/me               Current tutor profile

Onboarding
  GET    /api/onboarding/status     Which onboarding step the tutor is on (or "complete")
  POST   /api/onboarding/complete   Marks onboarding finished

Students
  GET    /api/students              List all students (with latest activity status)
  POST   /api/students              Add a student (+ optional guardian)
  GET    /api/students/:id          Student detail: profile, active assignment, performance
  PATCH  /api/students/:id          Update student info
  DELETE /api/students/:id          Deactivate student (soft delete)

Assignments
  GET    /api/students/:id/assignments         Assignment history for a student
  POST   /api/students/:id/assignments         Create new assignment (pauses any active one)
  PATCH  /api/assignments/:id                  Update difficulty, status, notes

Curriculum (proxied to the CBC API, §5.2)
  GET    /api/curriculum                       List strands for a grade + subject
  GET    /api/curriculum/:grade/:subject       Full tree for grade/subject

Performance
  GET    /api/students/:id/performance         Aggregated stats for active assignment
  GET    /api/students/:id/problems            Recent practice problems with results
  GET    /api/students/:id/messages            Interaction history (paginated)

Reports
  GET    /api/reports                          List pending/sent reports
  GET    /api/reports/:id                      Single report detail
  PATCH  /api/reports/:id                      Edit report body or approve for sending
  POST   /api/reports/:id/send                 Dispatch approved report to guardian

Payments
  GET    /api/payments                         Payment overview for current month
  POST   /api/payments/request                 Initiate M-Pesa STK push
  GET    /api/payments/history                 Payment history (paginated)

Dashboard
  GET    /api/dashboard/summary                Aggregated summary cards
```

### 11.2 Student Chat API

```
POST   /api/chat/identify         Resolve phone number → student(s); issue session token
POST   /api/chat/select-student   Resolve shared-phone selection → session token
POST   /api/chat/message          Send a message, run the AI pipeline (§8), return response
GET    /api/chat/messages         Poll for new messages since a timestamp
```

The session token is a signed, httpOnly cookie, scoped to the chat routes only, resolving to exactly one `student_id`. It is not a Supabase Auth session.

### 11.3 Webhook Endpoints (no auth — verified by signature/token)

```
POST   /api/webhooks/mpesa        Daraja payment confirmation callback
```

### 11.4 Internal

The worker process writes directly to the database via Drizzle — it does not call the API routes, it shares the same service layer code.

---

## 12. Security and Privacy

### 12.1 Authentication

- Tutor auth via Supabase Auth (phone OTP or magic link); JWT stored in an httpOnly cookie, verified on every API request.
- Students are not authenticated product users. They're identified by phone number and, in the chat interface, a signed session cookie (§11.2).

### 12.2 Data Isolation

- Row-Level Security on Supabase: tutors can only read/write their own students, assignments, messages, and payments.
- The worker process uses a service-role key (bypasses RLS) for cross-cutting operations like daily dispatch.

### 12.3 Data Stored

- Student first names and phone numbers, guardian phone numbers, full message history, payment records.
- No passwords, no email addresses, no national IDs, no school names.

### 12.4 Rate Limiting

Because the web chat has no equivalent of a messaging platform's app-level access controls, rate limiting is applied at `/api/chat/message` (per session token) to prevent a single browser session from generating unbounded LLM cost — a reasonable starting point is one message per 3 seconds and a daily cap per student, configurable via environment variable.

---

## 13. Build Order

**Prerequisite:** the CBC Curriculum API must be deployed and seeded with at least Mathematics Grade 5 before Phase 2 begins — Kusoma has no local fallback data of its own.

### Phase 1: Foundation

- [ ] Initialize Next.js project with TypeScript, Drizzle, Supabase
- [ ] Set up Railway deployment (web service)
- [ ] Create database schema (§3), run migrations
- [ ] Implement Supabase Auth (tutor signup/login with phone OTP)
- [ ] Build tutor onboarding backend: `tutors`, `students` CRUD
- [ ] Build a thin CBC API client wrapper (base URL + key from env, timeout handling per §5.4) — every CBC API call in later phases goes through this

**Deliverable:** Tutor can sign up, log in, manage a student roster.

### Phase 2: Chat Core

- [ ] Define the `MessagingClient` interface; implement `WebChatClient`; stub `WhatsAppClient`
- [ ] Build `/api/chat/identify`, `/api/chat/select-student`, `/api/chat/message`, `/api/chat/messages`
- [ ] Build the student chat page (phone entry → identify/select → message thread, polling for new messages)
- [ ] Build image upload handling (browser file input → Supabase Storage)
- [ ] Wire homework help: Claude Vision extraction, curriculum search (§5.2), content search for worked examples (§6.2), AI call, response processing (§7.2)
- [ ] Wire topic practice: content search for real questions (§6.1) with fallback to AI generation, AI call, response processing
- [ ] Session handling via signed cookie + Redis

**Deliverable:** A student can open the chat page, identify themselves by phone number, and get homework help and topic practice — grounded in real CBC content where available, AI-generated otherwise.

### Phase 3: Tutor Platform

- [ ] Onboarding flow (§9.1)
- [ ] Dashboard home with summary cards
- [ ] Student detail view: unified topic performance (§9.3)
- [ ] Curriculum browser (§9.4), assignment creation with denormalized display text (§5.3)
- [ ] Message history view
- [ ] PWA manifest and service worker

**Deliverable:** A tutor can sign up, get guided through adding their first student and topic, and reach a fully functional dashboard.

### Phase 4: Reports and Payments

- [ ] Set up Redis + BullMQ on Railway; build the worker process
- [ ] Implement `practice_nudge`, `weekly_report` jobs (§10)
- [ ] Build report review/approve UI
- [ ] Build payment tracking (manual reconciliation) and the payment overview screen

**Deliverable:** Automated nudges, weekly parent reports with tutor review, payment tracking.

### Phase 5: Pilot

- [ ] Onboard the first tutor and enroll students
- [ ] Monitor engagement and AI quality daily
- [ ] Collect tutor feedback and fix what breaks

**Deliverable:** A working product with real users and real feedback.

---

## 14. Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# LLM
ANTHROPIC_API_KEY=

# CBC Curriculum API (required at runtime — see §5.6)
CBC_API_URL=
CBC_API_KEY=

# Redis
REDIS_URL=

# M-Pesa
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=

# App
APP_URL=https://kusoma.up.railway.app
NODE_ENV=production
```

---

## 15. Out of Scope for This Build

- **A real WhatsApp integration.** The `MessagingClient` interface (§1) is built specifically so this can be added later without touching the tutoring logic, but implementing `WhatsAppClient` itself is not part of this build.
- **A local replica of CBC curriculum or content data.** Both are called live at runtime (§5, §6). Worth revisiting if the CBC API's availability or latency ever becomes a real constraint.
- **CBC content types beyond `worked_example` and `exam_question`.** `lesson_plan`, `assessment_rubric`, `localized_case_study`, and `revision_material` exist on the CBC API but aren't wired into Kusoma yet (§6.5).
- **Content provenance in the UI.** The schema supports it (`content_source`, `cbc_content_chunk_id`); the UI to show it doesn't exist yet.
- **Multi-tutor / academy features.** Tenant isolation beyond the RLS already specified, cross-tutor permissions, academy-level admin views.
- **Real-time push delivery for the chat interface.** Polling is adequate at this scale.
- **Live M-Pesa Daraja integration.** Payment tracking starts with manual reconciliation.

---

## 16. Suggested Work Breakdown (5-person team)

A mapping of this document's sections to parallelizable workstreams.

| Area | Sections | Notes |
|---|---|---|
| API + backend service layer | §5, §6, §7, §8 | The CBC API client, AI orchestration, and chat message pipeline — critical path everything else depends on. |
| CBC API coordination | §5, §6 | Confirming content availability (which topics have real questions/worked examples seeded) so the fallback paths aren't hit constantly during the demo. |
| Deployment / infra | §1, §3, §14 | Railway services, Redis, schema migrations, environment configuration. |
| Tutor PWA frontend | §9 | Dashboard, student detail, curriculum browser, onboarding UI. |
| Student chat frontend | §4, §8, §11.2 | Chat page, session handling, image upload UI. |

Two people can build against the API route shapes in §11 while the routes themselves are being implemented, provided those shapes are agreed on first.
