"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoMarkdown, demoTitle } from "@/lib/demo-content";
import styles from "../portfolio.module.css";

const steps = ["영상 확인", "초안 살펴보기", "공개 결과"];

export function DemoWalkthrough({ html }: { html: string }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(demoTitle);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`# ${title}\n\n${demoMarkdown}`);
      setCopied(true); setCopyError(false);
    } catch { setCopyError(true); }
  }
  return <main className={styles.shell}>
    <div className={styles.container}>
      <Link href="/" className={styles.back}>← TubeToPost</Link>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>INTERACTIVE DEMO</p>
        <h1>영상의 아이디어가<br />한 편의 글이 되기까지.</h1>
        <p className={styles.lead}>로그인 없이 핵심 흐름을 살펴보세요.<br />원문을 대조해 검수한 예시를 사용합니다.</p>
      </header>
      <aside className={styles.notice}>예시 체험입니다. 실제 AI 변환·서버 저장·공개 전환은 실행하지 않습니다. 제목 수정은 이 화면에서만 유지되며 새로고침하면 초기화됩니다.</aside>
      <nav className={styles.steps} aria-label="데모 단계">
        {steps.map((label, i) => <button type="button" key={label} aria-pressed={step === i} aria-controls="demo-content" onClick={() => setStep(i)}><span>0{i + 1}</span>{label}</button>)}
      </nav>
      <section id="demo-content" className={styles.panel} aria-label={steps[step]}>
        {step === 0 && <div className={styles.source}>
          <p className={styles.eyebrow}>SOURCE VIDEO</p>
          <h2>Inside the Mind of a Master Procrastinator</h2>
          <p className={styles.lead}>Tim Urban · TED</p>
          <p>실제 서비스에서는 URL을 제출하면 영상 길이와 자막을 확인한 뒤 비동기로 초안을 생성합니다. 이 데모는 이미 검수한 결과를 불러오므로 외부 AI 호출을 기다릴 필요가 없습니다.</p>
          <a href="https://www.youtube.com/watch?v=arj7oStGLkU" target="_blank" rel="noopener noreferrer" className={styles.textLink}>원본 영상 열기 ↗</a>
          <Button onClick={() => setStep(1)} className={styles.primary}>초안 살펴보기 →</Button>
        </div>}
        {step === 1 && <div className={styles.editorGrid}>
          <div className={styles.editorSide}>
            <p className={styles.eyebrow}>MAKE IT YOURS</p><h2>제목을 바꿔보세요.</h2>
            <p>오른쪽 읽기 화면에 바로 반영됩니다. 본문은 검수 예시이며 이 체험에서 편집하지 않습니다.</p>
            <Label htmlFor="demo-title">글 제목</Label>
            <Input id="demo-title" value={title} maxLength={200} onChange={e => { setTitle(e.target.value); setCopied(false); }} />
            <Button variant="outline" onClick={() => { setTitle(demoTitle); setCopied(false); }}>제목 초기화</Button>
            <Button className={styles.primary} onClick={copy}>{copied ? "Markdown 복사됨" : "Markdown 복사"}</Button>
            <p role="status">{copyError ? "복사 권한을 확인해 주세요." : copied ? "현재 제목과 검수 예시 본문을 복사했습니다." : "서버에 저장되지 않는 체험입니다."}</p>
          </div>
          <article className={styles.article}><p className={styles.eyebrow}>READING PREVIEW · 검수 예시 발췌</p><h2>{title || "제목 없음"}</h2><div dangerouslySetInnerHTML={{ __html: html }} /></article>
        </div>}
        {step === 2 && <div className={styles.source}>
          <p className={styles.eyebrow}>FROM DRAFT TO PUBLISHED</p><h2>실제로 배포된 결과를 읽어보세요.</h2>
          <p>기존 공개 글은 로그인 없이 볼 수 있습니다. 여기서 바꾼 제목은 그 글에 적용되지 않습니다. 실제 편집기는 로그인한 작성자의 글에만 접근하고 저장 충돌을 검사합니다.</p>
          <Link href="/post/exploring-procrastin" className={styles.textLink}>검수한 공개 글 읽기 →</Link>
          <Link href="/project" className={styles.textLink}>설계와 문제 해결 과정 보기 →</Link>
        </div>}
      </section>
      <footer className={styles.footer}><span>배포된 개인 프로젝트 · 결제·광고 없음</span><Link href="/project">프로젝트 소개 →</Link></footer>
    </div>
  </main>;
}
