import Link from "next/link";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";

async function HeaderNav() {
  const user = await getUser();
  if (!user) {
    return (
      <Link href="/login">
        <Button size="sm">로그인</Button>
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Link href="/app" className="text-sm hover:underline">내 작업</Link>
      <span className="hidden sm:inline-block max-w-[160px] truncate text-sm text-muted-foreground">{user.email}</span>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm">로그아웃</Button>
      </form>
    </div>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="group inline-flex items-center gap-2 font-semibold">
          <span className="relative flex h-6 w-6 items-center justify-center rounded-md bg-accent-brand text-[11px] font-bold text-accent-brand-foreground">
            T
          </span>
          <span className="tracking-tight">TubeToPost</span>
        </Link>
        <Suspense fallback={null}>
          <HeaderNav />
        </Suspense>
      </div>
    </header>
  );
}
