export function safeAuthRedirect(next: string | null, origin: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return new URL("/app", origin);
  try {
    const target = new URL(next, origin);
    return target.origin === new URL(origin).origin ? target : new URL("/app", origin);
  } catch {
    return new URL("/app", origin);
  }
}
