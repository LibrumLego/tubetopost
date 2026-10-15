"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type BetaRequestData = { use_case: string; expected_monthly: string; note: string };

export function BetaRequest({ initial }: { initial: BetaRequestData | null }) {
  const [useCase, setUseCase] = useState(initial?.use_case ?? "study");
  const [monthly, setMonthly] = useState(initial?.expected_monthly ?? "4-10");
  const [note, setNote] = useState(initial?.note ?? "");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(Boolean(initial));
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/beta/request", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_case: useCase, expected_monthly: monthly, note }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message ?? "신청을 저장하지 못했습니다.");
      setSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : "신청을 저장하지 못했습니다."); }
    finally { setPending(false); }
  }

  return (
    <section className="space-y-4 rounded-lg border p-5" aria-labelledby="beta-pack-heading">
      <div className="space-y-2">
        <h2 id="beta-pack-heading" className="text-lg font-semibold">추가 변환이 필요하신가요?</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">일회성 추가 변환 팩을 준비하고 있습니다. 필요한 용도와 분량을 알려주세요. 현재는 수요 조사이며, 결제나 추가 한도 지급은 진행되지 않습니다.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm"><span>주로 쓰려는 용도</span>
            <select value={useCase} onChange={e => { setUseCase(e.target.value); setSaved(false); }} disabled={pending} className="w-full rounded-md border bg-background p-2">
              <option value="study">강의·학습 정리</option><option value="content">블로그·콘텐츠 제작</option><option value="work">업무·자료 정리</option><option value="other">기타</option>
            </select>
          </label>
          <label className="space-y-2 text-sm"><span>한 달에 필요한 총 변환 수</span>
            <select value={monthly} onChange={e => { setMonthly(e.target.value); setSaved(false); }} disabled={pending} className="w-full rounded-md border bg-background p-2">
              <option value="4-10">4~10회</option><option value="11-30">11~30회</option><option value="31+">31회 이상</option>
            </select>
          </label>
        </div>
        <label className="block space-y-2 text-sm"><span>불편한 점이나 원하는 기능 (선택)</span>
          <Textarea value={note} onChange={e => { setNote(e.target.value); setSaved(false); }} disabled={pending} maxLength={500} placeholder="결과물을 어디에 활용하는지 알려주셔도 좋아요. 개인정보는 입력하지 마세요." />
        </label>
        <p className="text-xs leading-relaxed text-muted-foreground">신청 내용은 로그인 계정과 연결해 베타 개선에 활용합니다. 언제든 내용을 수정할 수 있습니다.</p>
        <Button type="submit" disabled={pending}>{pending ? "저장 중…" : initial ? "신청 내용 수정" : "추가 변환 관심 등록"}</Button>
        {saved && <p role="status" className="text-sm">관심 등록이 저장되었습니다. 가격과 출시 일정은 아직 정해지지 않았습니다.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </form>
    </section>
  );
}
