import { requireUser } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";

export default async function AppPage() {
  const user = await requireUser();
  return <div className="mx-auto max-w-3xl space-y-4 p-8">
    <h1 className="text-2xl font-semibold">환영합니다</h1>
    <p className="break-all text-muted-foreground">{user.email}</p>
    <p>로그인되었습니다. 영상 변환 화면은 준비 중입니다.</p>
    <form action={signOut}><Button type="submit" variant="outline">로그아웃</Button></form>
  </div>;
}
