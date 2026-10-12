import type { JobStatus } from "@/types/jobs";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: "대기 중",
  transcribing: "자막 추출 중",
  generating: "글 작성 중",
  finalizing: "마무리 중",
  done: "완료",
  failed: "실패",
};

export function isInProgress(status: JobStatus): boolean {
  return status === "queued" || status === "transcribing" || status === "generating" || status === "finalizing";
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "방금 전";
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
