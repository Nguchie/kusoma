import {
  createChatSession,
  createPendingChatSelection,
} from "@/lib/chat-session";
import { normalizeKenyaPhone } from "@/lib/phone";
import { jsonError, readJson, readString } from "@/server/http";
import {
  findActiveStudentsByPhone,
  toChatStudentPreview,
} from "@/server/services/chat-identity";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const phoneRaw = readString(body, "phone");
  if (!phoneRaw) return jsonError("phone is required.", 400);

  const phone = normalizeKenyaPhone(phoneRaw);
  if (!phone) return jsonError("Enter a valid Kenyan phone number.", 400);

  const { rows } = await findActiveStudentsByPhone(phone);

  if (rows.length === 0) {
    return jsonError("No student found for that phone.", 404);
  }

  if (rows.length === 1) {
    const student = rows[0]!;
    await createChatSession({ studentId: student.id, phone: student.phone });
    return Response.json({ student: toChatStudentPreview(student) });
  }

  await createPendingChatSelection({
    phone,
    candidateIds: rows.map((row) => row.id),
  });

  return Response.json({
    candidates: rows.map(toChatStudentPreview),
  });
}
