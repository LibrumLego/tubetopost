import Link from "next/link";
import { Suspense } from "react";
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
    <section aria-labelledby="public-posts-heading" className="mx-auto max-w-6xl px-4 py-24 sm:py-32">
      <div className="mb-12 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent-brand">공개 글</p>
          <h2 id="public-posts-heading" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">실제로 생성하고 공개한 글</h2>
        </div>
        <p className="hidden max-w-xs text-sm text-muted-foreground sm:block text-pretty">
          AI가 만든 초안은 원문 대조가 필요합니다. 검수 여부는 각 글의 안내를 확인해 주세요.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((post) => (
          <Link
            key={post.slug}
            href={`/post/${post.slug}`}
            className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all hover:border-accent-brand/50 hover:shadow-lg hover:shadow-accent-brand/5"
          >
            {post.cover_image_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={post.cover_image_url} alt="" loading="lazy" className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
            )}
            <div className="flex flex-1 flex-col gap-3 p-6">
              <h3 className="break-keep font-semibold leading-snug text-pretty">{post.title}</h3>
              <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground text-pretty">{post.description}</p>
              <div className="flex items-center gap-1 text-sm font-medium text-accent-brand">
                <span>글 읽기</span>
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HeroCta() {
  const href = "/demo";
  const label = "로그인 없이 데모 체험";
  return (
    <Link href={href}>
      <Button size="lg" className="h-12 px-7 text-base shadow-lg shadow-accent-brand/20 bg-accent-brand text-accent-brand-foreground hover:bg-accent-brand/90">
        {label}
        <svg className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
      </Button>
    </Link>
  );
}

export default function LandingPage() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-[500px] accent-glow" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="mx-auto max-w-fit">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-brand" aria-hidden />
              직접 만들고 배포한 서비스 · Portfolio
            </div>
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl text-center text-5xl font-bold tracking-tight text-balance sm:text-6xl md:text-7xl">
            영상 대신,
            <br className="sm:hidden" />
            <span className="relative inline-block px-2">
              <span className="relative z-10">읽는 글</span>
              <span className="absolute inset-x-0 bottom-1 h-3 bg-accent-brand/20 -skew-x-6" aria-hidden />
            </span>
            로 보세요
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-center text-lg leading-relaxed text-muted-foreground text-pretty">
            유튜브 URL 하나로 자막을 추출하고, 편집 가능한 한국어 블로그 글로 재구성합니다.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Suspense fallback={<Button size="lg" className="h-12 px-7 text-base" disabled>준비 중</Button>}>
              <HeroCta />
            </Suspense>
            <a href="/project" className="group inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              설계와 운영 경험
              <svg className="h-4 w-4 transition-transform group-hover:translate-y-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
            </a>
          </div>
          <p className="mx-auto mt-5 max-w-xl text-center text-xs leading-relaxed text-muted-foreground">예시 데모는 실제 AI 호출이나 서버 저장을 하지 않습니다. 실제 변환은 로그인과 운영 한도가 적용됩니다.</p>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-accent-brand" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              로그인 없는 예시 체험
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-accent-brand" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              실제 생성 결과 공개
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-accent-brand" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              설계·검증 과정 소개
            </div>
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="border-t bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-accent-brand">결과물</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl text-balance">
              흩어진 말을 읽히는 문단으로
            </h2>
            <p className="mt-4 text-muted-foreground text-pretty">
              섹션별 초안을 만들고 원문과 대조하며 다듬습니다. 아래는 흐름을 설명하는 예시 문구입니다.
            </p>
          </div>
          <div className="mt-16 grid gap-6 lg:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl border bg-background p-8">
              <div className="mb-5 inline-flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40" aria-hidden />
                <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">Before · 자막 원문</div>
              </div>
              <p className="text-[15px] leading-loose text-muted-foreground">
                어 그래서 뭐냐면 이게 이제 되게 중요한 부분인데 음… 많은 분들이 놓치는 거 같아요 사실 이거를 모르면 나중에 큰일 나거든요 그래서 지금부터 설명드릴 건데…
              </p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border bg-background p-8 shadow-xl shadow-accent-brand/5">
              <div className="absolute right-6 top-6">
                <div className="rounded-full bg-accent-brand/10 px-2.5 py-1 text-xs font-medium text-accent-brand">AI 변환</div>
              </div>
              <div className="mb-5 inline-flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent-brand" aria-hidden />
                <div className="text-xs font-mono font-medium uppercase tracking-wider text-accent-brand">After · 블로그 글</div>
              </div>
              <h3 className="mb-3 text-lg font-semibold text-balance">많은 사람이 놓치는 중요한 포인트</h3>
              <p className="text-[15px] leading-loose text-pretty">
                이 포인트를 모르면 나중에 큰 문제가 생긴다. 많은 사람이 당장 눈에 보이지 않는다는 이유로 지나치지만, 작은 차이가 결과를 완전히 바꾼다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <RecentPublicPosts />
      </Suspense>

      {/* How it works */}
      <section id="how" className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-accent-brand">작동 방식</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl text-balance">URL 하나, 세 단계</h2>
          </div>
          <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-6">
            {[
              { n: "01", t: "URL 붙여넣기", d: "자막이 있는 20분 이하 YouTube 영상 주소를 입력합니다." },
              { n: "02", t: "AI가 재구성", d: "자막을 추출하고 섹션별 초안을 생성합니다. 진행 상태와 실패 사유를 확인할 수 있습니다." },
              { n: "03", t: "편집·공유", d: "Markdown으로 복사하거나, 공개 토글을 켜서 링크 하나로 공유합니다." },
            ].map((s, i) => (
              <div key={s.n} className="group relative">
                {i < 2 && (
                  <div className="absolute right-0 top-6 hidden h-px w-full translate-x-1/2 bg-gradient-to-r from-border to-transparent md:block" aria-hidden />
                )}
                <div className="relative flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-background font-mono text-sm font-semibold text-accent-brand transition-colors group-hover:border-accent-brand/50 group-hover:bg-accent-brand/5">
                    {s.n}
                  </div>
                  <div className="pt-1">
                    <h3 className="font-semibold">{s.t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{s.d}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t">
        <div className="relative mx-auto max-w-5xl px-4 py-24 sm:py-32">
          <div className="absolute inset-x-0 top-0 h-40 accent-glow opacity-70" aria-hidden />
          <div className="relative mx-auto max-w-xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">
              화면 너머의 설계도
              <br />
              <span className="text-accent-brand">함께 살펴</span>보세요.
            </h2>
            <p className="mt-5 text-muted-foreground text-pretty">비동기 처리, 자동저장 충돌, 권한과 비용 제한까지. 서비스로 내놓으며 해결한 문제를 기록했습니다.</p>
            <div className="mt-10">
              <Link href="/project" className="inline-flex min-h-12 items-center rounded-xl bg-accent-brand px-7 font-medium text-accent-brand-foreground">설계와 운영 경험 보기 →</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <div className="font-semibold">TubeToPost</div>
              <p className="text-xs text-muted-foreground">유튜브 영상을 읽는 글로 바꾸는 서비스</p>
            </div>
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Link href="/demo" className="hover:text-foreground">데모 체험</Link>
              <Link href="/project" className="hover:text-foreground">프로젝트 소개</Link>
              <Link href="/beta" className="hover:text-foreground">실제 변환 이용 안내</Link>
              <Link href="/login" className="hover:text-foreground">로그인</Link>
            </nav>
          </div>
          <div className="mt-8 border-t pt-6 text-xs text-muted-foreground">
            © 2026 TubeToPost. 배포된 개인 프로젝트입니다. AI 초안의 사실과 표현은 원문 대조가 필요합니다.
          </div>
        </div>
      </footer>
    </main>
  );
}
