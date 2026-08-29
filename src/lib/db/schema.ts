import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

/** Supabase Auth. Referenced by tutors; not created by our migrations. */
const authUsers = pgSchema("auth").table("users", {
  id: uuid("id").primaryKey(),
});

/** Primary users. One row per registered tutor, linked to Supabase Auth. */
export const tutors = pgTable("tutors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  phone: text("phone").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  onboardingCompletedAt: timestamptz("onboarding_completed_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

/** Enrolled under a tutor. Identified by phone number in the chat interface. */
export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutors.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    grade: smallint("grade").notNull(),
    phone: text("phone").notNull(),
    nudgeTime: time("nudge_time").default("15:00"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("students_grade_check", sql`${table.grade} BETWEEN 1 AND 9`),
    index("idx_students_phone").on(table.phone),
    index("idx_students_tutor").on(table.tutorId),
  ],
);

/** Parent/guardian linked to a student. Receives weekly reports. */
export const guardians = pgTable("guardians", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  phone: text("phone").notNull(),
  receivesReports: boolean("receives_reports").notNull().default(true),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

/**
 * Tutor assigns a student to a CBC topic.
 * `cbc_node_id` is the CBC API node ID — no local curriculum FK.
 */
export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    cbcNodeId: uuid("cbc_node_id").notNull(),
    strand: text("strand").notNull(),
    subStrand: text("sub_strand").notNull(),
    learningOutcome: text("learning_outcome").notNull(),
    difficulty: text("difficulty").notNull().default("intermediate"),
    status: text("status").notNull().default("active"),
    tutorNotes: text("tutor_notes"),
    assignedAt: timestamptz("assigned_at").notNull().defaultNow(),
    completedAt: timestamptz("completed_at"),
  },
  (table) => [
    check(
      "assignments_difficulty_check",
      sql`${table.difficulty} IN ('foundational', 'intermediate', 'advanced')`,
    ),
    check(
      "assignments_status_check",
      sql`${table.status} IN ('active', 'completed', 'paused')`,
    ),
    index("idx_assignments_student_status").on(table.studentId, table.status),
  ],
);

/**
 * Every chat message, inbound and outbound.
 * `assignment_id` is nullable: homework help has no pre-configured assignment.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").references(() => assignments.id),
    mode: text("mode").notNull().default("homework_help"),
    direction: text("direction").notNull(),
    contentType: text("content_type").notNull().default("text"),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    channel: text("channel").notNull().default("web_chat"),
    waMessageId: text("wa_message_id"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "messages_mode_check",
      sql`${table.mode} IN ('homework_help', 'topic_practice')`,
    ),
    check(
      "messages_direction_check",
      sql`${table.direction} IN ('inbound', 'outbound')`,
    ),
    check(
      "messages_content_type_check",
      sql`${table.contentType} IN ('text', 'image', 'template', 'button_reply')`,
    ),
    check(
      "messages_channel_check",
      sql`${table.channel} IN ('web_chat', 'whatsapp')`,
    ),
    index("idx_messages_student_time").on(
      table.studentId,
      table.createdAt.desc(),
    ),
  ],
);

/**
 * AI-generated practice and homework problems the student brought,
 * including CBC API real content vs AI generation.
 */
export const practiceProblems = pgTable(
  "practice_problems",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").references(() => assignments.id),
    detectedCbcNodeId: uuid("detected_cbc_node_id"),
    mode: text("mode").notNull().default("homework_help"),
    contentSource: text("content_source").notNull().default("ai_generated"),
    cbcContentChunkId: uuid("cbc_content_chunk_id"),
    problemText: text("problem_text").notNull(),
    sourceImageUrl: text("source_image_url"),
    expectedAnswer: text("expected_answer"),
    studentAnswer: text("student_answer"),
    isCorrect: boolean("is_correct"),
    errorType: text("error_type"),
    errorDetail: text("error_detail"),
    aiExplanation: text("ai_explanation"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    attemptedAt: timestamptz("attempted_at"),
  },
  (table) => [
    check(
      "practice_problems_mode_check",
      sql`${table.mode} IN ('homework_help', 'topic_practice')`,
    ),
    check(
      "practice_problems_content_source_check",
      sql`${table.contentSource} IN ('ai_generated', 'cbc_content')`,
    ),
    index("idx_problems_student").on(table.studentId, table.createdAt.desc()),
    index("idx_problems_assignment").on(table.assignmentId),
    index("idx_problems_detected_node").on(table.detectedCbcNodeId),
  ],
);

/**
 * Aggregated per student per curriculum topic, regardless of mode.
 * Display text is denormalized — no local curriculum table to join against.
 */
export const studentPerformance = pgTable(
  "student_performance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    cbcNodeId: uuid("cbc_node_id").notNull(),
    strand: text("strand").notNull(),
    subStrand: text("sub_strand").notNull(),
    learningOutcome: text("learning_outcome").notNull(),
    assignmentId: uuid("assignment_id").references(() => assignments.id),
    totalProblems: integer("total_problems").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    commonErrors: jsonb("common_errors")
      .notNull()
      .default(sql`'[]'::jsonb`),
    streakDays: integer("streak_days").notNull().default(0),
    lastActiveAt: timestamptz("last_active_at"),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("student_performance_student_id_cbc_node_id_key").on(
      table.studentId,
      table.cbcNodeId,
    ),
  ],
);

/** AI-generated weekly summaries, reviewed by the tutor before dispatch. */
export const parentReports = pgTable(
  "parent_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    reportBody: text("report_body").notNull(),
    status: text("status").notNull().default("draft"),
    sentAt: timestamptz("sent_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "parent_reports_status_check",
      sql`${table.status} IN ('draft', 'approved', 'sent')`,
    ),
  ],
);

/** M-Pesa payment records. */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutors.id),
    studentId: uuid("student_id").references(() => students.id),
    amount: integer("amount").notNull(),
    periodMonth: date("period_month").notNull(),
    mpesaCheckoutRequestId: text("mpesa_checkout_request_id"),
    mpesaReceipt: text("mpesa_receipt"),
    status: text("status").notNull().default("pending"),
    paidAt: timestamptz("paid_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "payments_status_check",
      sql`${table.status} IN ('pending', 'completed', 'failed')`,
    ),
    index("idx_payments_tutor_month").on(table.tutorId, table.periodMonth),
  ],
);
