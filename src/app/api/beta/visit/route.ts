import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonObject, RequestError } from "@/lib/security/request";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > 256) return new Response(null, { status: 413 });
  let body;
  try { body = await readJsonObject(request, 256); }
  catch (e) { return new Response(null, { status: e instanceof RequestError ? e.status : 400 }); }
  if (typeof body.page !== "string" || !["landing", "login", "app", "public_post"].includes(body.page)
    || typeof body.source !== "string" || !["direct", "search", "social", "other", "internal"].includes(body.source)) return new Response(null, { status: 400 });
  const { error } = await createAdminClient().rpc("record_beta_visit", { p_page: body.page, p_source: body.source });
  return new Response(null, { status: error?.code === "P0042" ? 429 : error ? 503 : 204 });
}
