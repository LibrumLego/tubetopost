"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(_state: { error: string | null }, formData: FormData): Promise<{ error: string | null }> {
  const value = formData.get("email");
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "올바른 이메일 주소를 입력해 주세요." };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.NEXT_PUBLIC_APP_URL) {
    console.error("[auth] Missing required environment variables for magic link");
    return { error: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
  try {
    const callback = new URL("/auth/callback", process.env.NEXT_PUBLIC_APP_URL);
    if (!["http:", "https:"].includes(callback.protocol)) throw new Error("Invalid app URL");
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback.toString(), shouldCreateUser: true },
    });
    if (error) {
      return { error: error.status === 429 ? "너무 많은 요청입니다. 1분 후 다시 시도해 주세요." : "메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." };
    }
  } catch {
    return { error: "메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
  redirect(`/auth/check-email?email=${encodeURIComponent(email)}`);
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("로그아웃하지 못했습니다. 다시 시도해 주세요.");
  redirect("/");
}
