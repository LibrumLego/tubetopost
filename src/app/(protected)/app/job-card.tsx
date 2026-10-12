import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JobSummary } from "@/types/jobs";
import { JOB_STATUS_LABELS, formatRelativeTime, isInProgress, youtubeThumbnail } from "@/lib/jobs/display";

function statusVariant(status: JobSummary["status"]): "default" | "secondary" | "destructive" {
  if (status === "done") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

export function JobCard({ job }: { job: JobSummary }) {
  const inProgress = isInProgress(job.status);
  return (
    <div className="flex items-center gap-4 rounded-lg border p-3">
      <Link
        href={job.status === "done" && job.post_id ? `/app/posts/${job.post_id}/edit` : `/app/jobs/${job.id}`}
        className="flex items-center gap-4 flex-1 min-w-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={youtubeThumbnail(job.video_id)}
          alt=""
          width={120}
          height={68}
          className="h-[68px] w-[120px] shrink-0 rounded object-cover bg-muted"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{job.video_title ?? "제목을 불러오는 중…"}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={statusVariant(job.status)}>{JOB_STATUS_LABELS[job.status]}</Badge>
            <span>{formatRelativeTime(job.created_at)}</span>
          </div>
          {job.error && (
            <div className="mt-1 truncate text-xs text-destructive">{job.error.message ?? "오류가 발생했습니다."}</div>
          )}
        </div>
      </Link>
      <div className="shrink-0">
        {job.status === "done" && job.post_id && (
          <Link href={`/app/posts/${job.post_id}/edit`}>
            <Button size="sm" variant="outline">결과 보기</Button>
          </Link>
        )}
        {inProgress && (
          <Link href={`/app/jobs/${job.id}`}>
            <Button size="sm" variant="outline">진행 상황</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
