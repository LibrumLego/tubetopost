import { apiError, authenticatedClient } from "@/lib/api";
import { jobProgress } from "@/lib/jobs/state";
import { toJobSummary } from "@/lib/jobs/summary";
import type { JobSummaryRow, TranscriptSource } from "@/types/jobs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await authenticatedClient();
  if (!client) return apiError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const recovered = await client.rpc("recover_my_jobs");
  if (recovered.error) return apiError("INTERNAL", "작업 상태를 확인하지 못했습니다.", 500);
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return apiError("INVALID_REQUEST", "요청 형식이 올바르지 않습니다.", 400);
  const { data, error } = await client.from("jobs").select("id,status,video_id,created_at,transcript_source,video_title,video_thumbnail_url,post_id,error_code,error_message,retry_count").eq("id", id)
    .returns<(JobSummaryRow & { transcript_source: TranscriptSource | null })[]>().maybeSingle();
  if (error) return apiError("INTERNAL", "작업을 조회하지 못했습니다.", 500);
  if (!data) return apiError("JOB_NOT_FOUND", "작업을 찾을 수 없습니다.", 404);
  return Response.json({ job: {
    ...toJobSummary(data),
    retry_count: (data as typeof data & { retry_count: number }).retry_count,
    progress: jobProgress(data.status, data.transcript_source),
  } });
}
