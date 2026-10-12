import type { JobStatus, TranscriptSource } from "@/types/jobs";

const transitions: Record<JobStatus, readonly JobStatus[]> = {
  queued: ["transcribing", "failed"],
  transcribing: ["generating", "failed"],
  generating: ["finalizing", "failed"],
  finalizing: ["done", "failed"],
  done: [],
  failed: ["queued"],
};

export function canTransition(from: JobStatus, to: JobStatus) {
  return transitions[from].includes(to);
}

export function jobProgress(status: JobStatus, source?: TranscriptSource | null) {
  const percent = { queued: 5, transcribing: source === "whisper" ? 40 : 20, generating: 70, finalizing: 90, done: 100, failed: null };
  return { step: status, percent: percent[status] };
}
