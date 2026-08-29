-- Kusoma RLS — Implementation Guide Step 1.9 / system design §12.2
-- Apply in Supabase SQL editor (or via DATABASE_DIRECT_URL). Idempotent.
--
-- authenticated (tutor JWT): only own rows.
-- anon: no table grants — empty result even with the anon API key and no session.
-- service_role: bypasses RLS (worker / admin server routes). Never ship that key to the browser.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

-- ---------------------------------------------------------------------------
-- Helper: current tutor id from JWT (tutors.user_id = auth.uid())
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_tutor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT id FROM tutors WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_tutor_id() FROM public;
GRANT EXECUTE ON FUNCTION public.current_tutor_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- tutors: user_id = auth.uid()
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tutors_own_row ON tutors;
CREATE POLICY tutors_own_row ON tutors
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- students: tutor_id is the JWT tutor
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS students_own_rows ON students;
CREATE POLICY students_own_rows ON students
  FOR ALL
  TO authenticated
  USING (tutor_id = public.current_tutor_id())
  WITH CHECK (tutor_id = public.current_tutor_id());

-- ---------------------------------------------------------------------------
-- Child tables via student_id → students.tutor_id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS guardians_via_student ON guardians;
CREATE POLICY guardians_via_student ON guardians
  FOR ALL
  TO authenticated
  USING (student_id IN (SELECT id FROM students WHERE tutor_id = public.current_tutor_id()))
  WITH CHECK (student_id IN (SELECT id FROM students WHERE tutor_id = public.current_tutor_id()));

DROP POLICY IF EXISTS assignments_via_student ON assignments;
CREATE POLICY assignments_via_student ON assignments
  FOR ALL
  TO authenticated
  USING (student_id IN (SELECT id FROM students WHERE tutor_id = public.current_tutor_id()))
  WITH CHECK (student_id IN (SELECT id FROM students WHERE tutor_id = public.current_tutor_id()));

DROP POLICY IF EXISTS messages_via_student ON messages;
CREATE POLICY messages_via_student ON messages
  FOR ALL
  TO authenticated
  USING (student_id IN (SELECT id FROM students WHERE tutor_id = public.current_tutor_id()))
  WITH CHECK (student_id IN (SELECT id FROM students WHERE tutor_id = public.current_tutor_id()));

DROP POLICY IF EXISTS practice_problems_via_student ON practice_problems;
CREATE POLICY practice_problems_via_student ON practice_problems
  FOR ALL
  TO authenticated
  USING (student_id IN (SELECT id FROM students WHERE tutor_id = public.current_tutor_id()))
  WITH CHECK (student_id IN (SELECT id FROM students WHERE tutor_id = public.current_tutor_id()));

DROP POLICY IF EXISTS student_performance_via_student ON student_performance;
CREATE POLICY student_performance_via_student ON student_performance
  FOR ALL
  TO authenticated
  USING (student_id IN (SELECT id FROM students WHERE tutor_id = public.current_tutor_id()))
  WITH CHECK (student_id IN (SELECT id FROM students WHERE tutor_id = public.current_tutor_id()));

DROP POLICY IF EXISTS parent_reports_via_student ON parent_reports;
CREATE POLICY parent_reports_via_student ON parent_reports
  FOR ALL
  TO authenticated
  USING (student_id IN (SELECT id FROM students WHERE tutor_id = public.current_tutor_id()))
  WITH CHECK (student_id IN (SELECT id FROM students WHERE tutor_id = public.current_tutor_id()));

-- ---------------------------------------------------------------------------
-- payments: tutor_id matches the JWT tutor
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS payments_own_rows ON payments;
CREATE POLICY payments_own_rows ON payments
  FOR ALL
  TO authenticated
  USING (tutor_id = public.current_tutor_id())
  WITH CHECK (tutor_id = public.current_tutor_id());
