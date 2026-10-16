import { apiError, authenticatedClient } from "@/lib/api";
import { parseYouTubeUrl } from "@/lib/youtube/url";
import { toJobSummary } from "@/lib/jobs/summary";
import type { JobSummaryRow } from "@/types/jobs";
import { dispatchJob } from "@/lib/jobs/dispatch";
import { readJsonObject, RequestError } from "@/lib/security/request";

export async function POST(request: Request) {
  const client = await authenticatedClient();
  if (!client) return apiError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  let body;
  try { body = await readJsonObject(request, 8192); } catch (e) { return apiError("INVALID_URL", "유튜브 URL을 입력해 주세요.", e instanceof RequestError ? e.status : 400); }
  const video = parseYouTubeUrl(body?.youtube_url);
  if (!video) return apiError("INVALID_URL", "올바른 유튜브 영상 URL을 입력해 주세요.", 400);
  const { data, error } = await client.rpc("enqueue_job", { p_youtube_url: video.url, p_video_id: video.videoId });
  if (error) {
    switch (error.code) {
      case "P0042": return apiError("RATE_LIMIT", "요청이 많습니다. 잠시 후 다시 시도해 주세요.", 429);
      case "P0040": return apiError("SERVICE_LIMIT", "무료 베타의 전체 처리 한도에 도달했습니다. 나중에 다시 시도해 주세요.", 429);
      case "P0041": return apiError("SERVICE_BUSY", "다른 변환을 처리 중입니다. 잠시 후 다시 시도해 주세요.", 409);
      case "P0030": return apiError("CONCURRENT_LIMIT", "진행 중인 변환이 있습니다. 완료 후 다시 요청해 주세요.", 409);
      case "P0031": return apiError("COST_LIMIT", "이번 달 변환 시도 또는 비용 한도에 도달했습니다.", 429);
      case "P0003": return apiError("QUOTA_EXCEEDED", "이번 달 변환 한도를 모두 사용했습니다.", 429);
      case "P0002":
      case "23505": return apiError("ALREADY_PROCESSING", "이미 변환 중인 영상입니다.", 409);
      case "P0001": return apiError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
      default: return apiError("INTERNAL", "작업을 생성하지 못했습니다.", 500);
    }
  }
  dispatchJob(data.id);
  return Response.json({ job: { id: data.id, status: data.status, video_id: data.video_id, created_at: data.created_at } }, { status: 201 });
}

export async function GET(request: Request) {
  const client = await authenticatedClient();
  if (!client) return apiError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const recovered = await client.rpc("recover_my_jobs");
  if (recovered.error) return apiError("INTERNAL", "작업 상태를 확인하지 못했습니다.", 500);
  const params = new URL(request.url).searchParams;
  const limit = Number(params.get("limit") ?? 20);
  const cursor = params.get("cursor");
  let boundary: { created_at: string; id: string } | null = null;
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (typeof decoded.created_at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(decoded.created_at) || Number.isNaN(Date.parse(decoded.created_at)) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.id)) throw new Error("Invalid cursor");
      boundary = { created_at: decoded.created_at, id: decoded.id };
    } catch { return apiError("INVALID_QUERY", "페이지 커서가 올바르지 않습니다.", 400); }
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return apiError("INVALID_QUERY", "페이지 조회 조건이 올바르지 않습니다.", 400);
  }
  let query = client.from("jobs").select("id,status,video_id,video_title,video_thumbnail_url,post_id,error_code,error_message,created_at")
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (boundary) query = query.or(`created_at.lt.${boundary.created_at},and(created_at.eq.${boundary.created_at},id.lt.${boundary.id})`);
  const { data, error } = await query.returns<JobSummaryRow[]>();
  if (error) return apiError("INTERNAL", "작업 목록을 조회하지 못했습니다.", 500);
  const rows = data.slice(0, limit);
  const jobs = rows.map(toJobSummary);
  const last = rows.at(-1);
  return Response.json({ jobs, next_cursor: data.length > limit && last ? Buffer.from(JSON.stringify({ created_at: last.created_at, id: last.id })).toString("base64url") : null });
}
