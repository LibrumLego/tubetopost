export const JOB_STATUSES = ["queued", "transcribing", "generating", "finalizing", "done", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export type TranscriptSource = "youtube_captions" | "whisper";
