import { requireUser } from "@/lib/auth";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { toJobSummary } from "@/lib/jobs/summary";
import type { JobSummaryRow } from "@/types/jobs";
import { ConvertForm } from "./convert-form";
import { JobCard } from "./job-card";
import Link from "next/link";
import { BetaRequest } from "./beta-request";

async function AppContent() {
  const user = await requireUser();
  const supabase = await createClient();
  const recovered = await supabase.rpc("recover_my_jobs");
  if (recovered.error) throw new Error("JOB_RECOVERY_FAILED");

  const [profileRes, jobsRes, requestRes, capacityRes] = await Promise.all([
    supabase.from("profiles").select("plan, monthly_quota, used_this_month").eq("id", user.id).maybeSingle(),
    supabase
      .from("jobs")
      .select("id,status,video_id,video_title,video_thumbnail_url,post_id,error_code,error_message,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(20)
      .returns<JobSummaryRow[]>(),
    supabase.from("beta_requests").select("use_case,expected_monthly,note").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("beta_status"),
  ]);
  if (profileRes.error || jobsRes.error || requestRes.error || capacityRes.error) throw new Error("APP_DATA_UNAVAILABLE");

  const monthlyQuota = profileRes.data?.monthly_quota ?? 0;
  const usedThisMonth = profileRes.data?.used_this_month ?? 0;
  const quotaRemaining = Math.max(0, monthlyQuota - usedThisMonth);
  const jobs = (jobsRes.data ?? []).map(toJobSummary);

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-4 sm:p-8">
      <section className="space-y-4">
        <p className="text-sm text-muted-foreground">무료 베타 · 자막이 있는 20분 이하 영상 · <Link href="/beta" className="underline underline-offset-4">이용 안내</Link></p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">변환 시작</h1>
          <p className="text-sm text-muted-foreground">
            {profileRes.data?.plan === "developer" ? "개발자 테스트 · " : ""}이번 달 <span className="font-medium text-foreground">{usedThisMonth}/{monthlyQuota}</span> 사용
          </p>
        </div>
        <ConvertForm quotaRemaining={quotaRemaining} serviceLimited={!capacityRes.data?.available} />
      </section>
      <BetaRequest initial={requestRes.data} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">최근 작업</h2>
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">아직 변환한 영상이 없어요</p>
            <p className="mt-2 text-sm text-muted-foreground">위에 유튜브 URL을 붙여넣으면 바로 시작합니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function AppPage() {
  return <Suspense fallback={<p role="status" className="p-6">작업 목록을 불러오고 있습니다…</p>}><AppContent /></Suspense>;
}
