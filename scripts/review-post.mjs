// Administrative, read-only review helper. It never publishes or edits a post.
import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";
loadEnvFile(".env.local");
const id = process.argv[2];
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? "")) {
  throw new Error("Usage: node scripts/review-post.mjs <post-uuid>");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Server Supabase configuration is required");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: post, error } = await db.from("posts")
  .select("id,job_id,title,slug,is_public,content_markdown").eq("id", id).single();
if (error) throw new Error(`Post lookup failed (${error.code})`);
const { data: job, error: sourceError } = await db.from("jobs")
  .select("video_id,video_duration_sec,transcript").eq("id", post.job_id).single();
if (sourceError) throw new Error(`Source lookup failed (${sourceError.code})`);
const text = post.content_markdown;
const headings = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => m[1].trim());
const flags = [...text.matchAll(/MRI|연구|실험|입증|증명|박사|과학적으로|반드시|항상|절대로|보장/g)]
  .map(m => ({ keyword: m[0], context: text.slice(Math.max(0, m.index - 35), m.index + m[0].length + 45).replace(/\s+/g, " ") }));
const normalizedSource = job.transcript?.replace(/,/g, "") ?? "";
const withoutLinks = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
const numbers = [...new Set(withoutLinks.match(/\d+(?:[.,]\d+)*/g) ?? [])];
console.log(JSON.stringify({
  post_id: post.id, title: post.title, slug: post.slug, is_public: post.is_public,
  source: { video_id: job.video_id, duration_sec: job.video_duration_sec, transcript_available: !!job.transcript },
  characters: text.length, headings,
  duplicate_headings: [...new Set(headings.filter((h, i) => headings.indexOf(h) !== i))],
  video_links: [...text.matchAll(/https:\/\/www\.youtube\.com\/watch\?v=[\w-]+&t=\d+/g)].map(m => m[0]),
  potential_claims_to_review: flags,
  numbers_without_literal_source_match: numbers.filter(n => !normalizedSource.includes(n.replace(/,/g, ""))),
  note: "검수 보조용 휴리스틱입니다. 키워드·숫자 불일치는 오류 판정이 아니며, 경고가 없어도 정확성을 보장하지 않습니다. 원문 대조 후 공개 여부를 결정하세요.",
}, null, 2));
