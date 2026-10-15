import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { getSiteOrigin } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const db = await createPublicClient();
  const entries: MetadataRoute.Sitemap = [{ url: origin }];
  // PostgREST defaults to 1,000 rows; include every public post beyond that limit.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("posts").select("slug,updated_at")
      .eq("is_public", true).order("id").range(offset, offset + 999);
    if (error) throw new Error("PUBLIC_SITEMAP_UNAVAILABLE");
    for (const post of data) entries.push({ url: `${origin}/post/${post.slug}`, lastModified: post.updated_at });
    if (data.length < 1000) break;
  }
  return entries;
}
