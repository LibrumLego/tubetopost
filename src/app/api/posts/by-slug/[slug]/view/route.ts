import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return new Response(null, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("increment_view_count", { p_slug: slug });
  if (error) return new Response(null, { status: error.code === "P0042" ? 429 : 500 });
  return new Response(null, { status: 204 });
}
