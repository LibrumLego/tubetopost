import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jobProgress } from "@/lib/jobs/state";
import type { JobStatus, TranscriptSource } from "@/types/jobs";
import { JobPolling } from "./job-polling";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("id,status,video_id,video_title,video_thumbnail_url,post_id,error_code,error_message,created_at,transcript_source")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const status = data.status as JobStatus;
  const initialJob = {
    id: data.id as string,
    status,
    video_id: data.video_id as string,
    video_title: (data.video_title as string | null) ?? null,
    video_thumbnail_url: (data.video_thumbnail_url as string | null) ?? null,
    post_id: (data.post_id as string | null) ?? null,
    created_at: data.created_at as string,
    error: data.error_code
      ? { code: data.error_code as string, message: (data.error_message as string | null) ?? null }
      : null,
    progress: jobProgress(status, data.transcript_source as TranscriptSource | null),
  };

  return <JobPolling initialJob={initialJob} />;
}
