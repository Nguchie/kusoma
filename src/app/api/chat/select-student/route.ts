import {
  createChatSession,
  readPendingChatSelection,
} from "@/lib/chat-session";
import { isUuid, jsonError, readJson, readString } from "@/server/http";
import {
  getActiveStudentById,
  toChatStudentPreview,
} from "@/server/services/chat-identity";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const studentId =
    readString(body, "student_id") ?? readString(body, "studentId");
  if (!studentId || !isUuid(studentId)) {
    return jsonError("student_id is required.", 400);
  }

  const pending = await readPendingChatSelection();
  if (!pending) {
    return jsonError("Identify by phone first.", 401);
  }

  if (!pending.candidateIds.includes(studentId)) {
    return jsonError("That student is not in the current phone match.", 403);
  }

  const student = await getActiveStudentById(studentId);
  if (!student || student.phone !== pending.phone) {
    return jsonError("Student not found.", 404);
  }

  await createChatSession({ studentId: student.id, phone: student.phone });
  return Response.json({ student: toChatStudentPreview(student) });
}
