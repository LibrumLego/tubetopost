import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { sameOriginMutation } from "@/lib/security/request";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (!sameOriginMutation(request)) return NextResponse.json({ error: { code: "INVALID_ORIGIN", message: "요청 출처가 올바르지 않습니다." } }, { status: 403 });
    const limit = request.method === "PATCH" ? 210000 : 8192;
    const length = request.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > limit)) return new NextResponse(null, { status: 413 });
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
