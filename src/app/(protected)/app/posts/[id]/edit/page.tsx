import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PostEditor } from "./post-editor";
import { renderMarkdown } from "@/lib/markdown";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EditPostContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id,user_id,job_id,slug,title,content_markdown,is_public,revision")
    .eq("id", id)
    .maybeSingle();

  if (!data || data.user_id !== user.id) notFound();

  const { data: source } = await supabase.from("jobs")
    .select("video_id,video_title,transcript")
    .eq("id", data.job_id).eq("user_id", user.id).maybeSingle();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <PostEditor
      initialPost={{
        revision: data.revision as number,
        id: data.id as string,
        slug: data.slug as string,
        title: data.title as string,
        content_markdown: data.content_markdown as string,
        content_html: renderMarkdown(data.content_markdown),
        is_public: data.is_public as boolean,
      }}
      appUrl={appUrl}
      source={source ? { videoId: source.video_id, title: source.video_title, transcript: source.transcript } : null}
    />
  );
}

export default function EditPostPage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p role="status" className="p-6">편집할 글을 불러오고 있습니다…</p>}><EditPostContent {...props} /></Suspense>;
}
