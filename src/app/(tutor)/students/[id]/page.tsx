import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignmentPanel } from "@/components/tutor/assignment-panel";
import { EditStudentForm } from "@/components/tutor/edit-student-form";
import { StudentActivityTabs } from "@/components/tutor/student-activity-tabs";
import { TopicPerformanceList } from "@/components/tutor/topic-performance";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/tutor/styles";
import { isUuid } from "@/server/http";
import { requireTutorPage } from "@/server/require-tutor-page";
import { listAssignmentsForStudent } from "@/server/services/assignments";
import {
  formatLastActivity,
  listStudentProblems,
  listTopicPerformance,
} from "@/server/services/student-activity";
import { getStudentForTutor } from "@/server/services/students";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tutor = await requireTutorPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const student = await getStudentForTutor(tutor.id, id);
  if (!student) notFound();

  const [assignments, performance, problems] = await Promise.all([
    listAssignmentsForStudent(tutor.id, id),
    listTopicPerformance(tutor.id, id),
    listStudentProblems(tutor.id, id),
  ]);

  const assignment = student.active_assignment;
  const homework = (problems ?? []).filter(
    (item) => item.mode === "homework_help",
  );
  const practice = (problems ?? []).filter(
    (item) => item.mode === "topic_practice",
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-10">
      <div>
        <Link href="/students" className="text-sm text-zinc-500 underline">
          Back to students
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {student.first_name}
        </h1>
        <p className="text-sm text-zinc-500">
          Grade {student.grade} · {student.phone} ·{" "}
          {student.is_active ? "Active" : "Inactive"}
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {assignment ? (
            <>
              Current topic:{" "}
              <span className="font-medium">{assignment.learning_outcome}</span>
              <span className="block text-zinc-500">
                {assignment.strand} → {assignment.sub_strand}
              </span>
            </>
          ) : (
            "No active topic"
          )}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {formatLastActivity(student.latest_activity_at)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="#assign" className={primaryButtonClass}>
          Assign a topic
        </Link>
        <Link
          href={`/students/${student.id}/messages`}
          className={secondaryButtonClass}
        >
          Message history
        </Link>
        <button type="button" disabled className={secondaryButtonClass}>
          Parent report
        </button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Topic performance</h2>
        <p className="text-sm text-zinc-500">
          Homework and practice on the same topic share one accuracy.
        </p>
        <TopicPerformanceList items={performance ?? []} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Activity</h2>
        <StudentActivityTabs homework={homework} practice={practice} />
      </section>

      <AssignmentPanel
        key={student.id}
        studentId={student.id}
        studentName={student.first_name}
        grade={student.grade}
        assignments={assignments ?? []}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Profile</h2>
        <EditStudentForm student={student} />
      </section>
    </main>
  );
}
