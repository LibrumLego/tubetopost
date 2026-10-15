import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ViewTracker } from "./view-tracker";
import { getSiteOrigin } from "@/lib/site-url";

export const instant = false;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface Post {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  content_html: string;
  cover_image_url: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  is_public: boolean;
}

async function fetchPost(slug: string): Promise<Post | null> {
  if (!SLUG_RE.test(slug) || slug.length > 120) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("slug,title,description,keywords,content_html,cover_image_url,view_count,created_at,updated_at,is_public")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || !data.is_public) return null;
  return data as Post;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) return { title: "글을 찾을 수 없습니다" };
  const appUrl = getSiteOrigin();
  const url = appUrl ? `${appUrl}/post/${post.slug}` : undefined;
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url,
      images: post.cover_image_url ? [{ url: post.cover_image_url }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
  };
}

export default async function PublicPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  const created = new Date(post.created_at).toLocaleDateString("ko-KR");
  const appUrl = getSiteOrigin();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: post.cover_image_url ?? undefined,
    datePublished: post.created_at,
    dateModified: post.updated_at,
    url: appUrl ? `${appUrl}/post/${post.slug}` : undefined,
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <ViewTracker slug={post.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {post.cover_image_url && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={post.cover_image_url}
          alt=""
          className="mb-8 aspect-video w-full rounded-lg object-cover bg-muted"
        />
      )}

      <header className="mb-8 space-y-3">
        <h1 className="break-keep text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
        {post.description && <p className="text-lg text-muted-foreground">{post.description}</p>}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <time dateTime={post.created_at}>{created}</time>
          <span>·</span>
          <span>조회 {post.view_count.toLocaleString("ko-KR")}</span>
        </div>
      </header>

      <div className="prose-tubetopost" dangerouslySetInnerHTML={{ __html: post.content_html }} />

      <footer className="mt-16 rounded-lg border bg-muted/30 p-6 text-center">
        <p className="font-medium">이 글은 유튜브 영상에서 자동 변환되었습니다</p>
        <p className="mt-2 text-sm text-muted-foreground">TubeToPost는 유튜브 영상을 블로그 글로 바꿔주는 서비스입니다.</p>
        <div className="mt-4">
          <Link href="/"><Button>나도 변환해 보기</Button></Link>
        </div>
      </footer>
    </article>
  );
}
