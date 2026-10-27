import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { getSiteOrigin } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const db = await createPublicClient();
  const entries: MetadataRoute.Sitemap = [{ url: origin }, { url: `${origin}/demo` }, { url: `${origin}/project` }];
  // Keyset avoids shifting offsets when posts are published/removed mid-request.
  // This is a live traversal, not a database snapshot of concurrent changes.
  let afterId: string | undefined;
  for (;;) {
    let query = db.from("posts").select("id,slug,updated_at")
      .eq("is_public", true).order("id").limit(1000);
    if (afterId) query = query.gt("id", afterId);
    const { data, error } = await query;
    if (error) throw new Error("PUBLIC_SITEMAP_UNAVAILABLE");
    for (const post of data) entries.push({ url: `${origin}/post/${post.slug}`, lastModified: post.updated_at });
    if (data.length < 1000) break;
    afterId = data[data.length - 1].id;
  }
  return entries;
}
