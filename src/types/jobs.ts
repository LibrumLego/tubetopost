export const JOB_STATUSES = ["queued", "transcribing", "generating", "finalizing", "done", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export type TranscriptSource = "youtube_captions" | "whisper" | "supadata";

export interface JobSummaryRow {
  id: string;
  status: JobStatus;
  video_id: string;
  video_title: string | null;
  video_thumbnail_url: string | null;
  post_id: string | null;
  created_at: string;
  error_code: string | null;
  error_message: string | null;
}

export type JobSummary = Omit<JobSummaryRow, "error_code" | "error_message"> & {
  error: { code: string; message: string | null } | null;
};
