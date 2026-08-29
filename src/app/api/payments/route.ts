import {
  isUuid,
  jsonError,
  readJson,
  readNumber,
  readString,
} from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import {
  createPayment,
  getPaymentsOverview,
  parsePaymentStatus,
  parsePeriodMonth,
} from "@/server/services/payments";

export async function GET() {
  const auth = await requireTutor();
  if (auth.response) return auth.response;
  const overview = await getPaymentsOverview(auth.tutor.id);
  return Response.json(overview);
}

export async function POST(request: Request) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const studentId =
    readString(body, "student_id") ?? readString(body, "studentId");
  if (!studentId || !isUuid(studentId)) {
    return jsonError("student_id is required.", 400);
  }

  const amount = readNumber(body, "amount");
  if (amount === undefined) return jsonError("amount is required.", 400);

  const periodMonth = parsePeriodMonth(
    readString(body, "period_month") ?? readString(body, "periodMonth"),
  );
  if (!periodMonth) {
    return jsonError("period_month must be YYYY-MM or YYYY-MM-DD.", 400);
  }

  const status =
    parsePaymentStatus(readString(body, "status")) ?? "pending";

  const result = await createPayment({
    tutorId: auth.tutor.id,
    studentId,
    amount: Math.round(amount),
    periodMonth,
    status,
    mpesaReceipt:
      readString(body, "mpesa_receipt") ?? readString(body, "mpesaReceipt"),
  });
  if (!result.ok) return jsonError(result.error, result.status);
  return Response.json(result.payment, { status: 201 });
}
