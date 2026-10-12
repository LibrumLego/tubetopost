import { Suspense } from "react";
import Link from "next/link";

async function EmailNotice({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <p className="break-all text-muted-foreground">{email ? <><b>{email}</b>로 </> : ""}로그인 링크를 보냈습니다. 메일함을 확인해 주세요.</p>;
}

export default function CheckEmailPage(props: { searchParams: Promise<{ email?: string }> }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">메일을 확인해 주세요</h1>
        <Suspense fallback={<p>메일함에서 로그인 링크를 확인해 주세요.</p>}><EmailNotice {...props} /></Suspense>
        <p className="text-sm text-muted-foreground">메일이 오지 않았나요? 스팸함을 확인하거나 1분 후 다시 시도해 주세요. 링크는 요청한 브라우저에서 열어 주세요.</p>
        <Link href="/login" className="inline-block text-sm underline">이메일 다시 입력하기</Link>
      </div>
    </main>
  );
}
