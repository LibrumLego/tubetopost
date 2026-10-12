import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PostEditor } from "./post-editor";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id,user_id,slug,title,content_markdown,content_html,is_public")
    .eq("id", id)
    .maybeSingle();

  if (!data || data.user_id !== user.id) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <PostEditor
      initialPost={{
        id: data.id as string,
        slug: data.slug as string,
        title: data.title as string,
        content_markdown: data.content_markdown as string,
        content_html: data.content_html as string,
        is_public: data.is_public as boolean,
      }}
      appUrl={appUrl}
    />
  );
}
