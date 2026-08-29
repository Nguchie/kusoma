CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"cbc_node_id" uuid NOT NULL,
	"strand" text NOT NULL,
	"sub_strand" text NOT NULL,
	"learning_outcome" text NOT NULL,
	"difficulty" text DEFAULT 'intermediate' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"tutor_notes" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "assignments_difficulty_check" CHECK ("assignments"."difficulty" IN ('foundational', 'intermediate', 'advanced')),
	CONSTRAINT "assignments_status_check" CHECK ("assignments"."status" IN ('active', 'completed', 'paused'))
);
--> statement-breakpoint
CREATE TABLE "guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"phone" text NOT NULL,
	"receives_reports" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"assignment_id" uuid,
	"mode" text DEFAULT 'homework_help' NOT NULL,
	"direction" text NOT NULL,
	"content_type" text DEFAULT 'text' NOT NULL,
	"body" text NOT NULL,
	"image_url" text,
	"channel" text DEFAULT 'web_chat' NOT NULL,
	"wa_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_mode_check" CHECK ("messages"."mode" IN ('homework_help', 'topic_practice')),
	CONSTRAINT "messages_direction_check" CHECK ("messages"."direction" IN ('inbound', 'outbound')),
	CONSTRAINT "messages_content_type_check" CHECK ("messages"."content_type" IN ('text', 'image', 'template', 'button_reply')),
	CONSTRAINT "messages_channel_check" CHECK ("messages"."channel" IN ('web_chat', 'whatsapp'))
);
--> statement-breakpoint
CREATE TABLE "parent_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"report_body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_reports_status_check" CHECK ("parent_reports"."status" IN ('draft', 'approved', 'sent'))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"student_id" uuid,
	"amount" integer NOT NULL,
	"period_month" date NOT NULL,
	"mpesa_checkout_request_id" text,
	"mpesa_receipt" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_status_check" CHECK ("payments"."status" IN ('pending', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "practice_problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"assignment_id" uuid,
	"detected_cbc_node_id" uuid,
	"mode" text DEFAULT 'homework_help' NOT NULL,
	"content_source" text DEFAULT 'ai_generated' NOT NULL,
	"cbc_content_chunk_id" uuid,
	"problem_text" text NOT NULL,
	"source_image_url" text,
	"expected_answer" text,
	"student_answer" text,
	"is_correct" boolean,
	"error_type" text,
	"error_detail" text,
	"ai_explanation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempted_at" timestamp with time zone,
	CONSTRAINT "practice_problems_mode_check" CHECK ("practice_problems"."mode" IN ('homework_help', 'topic_practice')),
	CONSTRAINT "practice_problems_content_source_check" CHECK ("practice_problems"."content_source" IN ('ai_generated', 'cbc_content'))
);
--> statement-breakpoint
CREATE TABLE "student_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"cbc_node_id" uuid NOT NULL,
	"strand" text NOT NULL,
	"sub_strand" text NOT NULL,
	"learning_outcome" text NOT NULL,
	"assignment_id" uuid,
	"total_problems" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"common_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"last_active_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_performance_student_id_cbc_node_id_key" UNIQUE("student_id","cbc_node_id")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"grade" smallint NOT NULL,
	"phone" text NOT NULL,
	"nudge_time" time DEFAULT '15:00',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_grade_check" CHECK ("students"."grade" BETWEEN 1 AND 9)
);
--> statement-breakpoint
CREATE TABLE "tutors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"phone" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_reports" ADD CONSTRAINT "parent_reports_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_problems" ADD CONSTRAINT "practice_problems_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_problems" ADD CONSTRAINT "practice_problems_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_performance" ADD CONSTRAINT "student_performance_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_performance" ADD CONSTRAINT "student_performance_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutors" ADD CONSTRAINT "tutors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assignments_student_status" ON "assignments" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "idx_messages_student_time" ON "messages" USING btree ("student_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_payments_tutor_month" ON "payments" USING btree ("tutor_id","period_month");--> statement-breakpoint
CREATE INDEX "idx_problems_student" ON "practice_problems" USING btree ("student_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_problems_assignment" ON "practice_problems" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "idx_problems_detected_node" ON "practice_problems" USING btree ("detected_cbc_node_id");--> statement-breakpoint
CREATE INDEX "idx_students_phone" ON "students" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_students_tutor" ON "students" USING btree ("tutor_id");