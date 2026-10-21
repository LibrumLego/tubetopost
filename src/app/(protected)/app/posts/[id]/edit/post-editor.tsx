"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import styles from "./post-editor.module.css";

interface Post {
  revision: number;
  id: string;
  slug: string;
  title: string;
  content_markdown: string;
  content_html: string;
  is_public: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

interface Source { videoId: string; title: string | null; transcript: string | null }

export function PostEditor({ initialPost, appUrl, source = null }: { initialPost: Post; appUrl: string; source?: Source | null }) {
  const [title, setTitle] = useState(initialPost.title);
  const [markdown, setMarkdown] = useState(initialPost.content_markdown);
  const [html, setHtml] = useState(initialPost.content_html);
  const [isPublic, setIsPublic] = useState(initialPost.is_public);
  const [savedTitle, setSavedTitle] = useState(initialPost.title);
  const [savedPublic, setSavedPublic] = useState(initialPost.is_public);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "preview" | "source">("edit");
  const [copyError, setCopyError] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [retrySave, setRetrySave] = useState(0);
  const [copyLabel, setCopyLabel] = useState<"Markdown 복사" | "복사됨!">("Markdown 복사");
  const [isDeleting, startDelete] = useTransition();
  const router = useRouter();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef({ title: initialPost.title, markdown: initialPost.content_markdown, isPublic: initialPost.is_public });
  const latest = useRef({ title: initialPost.title, markdown: initialPost.content_markdown, isPublic: initialPost.is_public });
  const revision = useRef(initialPost.revision);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const blocked = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    latest.current = { title, markdown, isPublic };
    if (!inFlight.current && title === lastSaved.current.title && markdown === lastSaved.current.markdown && isPublic === lastSaved.current.isPublic) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (blocked.current) return;
    setSaveState("idle");
    const snapshot = { title, markdown, isPublic };
    saveTimer.current = setTimeout(() => {
      saveChain.current = saveChain.current.then(async () => {
        if (blocked.current) return;
        inFlight.current = true;
        setSaveState("saving"); setSaveError(null);
        try {
          const res = await fetch(`/api/posts/${initialPost.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: snapshot.title, content_markdown: snapshot.markdown, is_public: snapshot.isPublic, expected_revision: revision.current }),
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json();
          if (!res.ok) {
            blocked.current = true; setConflict(res.status === 409);
            setSaveError(data.error?.message ?? "저장하지 못했습니다."); setSaveState("error"); return;
          }
          revision.current = data.post.revision;
          lastSaved.current = snapshot;
          setSavedTitle(snapshot.title);
          setSavedPublic(snapshot.isPublic);
          setSavedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
          if (typeof data.post?.content_html === "string") setHtml(data.post.content_html);
          const isLatest = latest.current.title === snapshot.title && latest.current.markdown === snapshot.markdown && latest.current.isPublic === snapshot.isPublic;
          setSaveState(isLatest ? "saved" : "idle");
        } catch {
          blocked.current = true; setSaveError("연결 문제로 저장 결과를 확인하지 못했습니다. 변경 내용은 화면에 남아 있습니다."); setSaveState("error");
        } finally { inFlight.current = false; }
      });
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [title, markdown, isPublic, initialPost.id, retrySave]);

  useEffect(() => {
    function protect(e: BeforeUnloadEvent) {
      if (inFlight.current || JSON.stringify(latest.current) !== JSON.stringify(lastSaved.current)) { e.preventDefault(); }
    }
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, []);

  function togglePublic(next: boolean) {
    setIsPublic(next);
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyError(null);
      setCopyLabel("복사됨!");
      setTimeout(() => setCopyLabel("Markdown 복사"), 1500);
    } catch {
      setCopyError("복사하지 못했습니다. 본문을 선택해 직접 복사해 주세요.");
    }
  }

  async function copyPublicUrl() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setUrlCopied(true); setCopyError(null);
      setTimeout(() => setUrlCopied(false), 1500);
    } catch { setCopyError("링크를 복사하지 못했습니다. 아래 주소를 직접 복사해 주세요."); }
  }

  function deletePost() {
    if (!confirm("이 글을 삭제할까요? 되돌릴 수 없습니다.")) return;
    startDelete(async () => {
      const res = await fetch(`/api/posts/${initialPost.id}`, { method: "DELETE" });
      if (res.ok) router.push("/app");
      else alert("삭제에 실패했습니다.");
    });
  }

  const saveLabel = { idle: "저장 대기…", saving: "저장 중…", saved: "저장됨", error: "저장 실패 · 재시도 필요" }[saveState];
  const publicUrl = `${appUrl}/post/${initialPost.slug}`;

  return (
    <div className={styles.workspace}>
      <div className={styles.content}>
        <a className={styles.breadcrumb} href="/app" onClick={(e) => { if (saveState !== "saved" && !confirm("저장되지 않은 변경이 있습니다. 작업 목록으로 이동할까요?")) e.preventDefault(); }}>← 내 작업 / 글 편집</a>
        <div className={styles.heading}>
          <h1>글 다듬기</h1>
          <span className={styles.status} data-state={saveState} role="status"><span aria-hidden="true">●</span> {conflict ? "저장 충돌" : saveLabel}</span>
        </div>
        <p className={styles.intro}>영상에서 시작한 초안을, 내 문장으로 완성하세요.</p>
        <div className={styles.actions}>
          <Button className={styles.button} variant="outline" onClick={copyMarkdown}>{copyLabel}</Button>
          <Button className={styles.primary} onClick={() => { document.getElementById("publication-settings")?.scrollIntoView({ behavior: "smooth", block: "center" }); document.getElementById("publish-toggle")?.focus({ preventScroll: true }); }}>공개 설정</Button>
        </div>
        {copyError && <p role="alert" className={styles.error}>{copyError}</p>}
        {saveError && <div role="alert" className={styles.error}>
          <p>{saveError}</p>
          {conflict ? <Button variant="outline" onClick={() => { if (confirm("화면의 변경을 버리고 최신 글을 불러올까요?")) location.reload(); }}>최신 글 불러오기</Button>
            : <Button variant="outline" onClick={() => { blocked.current = false; setRetrySave(n => n + 1); }}>저장 다시 시도</Button>}
          <p>Markdown 복사로 변경 내용을 보관할 수 있습니다.</p>
        </div>}
        <section className={styles.sourceCard} aria-label="원본 영상">
          <div><span className={styles.caption}>원본 영상</span><p>{source?.title || "영상 제목을 불러오지 못했습니다"}</p></div>
          {source && /^[\w-]{11}$/.test(source.videoId) && <a className={styles.linkButton} href={`https://www.youtube.com/watch?v=${source.videoId}`} target="_blank" rel="noopener noreferrer">원본 영상 열기 ↗</a>}
        </section>
        <p className={styles.notice}>AI가 만든 초안입니다. 공개 전 원본의 내용과 표현을 확인해 주세요.</p>
        <div className={styles.mobileNav} aria-label="편집 화면 선택">
          {(["edit", "preview", "source"] as const).map((key, i) => <Button className={view === key ? styles.primary : styles.button} variant="outline" key={key} aria-pressed={view === key} aria-controls={key === "preview" ? "preview-panel" : "draft-panel"} onClick={() => setView(key)}>{["편집", "미리보기", "원본"][i]}</Button>)}
        </div>
        <div className={styles.columns} data-view={view}>
          <section className={styles.draftPanel} id="draft-panel" aria-label={view === "source" ? "원본 자막" : "초안 편집"}>
            <div className={styles.desktopNav} aria-label="편집 또는 원본 선택">
              <button type="button" aria-pressed={view !== "source"} onClick={() => setView("edit")}>초안 편집</button>
              <button type="button" aria-pressed={view === "source"} onClick={() => setView("source")}>원본 자막</button>
            </div>
            {view === "source" ? <div className={styles.fields}><h2>원본 자막</h2><p className={styles.caption}>초안과 대조하며 내용을 확인하세요. 자막은 수정되지 않습니다.</p><div className={styles.transcript}>{source?.transcript || "이 영상의 자막이 보관되어 있지 않습니다. 원본 영상을 열어 확인해 주세요."}</div></div>
              : <div className={styles.fields}>
                <Label htmlFor="post-title">글 제목</Label>
                <Input id="post-title" className={styles.titleInput} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
                <Label htmlFor="post-content">본문 · Markdown</Label>
                <div className={styles.markdownField}>
                  <Textarea id="post-content" value={markdown} onChange={(e) => setMarkdown(e.target.value)} rows={20} maxLength={50000} className={styles.textarea} aria-describedby="markdown-help" />
                  <p id="markdown-help" className={styles.markdownHelp}>## 제목 · **강조** · [글자](주소)<br />{markdown.length.toLocaleString("ko-KR")} / 50,000자</p>
                </div>
              </div>}
          </section>
          <section className={styles.previewPanel} id="preview-panel" aria-label="읽기 미리보기">
            <div className={styles.previewHeader}><span>읽기 미리보기</span><span>{savedAt ? `${savedAt} 저장 기준` : "서버에 저장된 내용"}</span></div>
            <article className={styles.article}>
              <p className={styles.provenance}>AI에서 시작한 글 · 원본 대조 필요</p>
              <h1>{savedTitle || "제목 없음"}</h1>
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </article>
          </section>
        </div>
        <section id="publication-settings" className={styles.publication} aria-label="공개 설정">
          <div className={styles.publicationRow}>
            <div><h2>공개 범위 <span className={styles.publicBadge}>{savedPublic ? "공개 중" : "현재 비공개"}</span></h2><p>공개하면 누구나 링크로 읽을 수 있습니다.</p></div>
            <label className={styles.toggle}><input id="publish-toggle" type="checkbox" checked={isPublic} onChange={(e) => togglePublic(e.target.checked)} />글 공개하기</label>
          </div>
          {isPublic !== savedPublic && <p className={styles.caption}>공개 범위 변경은 저장 후 적용됩니다.</p>}
          {savedPublic && <div className={styles.publicLink}><a href={publicUrl} target="_blank" rel="noopener noreferrer">{publicUrl}</a><Button variant="outline" className={styles.button} onClick={copyPublicUrl}>{urlCopied ? "복사됨!" : "링크 복사"}</Button></div>}
        </section>
        <footer className={styles.footer}><p>내용을 수정하면 자동 저장됩니다.</p><Button variant="ghost" className={styles.deleteButton} onClick={deletePost} disabled={isDeleting}>{isDeleting ? "삭제 중…" : "글 삭제"}</Button></footer>
      </div>
    </div>
  );
}
