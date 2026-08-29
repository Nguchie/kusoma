import { requireTutor } from "@/server/require-tutor";
import { listPaymentHistory } from "@/server/services/payments";

export async function GET(request: Request) {
  const auth = await requireTutor();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
  const offsetRaw = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const limit =
    Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;
  const offset =
    Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  const result = await listPaymentHistory(auth.tutor.id, { limit, offset });
  return Response.json(result);
}
