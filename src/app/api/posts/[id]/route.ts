import { apiError, authenticatedClient } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_TITLE = 200;
const MAX_MARKDOWN = 50000;

function mapRpcError(code: string | undefined) {
  switch (code) {
    case "P0001": return apiError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
    case "P0020": return apiError("POST_NOT_FOUND", "글을 찾을 수 없습니다.", 404);
    case "P0021": return apiError("FORBIDDEN", "접근 권한이 없습니다.", 403);
    case "P0013": return apiError("INVALID_REQUEST", "요청 형식이 올바르지 않습니다.", 400);
    case "P0036": return apiError("EDIT_CONFLICT", "다른 화면에서 글이 변경됐습니다. 최신 글을 불러와 확인해 주세요.", 409);
    default: return apiError("INTERNAL", "요청을 처리하지 못했습니다.", 500);
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await authenticatedClient();
  if (!client) return apiError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return apiError("INVALID_REQUEST", "요청 형식이 올바르지 않습니다.", 400);

  const { data, error } = await client
    .from("posts")
    .select("id,user_id,job_id,slug,title,description,keywords,content_markdown,content_html,cover_image_url,is_public,view_count,created_at,updated_at,revision")
    .eq("id", id)
    .maybeSingle();
  if (error) return apiError("INTERNAL", "글을 조회하지 못했습니다.", 500);
  if (!data) return apiError("POST_NOT_FOUND", "글을 찾을 수 없습니다.", 404);
  return Response.json({ post: data });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await authenticatedClient();
  if (!client) return apiError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return apiError("INVALID_REQUEST", "요청 형식이 올바르지 않습니다.", 400);

  let body: unknown;
  try { body = await request.json(); } catch { return apiError("INVALID_REQUEST", "요청 본문이 올바르지 않습니다.", 400); }
  if (!body || typeof body !== "object") return apiError("INVALID_REQUEST", "요청 본문이 올바르지 않습니다.", 400);

  const input = body as { title?: unknown; content_markdown?: unknown; is_public?: unknown; expected_revision?: unknown };
  if (typeof input.expected_revision !== "number" || !Number.isInteger(input.expected_revision) || input.expected_revision < 0) return apiError("INVALID_REQUEST", "글 버전을 확인할 수 없습니다. 새로고침해 주세요.", 400);
  const patch: Record<string, unknown> = { expected_revision: input.expected_revision };

  if (input.title !== undefined) {
    if (typeof input.title !== "string" || input.title.trim().length === 0 || input.title.length > MAX_TITLE) {
      return apiError("INVALID_REQUEST", "제목이 올바르지 않습니다.", 400);
    }
    patch.title = input.title.trim();
  }
  if (input.content_markdown !== undefined) {
    if (typeof input.content_markdown !== "string" || input.content_markdown.trim().length === 0 || input.content_markdown.length > MAX_MARKDOWN) {
      return apiError("INVALID_REQUEST", "본문이 올바르지 않습니다.", 400);
    }
    patch.content_markdown = input.content_markdown;
    patch.content_html = renderMarkdown(input.content_markdown);
  }
  if (input.is_public !== undefined) {
    if (typeof input.is_public !== "boolean") return apiError("INVALID_REQUEST", "공개 설정이 올바르지 않습니다.", 400);
    patch.is_public = input.is_public;
  }
  if (Object.keys(patch).length === 1) return apiError("INVALID_REQUEST", "수정할 내용이 없습니다.", 400);

  const { data, error } = await client.rpc("update_post", { p_post_id: id, p_patch: patch });
  if (error) return mapRpcError(error.code);
  return Response.json({ post: data });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await authenticatedClient();
  if (!client) return apiError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return apiError("INVALID_REQUEST", "요청 형식이 올바르지 않습니다.", 400);

  const { error } = await client.rpc("delete_post", { p_post_id: id });
  if (error) return mapRpcError(error.code);
  return new Response(null, { status: 204 });
}
