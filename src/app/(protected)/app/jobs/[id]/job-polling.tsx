"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/types/jobs";
import { JOB_STATUS_LABELS, isInProgress, youtubeThumbnail } from "@/lib/jobs/display";

interface JobDetail {
  retry_count?: number;
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
  JOB_TIMEOUT: "작업 응답이 없어 중단했습니다. 다시 시도할 수 있습니다.",
  COST_LIMIT: "이 작업의 생성 비용 한도에 도달했습니다.",
  SOURCE_TOO_SHORT: "자막 내용이 너무 짧아 근거 있는 글을 만들기 어렵습니다. 다른 영상을 시도해 주세요.",
  DURATION_UNAVAILABLE: "영상 길이를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  TRANSCRIPT_PROVIDER_LIMITED: "자막 공급자의 요청 속도 또는 사용량 제한에 도달했어요. 잠시 후 다시 시도해 주세요.",
  VIDEO_TOO_LONG: "자막이 20분 구간 또는 처리 가능한 분량을 초과했어요. 더 짧은 영상을 시도해 주세요.",
  NO_TRANSCRIPT: "자막을 가져오지 못했어요. 자막이 있어도 YouTube에서 자동 추출을 제한할 수 있습니다. 다른 영상을 시도해 주세요.",
  GENERATION_FAILED: "AI 생성에 일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
  INTERNAL: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
};

export function JobPolling({ initialJob }: { initialJob: JobDetail }) {
  const [job, setJob] = useState(initialJob);
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  async function retry() {
    setRetrying(true); setRetryError(null);
    try {
      const response = await fetch(`/api/jobs/${job.id}/retry`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) { setRetryError(result.error?.message ?? "재시도하지 못했습니다."); return; }
      const refreshed = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
      if (!refreshed.ok) throw new Error();
      setJob((await refreshed.json()).job);
    } catch { setRetryError("재시도 결과를 확인하지 못했습니다. 화면을 새로고침해 주세요."); }
    finally { setRetrying(false); }
  }

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
            <Button size="sm" onClick={retry} disabled={retrying || (job.retry_count ?? 0) >= 3}>{retrying ? "재시도 요청 중…" : "다시 시도"}</Button>
            {retryError && <p role="alert" className="mt-2 text-sm text-destructive">{retryError}</p>}
            <Link href="/app">
              <Button variant="outline" size="sm">작업 목록으로</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
