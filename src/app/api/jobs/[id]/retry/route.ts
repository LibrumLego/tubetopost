import { apiError, authenticatedClient } from "@/lib/api";
import { dispatchJob } from "@/lib/jobs/dispatch";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await authenticatedClient();
  if (!client) return apiError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return apiError("INVALID_REQUEST", "작업 ID가 올바르지 않습니다.", 400);
  const { data, error } = await client.rpc("retry_job", { p_job_id: id });
  if (error) {
    if (["P0040", "P0042"].includes(error.code)) return apiError("LIMIT_EXCEEDED", "요청 또는 서비스 전체 처리 한도에 도달했습니다. 나중에 다시 시도해 주세요.", 429);
    if (error.code === "P0041") return apiError("SERVICE_BUSY", "다른 변환을 처리 중입니다. 잠시 후 다시 시도해 주세요.", 409);
    if (error.code === "P0032") return apiError("JOB_NOT_FOUND", "작업을 찾을 수 없습니다.", 404);
    if (["P0003", "P0031"].includes(error.code)) return apiError("LIMIT_EXCEEDED", "월 사용량 또는 비용 한도에 도달했습니다.", 429);
    return apiError("RETRY_NOT_ALLOWED", "재시도 한도(3회)에 도달했거나 진행 중인 작업이 있습니다.", 409);
  }
  dispatchJob(data.id);
  return Response.json({ job: { id: data.id, status: data.status } }, { status: 202 });
}
