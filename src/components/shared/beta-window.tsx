import { createPublicClient } from "@/lib/supabase/public";

export async function BetaWindow() {
  const db = await createPublicClient();
  const { data, error } = await db.rpc("beta_public_status");
  if (error || !data) return <p role="status">베타 운영 일정을 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.</p>;
  const ends = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: false }).format(new Date(data.ends_at));
  return (
    <aside className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed" aria-label="공개 베타 일정">
      <p className="font-semibold">{data.open ? "공개 테스트 진행 중" : "공개 테스트 신규 변환이 종료되었습니다"}</p>
      <p>신규 변환 종료: {ends} (한국 시간)</p>
      <p>서비스 전체 하루 약 {Math.floor(data.daily_credits / 2)}건 · 테스트 전체 약 {Math.floor(data.total_credits / 2)}건 한정입니다. 실패 시 처리 가능한 건수가 줄어들 수 있습니다.</p>
      <p>종료 후에도 로그인해 기존 결과를 확인하고 의견을 남길 수 있습니다.</p>
    </aside>
  );
}
