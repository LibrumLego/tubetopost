import Link from "next/link";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { createPublicClient } from "@/lib/supabase/public";

async function RecentPublicPosts() {
  const db = await createPublicClient();
  const { data, error } = await db.from("posts")
    .select("slug,title,description,cover_image_url")
    .eq("is_public", true).order("created_at", { ascending: false }).limit(6);
  if (error) {
    console.error("[landing] public posts unavailable");
    return null;
  }
  if (!data.length) return null;
  return (
    <section aria-labelledby="public-posts-heading" className="mx-auto max-w-5xl px-4 py-12">
      <h2 id="public-posts-heading" className="text-center text-2xl font-bold sm:text-3xl">최근 공개 글</h2>
      <p className="mt-3 text-center text-sm text-muted-foreground">영상에서 시작해 편집하고 공개한 글을 읽어보세요.</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((post) => (
          <Link key={post.slug} href={`/post/${post.slug}`} className="overflow-hidden rounded-lg border transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-4">
            {post.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.cover_image_url} alt="" loading="lazy" className="aspect-video w-full object-cover" />
            )}
            <div className="space-y-3 p-5">
              <h3 className="break-keep font-semibold leading-relaxed">{post.title}</h3>
              <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{post.description}</p>
              <span className="inline-block text-sm font-medium underline underline-offset-4">글 읽기</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function HeroCta() {
  const user = await getUser();
  const href = user ? "/app" : "/login";
  const label = user ? "앱으로 이동" : "무료로 시작하기";
  return (
    <Link href={href}>
      <Button size="lg" className="h-12 px-8 text-base">{label}</Button>
    </Link>
  );
}

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:py-28 text-center">
        <p className="mb-4 text-sm font-medium text-primary">무료 베타 · 영상에서 읽고 쓸 수 있는 글로</p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          유튜브 영상, <span className="text-primary">블로그 글</span>로 10분 안에
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          자막 추출 + AI 재구성 + SEO 메타까지 자동. URL 하나만 붙여넣으면 끝.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Suspense fallback={<Button size="lg" className="h-12 px-8 text-base" disabled>준비 중</Button>}>
            <HeroCta />
          </Suspense>
          <a href="#how" className="text-sm font-medium underline underline-offset-4">작동 방식 보기</a>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">월 3회 무료 · 자막이 있는 20분 이하 영상 · 신용카드 필요 없음</p>
        <p className="mt-2 text-xs text-muted-foreground">전체 처리 한도에 따라 일시 중단될 수 있습니다. <Link href="/beta" className="underline underline-offset-4">베타 이용 안내</Link></p>
      </section>

      {/* Before / After */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl">같은 영상, 10배 읽기 쉬운 글로</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-6">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Before · 유튜브 자막</div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              &ldquo;어 그래서 뭐냐면 이게 이제 되게 중요한 부분인데 음… 많은 분들이 놓치는 거 같아요 사실 이거를 모르면 나중에 큰일 나거든요 그래서 지금부터 설명드릴 건데…&rdquo;
            </p>
          </div>
          <div className="rounded-lg border bg-background p-6 shadow-sm">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-primary">After · 블로그 글</div>
            <h3 className="mb-2 font-semibold">많은 사람이 놓치는 중요한 포인트</h3>
            <p className="text-sm leading-relaxed">
              이 포인트를 모르면 나중에 큰 문제가 생긴다. 많은 사람이 당장 눈에 보이지 않는다는 이유로 지나치지만, 작은 차이가 결과를 완전히 바꾼다.
            </p>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <RecentPublicPosts />
      </Suspense>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-5xl px-4 py-20">
        <h2 className="mb-12 text-center text-2xl font-bold sm:text-3xl">3단계로 끝</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { n: "01", t: "URL 붙여넣기", d: "변환할 유튜브 영상 주소를 입력합니다." },
            { n: "02", t: "AI가 변환", d: "자막을 추출하고 블로그 글로 재구성합니다." },
            { n: "03", t: "복사 또는 공유", d: "마크다운 복사, HTML 복사, 공개 URL 공유." },
          ].map((s) => (
            <div key={s.n} className="rounded-lg border p-6">
              <div className="mb-3 text-2xl font-bold text-primary">{s.n}</div>
              <h3 className="mb-2 font-semibold">{s.t}</h3>
              <p className="text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">지금 바로 변환해보세요</h2>
        <p className="mt-4 text-muted-foreground">가입 즉시 월 3개 무료 변환이 제공됩니다.</p>
        <div className="mt-8">
          <Suspense fallback={<Button size="lg" className="h-12 px-8 text-base" disabled>준비 중</Button>}>
            <HeroCta />
          </Suspense>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-xs text-muted-foreground">
          © 2026 TubeToPost
          <span className="mx-2">·</span><Link href="/beta" className="underline underline-offset-4">베타·사용 측정 안내</Link>
        </div>
      </footer>
    </main>
  );
}
