import Link from "next/link";
import { notFound } from "next/navigation";

import { MessageHistory } from "@/components/tutor/message-history";
import { secondaryButtonClass } from "@/components/tutor/styles";
import { isUuid } from "@/server/http";
import { requireTutorPage } from "@/server/require-tutor-page";
import { listTutorStudentMessages } from "@/server/services/chat-messages";
import { getStudentForTutor } from "@/server/services/students";

export default async function StudentMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tutor = await requireTutorPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const student = await getStudentForTutor(tutor.id, id);
  if (!student) notFound();

  const page = await listTutorStudentMessages(tutor.id, id, {
    limit: 50,
    before: null,
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href={`/students/${student.id}`}
          className="text-sm text-zinc-500 underline"
        >
          Back to {student.first_name}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Message history
        </h1>
        <p className="text-sm text-zinc-500">{student.first_name}</p>
      </div>

      <MessageHistory
        studentId={student.id}
        studentName={student.first_name}
        initial={page?.messages ?? []}
        initialNextBefore={page?.next_before ?? null}
      />

      <Link
        href={`/students/${student.id}`}
        className={`w-fit ${secondaryButtonClass}`}
      >
        Back
      </Link>
    </main>
  );
}
