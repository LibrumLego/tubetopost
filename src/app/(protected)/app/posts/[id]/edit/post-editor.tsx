"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Post {
  id: string;
  slug: string;
  title: string;
  content_markdown: string;
  content_html: string;
  is_public: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function PostEditor({ initialPost, appUrl }: { initialPost: Post; appUrl: string }) {
  const [title, setTitle] = useState(initialPost.title);
  const [markdown, setMarkdown] = useState(initialPost.content_markdown);
  const [html, setHtml] = useState(initialPost.content_html);
  const [isPublic, setIsPublic] = useState(initialPost.is_public);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [copyLabel, setCopyLabel] = useState<"Markdown 복사" | "복사됨!">("Markdown 복사");
  const [isDeleting, startDelete] = useTransition();
  const router = useRouter();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef({ title: initialPost.title, markdown: initialPost.content_markdown });

  useEffect(() => {
    if (title === lastSaved.current.title && markdown === lastSaved.current.markdown) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("idle");
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        const patch: Record<string, unknown> = {};
        if (title !== lastSaved.current.title) patch.title = title;
        if (markdown !== lastSaved.current.markdown) patch.content_markdown = markdown;
        const res = await fetch(`/api/posts/${initialPost.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) { setSaveState("error"); return; }
        const data = await res.json();
        if (data.post?.content_html) setHtml(data.post.content_html);
        lastSaved.current = { title, markdown };
        setSaveState("saved");
      } catch { setSaveState("error"); }
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [title, markdown, initialPost.id]);

  async function togglePublic(next: boolean) {
    setIsPublic(next);
    try {
      const res = await fetch(`/api/posts/${initialPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: next }),
      });
      if (!res.ok) setIsPublic(!next);
    } catch { setIsPublic(!next); }
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyLabel("복사됨!");
      setTimeout(() => setCopyLabel("Markdown 복사"), 1500);
    } catch {
      // Clipboard permission denied; ignore.
    }
  }

  function deletePost() {
    if (!confirm("이 글을 삭제할까요? 되돌릴 수 없습니다.")) return;
    startDelete(async () => {
      const res = await fetch(`/api/posts/${initialPost.id}`, { method: "DELETE" });
      if (res.ok) router.push("/app");
      else alert("삭제에 실패했습니다.");
    });
  }

  const saveLabel = { idle: " ", saving: "저장 중…", saved: "저장됨", error: "저장 실패" }[saveState];
  const publicUrl = `${appUrl}/post/${initialPost.slug}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <a href="/app" className="text-sm text-muted-foreground hover:underline">← 작업 목록으로</a>
        <span className="text-xs text-muted-foreground" aria-live="polite">{saveLabel}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 편집 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="post-title">제목</Label>
            <Input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-content">본문 (Markdown)</Label>
            <Textarea
              id="post-content"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              rows={24}
              className="font-mono text-sm"
            />
          </div>
        </div>

        {/* 미리보기 */}
        <div className="space-y-2">
          <div className="text-sm font-medium">미리보기</div>
          <article className="prose-tubetopost min-h-[200px] rounded-lg border p-6">
            <h1 className="mb-4 text-2xl font-bold">{title}</h1>
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </article>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">공개 설정</div>
            <p className="text-sm text-muted-foreground">공개하면 누구나 아래 주소로 볼 수 있어요.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPublic} onChange={(e) => togglePublic(e.target.checked)} />
            {isPublic ? "공개" : "비공개"}
          </label>
        </div>
        {isPublic && (
          <div className="rounded border bg-muted/30 px-3 py-2 text-sm font-mono break-all">
            {publicUrl}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={copyMarkdown}>{copyLabel}</Button>
        <div className="flex-1" />
        <Button variant="destructive" onClick={deletePost} disabled={isDeleting}>
          {isDeleting ? "삭제 중…" : "글 삭제"}
        </Button>
      </div>
    </div>
  );
}
