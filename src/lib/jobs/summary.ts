import type { JobSummary, JobSummaryRow } from "../../types/jobs";

export function toJobSummary(row: JobSummaryRow): JobSummary {
  return {
    id: row.id,
    status: row.status,
    video_id: row.video_id,
    video_title: row.video_title,
    video_thumbnail_url: row.video_thumbnail_url,
    post_id: row.post_id,
    created_at: row.created_at,
    error: row.error_code ? { code: row.error_code, message: row.error_message } : null,
  };
}
