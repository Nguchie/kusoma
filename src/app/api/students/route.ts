import { normalizeKenyaPhone } from "@/lib/phone";
import {
  jsonError,
  readBoolean,
  readJson,
  readNumber,
  readObject,
  readString,
} from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import {
  createStudent,
  listStudents,
  parseGrade,
  parseStudentPhone,
} from "@/server/services/students";

function parseGuardian(body: Record<string, unknown>) {
  if (!("guardian" in body) || body.guardian == null) {
    return { guardian: undefined };
  }

  const raw = readObject(body, "guardian");
  if (!raw) {
    return { error: "guardian must be an object." };
  }

  const displayName = readString(raw, "display_name");
  const phoneRaw = readString(raw, "phone");
  const phone = phoneRaw ? normalizeKenyaPhone(phoneRaw) : null;
  const receivesReports = readBoolean(raw, "receives_reports") ?? true;

  if (!displayName || !phone) {
    return {
      error: "guardian.display_name and a valid Kenyan phone are required.",
    };
  }

  return {
    guardian: { displayName, phone, receivesReports },
  };
}

export async function GET() {
  const auth = await requireTutor();
  if (auth.response) return auth.response;
  const items = await listStudents(auth.tutor.id);
  return Response.json({ students: items });
}

export async function POST(request: Request) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const firstName = readString(body, "first_name");
  const grade = parseGrade(readNumber(body, "grade"));
  const phone = parseStudentPhone(readString(body, "phone") ?? "");

  if (!firstName) return jsonError("first_name is required.", 400);
  if (grade === null) {
    return jsonError("grade must be an integer from 1 to 9.", 400);
  }
  if (!phone) return jsonError("A valid Kenyan phone number is required.", 400);

  const guardianResult = parseGuardian(body);
  if ("error" in guardianResult && guardianResult.error) {
    return jsonError(guardianResult.error, 400);
  }

  const student = await createStudent(auth.tutor.id, {
    firstName,
    grade,
    phone,
    guardian: guardianResult.guardian,
  });

  return Response.json(student, { status: 201 });
}
