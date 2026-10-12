"use client";

import { useActionState } from "react";
import { sendMagicLink } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState(sendMagicLink, { error: null });
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} disabled={pending} aria-invalid={Boolean(state.error)} aria-describedby={state.error ? "login-error" : undefined} />
      </div>
      <p id="login-error" role="alert" className="text-sm text-destructive">{state.error}</p>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "메일 보내는 중…" : "매직링크 보내기"}</Button>
    </form>
  );
}
