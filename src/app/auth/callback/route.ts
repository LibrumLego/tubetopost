import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeAuthRedirect } from "@/lib/auth-redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=invalid_code", url.origin));
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid_code", url.origin));
  }
  return NextResponse.redirect(safeAuthRedirect(url.searchParams.get("next"), url.origin));
}
