"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ConvertForm({ quotaRemaining, serviceLimited = false }: { quotaRemaining: number; serviceLimited?: boolean }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const disabled = quotaRemaining <= 0 || serviceLimited || isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtube_url: url }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error?.message ?? "오류가 발생했습니다.");
          return;
        }
        router.push(`/app/jobs/${data.job.id}`);
      } catch {
        setError("요청에 실패했습니다. 다시 시도해 주세요.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="url"
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={disabled}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "convert-error" : undefined}
          className="flex-1"
        />
        <Button type="submit" disabled={disabled || !url}>
          {isPending ? "변환 요청 중…" : "변환하기"}
        </Button>
      </div>
      {error && <p id="convert-error" role="alert" className="text-sm text-destructive">{error}</p>}
      {serviceLimited && <p role="status" className="text-sm text-muted-foreground">무료 베타의 전체 처리 한도에 도달했습니다. 나중에 페이지를 새로고침해 주세요.</p>}
      {quotaRemaining <= 0 && (
        <p className="text-sm text-muted-foreground">이번 달 변환 한도를 모두 사용했습니다. 다음 달에 다시 시도해 주세요.</p>
      )}
    </form>
  );
}
