import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!slug || slug.length > 120) return new Response(null, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("increment_view_count", { p_slug: slug });
  if (error) return new Response(null, { status: 500 });
  return new Response(null, { status: 204 });
}
