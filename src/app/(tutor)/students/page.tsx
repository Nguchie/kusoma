import { StudentsRoster } from "@/components/tutor/students-roster";
import { requireTutorPage } from "@/server/require-tutor-page";
import { listStudents } from "@/server/services/students";

export default async function StudentsPage() {
  const tutor = await requireTutorPage();
  const students = await listStudents(tutor.id);

  return <StudentsRoster students={students} />;
}
