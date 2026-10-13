"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/types/jobs";
import { JOB_STATUS_LABELS, isInProgress, youtubeThumbnail } from "@/lib/jobs/display";

interface JobDetail {
  id: string;
  status: JobStatus;
  video_id: string;
  video_title: string | null;
  video_thumbnail_url: string | null;
  post_id: string | null;
  created_at: string;
  error: { code: string; message: string | null } | null;
  progress: { step: JobStatus; percent: number | null };
}

const STATUS_MESSAGES: Record<JobStatus, string> = {
  queued: "순서를 기다리고 있어요",
  transcribing: "자막을 추출하는 중이에요",
  generating: "AI가 글을 작성하고 있어요",
  finalizing: "마무리하고 있어요",
  done: "완료되었어요",
  failed: "변환에 실패했어요",
};

const FAILURE_MESSAGES: Record<string, string> = {
  NO_TRANSCRIPT: "자막을 가져오지 못했어요. 자막이 있어도 YouTube에서 자동 추출을 제한할 수 있습니다. 다른 영상을 시도해 주세요.",
  GENERATION_FAILED: "AI 생성에 일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
  INTERNAL: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
};

export function JobPolling({ initialJob }: { initialJob: JobDetail }) {
  const [job, setJob] = useState(initialJob);
  const router = useRouter();

  useEffect(() => {
    if (!isInProgress(job.status)) {
      if (job.status === "done" && job.post_id) {
        router.replace(`/app/posts/${job.post_id}/edit`);
      }
      return;
    }
    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 404) {
          cancelled = true;
          clearInterval(interval);
          router.replace("/app");
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setJob(data.job);
      } catch {
        // Transient fetch errors are retried on the next tick.
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [job.id, job.status, job.post_id, router]);

  const percent = job.progress?.percent ?? (job.status === "failed" ? 100 : 0);
  const thumbnail = job.video_thumbnail_url ?? youtubeThumbnail(job.video_id);
  const failureMessage = job.error ? FAILURE_MESSAGES[job.error.code] ?? job.error.message ?? FAILURE_MESSAGES.INTERNAL : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
      <Link href="/app" className="text-sm text-muted-foreground hover:underline">← 작업 목록으로</Link>

      <div className="overflow-hidden rounded-lg border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnail} alt="" className="aspect-video w-full bg-muted object-cover" />
        <div className="p-4 sm:p-6">
          <h1 className="text-lg font-semibold">{job.video_title ?? "영상 정보를 불러오는 중…"}</h1>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{STATUS_MESSAGES[job.status]}</span>
          <span className="text-muted-foreground">{JOB_STATUS_LABELS[job.status]}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all duration-500 ${job.status === "failed" ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${percent}%` }}
            aria-hidden
          />
        </div>
        <p aria-live="polite" className="sr-only">{STATUS_MESSAGES[job.status]}</p>
      </div>

      {job.status === "failed" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{failureMessage}</p>
          <div className="mt-3">
            <Link href="/app">
              <Button variant="outline" size="sm">작업 목록으로</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
