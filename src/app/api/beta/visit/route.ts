import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > 256) return new Response(null, { status: 413 });
  let body;
  try { const text = await request.text(); if (text.length > 256) return new Response(null, { status: 413 }); body = JSON.parse(text); }
  catch { return new Response(null, { status: 400 }); }
  if (!["landing", "login", "app", "public_post"].includes(body?.page)
    || !["direct", "search", "social", "other", "internal"].includes(body?.source)) return new Response(null, { status: 400 });
  const { error } = await createAdminClient().rpc("record_beta_visit", { p_page: body.page, p_source: body.source });
  return new Response(null, { status: error ? 503 : 204 });
}
