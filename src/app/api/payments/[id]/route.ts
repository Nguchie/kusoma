import { isUuid, jsonError, readJson, readString } from "@/server/http";
import { requireTutor } from "@/server/require-tutor";
import {
  parsePaymentStatus,
  updatePaymentStatus,
} from "@/server/services/payments";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Invalid payment id.", 400);

  const body = await readJson(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const status = parsePaymentStatus(readString(body, "status"));
  if (!status) {
    return jsonError("status must be pending, completed, or failed.", 400);
  }

  const result = await updatePaymentStatus({
    tutorId: auth.tutor.id,
    paymentId: id,
    status,
    mpesaReceipt:
      readString(body, "mpesa_receipt") ?? readString(body, "mpesaReceipt"),
  });
  if (!result.ok) return jsonError(result.error, result.status);
  return Response.json(result.payment);
}
