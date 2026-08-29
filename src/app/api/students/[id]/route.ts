import {
  isUuid,
  jsonError,
  readBoolean,
  readJson,
  readNumber,
  readString,
} from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import { listTopicPerformance } from "@/server/services/student-activity";
import {
  deactivateStudent,
  getStudentForTutor,
  parseGrade,
  parseNudgeTime,
  parseStudentPhone,
  updateStudent,
} from "@/server/services/students";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Invalid student id.", 400);

  const student = await getStudentForTutor(auth.tutor.id, id);
  if (!student) return jsonError("Student not found.", 404);

  const performance = await listTopicPerformance(auth.tutor.id, id);
  return Response.json({ ...student, performance: performance ?? [] });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Invalid student id.", 400);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const firstName = readString(body, "first_name");
  const phoneRaw = readString(body, "phone");
  const nudgeRaw = readString(body, "nudge_time");
  const isActive = readBoolean(body, "is_active");

  let grade: number | undefined;
  if ("grade" in body) {
    const parsed = parseGrade(readNumber(body, "grade"));
    if (parsed === null) {
      return jsonError("grade must be an integer from 1 to 9.", 400);
    }
    grade = parsed;
  }

  let phone: string | undefined;
  if (phoneRaw !== undefined) {
    const normalized = parseStudentPhone(phoneRaw);
    if (!normalized) {
      return jsonError("A valid Kenyan phone number is required.", 400);
    }
    phone = normalized;
  }

  let nudgeTime: string | undefined;
  if (nudgeRaw !== undefined) {
    const parsed = parseNudgeTime(nudgeRaw);
    if (!parsed) {
      return jsonError("nudge_time must be HH:MM or HH:MM:SS.", 400);
    }
    nudgeTime = parsed;
  }

  const updated = await updateStudent(auth.tutor.id, id, {
    firstName,
    grade,
    phone,
    nudgeTime,
    isActive,
  });
  if (!updated) return jsonError("Student not found.", 404);

  return Response.json(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Invalid student id.", 400);

  const updated = await deactivateStudent(auth.tutor.id, id);
  if (!updated) return jsonError("Student not found.", 404);

  return Response.json(updated);
}
