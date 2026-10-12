import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Card, CardHeader, CardContent, CardDescription } from "@/components/ui/card";
import { LoginForm } from "./login-form";

const AUTH_ERRORS: Record<string, string> = {
  missing_code: "로그인 코드가 없습니다. 새 링크를 요청해 주세요.",
  invalid_code: "로그인 링크가 만료되었거나 유효하지 않습니다. 새 링크를 요청해 주세요.",
};

async function LoginContent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getUser()) redirect("/app");
  const { error } = await searchParams;
  const errorMessage = error ? (AUTH_ERRORS[error] ?? AUTH_ERRORS.invalid_code) : null;
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Link href="/" className="text-sm font-medium">TubeToPost</Link>
        <h1 className="text-2xl font-semibold">이메일로 로그인</h1>
        <CardDescription>비밀번호 없이 로그인 링크로 시작하세요. 처음이라면 계정이 자동으로 만들어집니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
        <LoginForm />
        <p className="text-xs text-muted-foreground">로그인하면 이용약관에 동의한 것으로 간주합니다.</p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  return <main className="flex min-h-screen items-center justify-center p-4"><Suspense fallback={<p>로그인 화면을 준비하고 있습니다…</p>}><LoginContent {...props} /></Suspense></main>;
}
