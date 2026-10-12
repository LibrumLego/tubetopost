import { apiError, authenticatedClient } from "@/lib/api";
import { jobProgress } from "@/lib/jobs/state";
import type { JobStatus, TranscriptSource } from "@/types/jobs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await authenticatedClient();
  if (!client) return apiError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return apiError("JOB_NOT_FOUND", "작업을 찾을 수 없습니다.", 404);
  const { data, error } = await client.from("jobs").select("id,status,transcript_source,video_title,video_thumbnail_url,post_id,error_code,error_message").eq("id", id).maybeSingle();
  if (error) return apiError("INTERNAL", "작업을 조회하지 못했습니다.", 500);
  if (!data) return apiError("JOB_NOT_FOUND", "작업을 찾을 수 없습니다.", 404);
  return Response.json({ job: {
    id: data.id, status: data.status,
    progress: jobProgress(data.status as JobStatus, data.transcript_source as TranscriptSource | null),
    video_title: data.video_title, video_thumbnail_url: data.video_thumbnail_url, post_id: data.post_id,
    error: data.error_code ? { code: data.error_code, message: data.error_message } : null,
  } });
}
