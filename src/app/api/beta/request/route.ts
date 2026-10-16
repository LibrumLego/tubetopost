import { apiError, authenticatedClient } from "@/lib/api";
import { readJsonObject, RequestError } from "@/lib/security/request";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return apiError("INVALID_REQUEST", "요청 출처가 올바르지 않습니다.", 403);
  const db = await authenticatedClient();
  if (!db) return apiError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  let body;
  try { body = await readJsonObject(request, 3000); }
  catch (e) { return apiError("INVALID_REQUEST", "입력 내용을 확인해 주세요.", e instanceof RequestError ? e.status : 400); }
  if (typeof body.use_case !== "string" || !["study", "content", "work", "other"].includes(body.use_case)
    || typeof body.expected_monthly !== "string" || !["4-10", "11-30", "31+"].includes(body.expected_monthly)
    || typeof body?.note !== "string" || Array.from(body.note).length > 500) return apiError("INVALID_REQUEST", "입력 내용을 확인해 주세요.", 400);
  const { error } = await db.rpc("request_beta_pack", { p_use_case: body.use_case, p_expected_monthly: body.expected_monthly, p_note: body.note });
  if (error?.code === "P0042") return apiError("RATE_LIMIT", "요청이 많습니다. 잠시 후 다시 시도해 주세요.", 429);
  if (error) return apiError("INTERNAL", "신청을 저장하지 못했습니다. 다시 시도해 주세요.", 500);
  return Response.json({ saved: true });
}
