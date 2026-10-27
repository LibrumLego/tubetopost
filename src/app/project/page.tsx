import type { Metadata } from "next";
import Link from "next/link";
import styles from "../portfolio.module.css";

export const metadata: Metadata = {
  title: "설계와 운영 경험 | TubeToPost",
  description: "영상에서 글까지의 흐름을 설계·구현·배포하며 해결한 비동기 작업, 동시 편집, 보안과 비용 문제를 소개합니다.",
};

const decisions = [
  { number: "01", title: "긴 작업을 웹 요청에서 분리하기", problem: "자막 추출과 생성 도중 요청이 끊기거나 실행이 늦게 끝나면 작업 상태와 결과가 어긋날 수 있습니다.", solution: "DB에 작업을 먼저 기록하고 Edge Function에서 처리합니다. 실행마다 attempt ID와 lease를 확인해 이전 실행의 늦은 완료를 거절합니다. 만료된 작업은 실패로 전환하고 수동 재시도를 제공합니다.", limit: "after·waitUntil 자체는 영속 큐가 아닙니다. 자동 재실행과 대규모 처리량은 보장하지 않습니다." },
  { number: "02", title: "자동저장이 다른 편집을 덮어쓰지 않게", problem: "저장 응답을 기다리는 사이 다시 입력하거나 두 창에서 같은 글을 수정할 수 있습니다.", solution: "1.5초 debounce와 요청 직렬화를 적용했습니다. 서버 revision과 expected_revision이 다르면 409로 거절하고 초안을 화면에 남깁니다. 미리보기는 저장이 확인된 제목과 본문을 함께 표시합니다.", limit: "실시간 공동 편집은 아닙니다. 충돌이 나면 내용을 복사하고 최신 글을 다시 불러와야 합니다." },
  { number: "03", title: "저장된 HTML도 신뢰하지 않기", problem: "웹 API만 검사하면 DB RPC를 직접 호출하는 경로가 남습니다. AI 결과와 사용자 Markdown도 신뢰할 수 없습니다.", solution: "RLS와 DB 입력 검증을 적용하고, 원시 HTML 캐시 대신 Markdown을 정제해 렌더합니다. 변경 요청의 Origin과 실제 본문 바이트를 검사하고 사용자별 호출량을 제한합니다.", limit: "CSP에 PPR용 unsafe-inline이 남습니다. 외부 침투 테스트나 모든 공격에 대한 안전성을 주장하지 않습니다." },
  { number: "04", title: "AI 호출 전에 비용 상한 정하기", problem: "완료 후 토큰을 집계하는 것만으로는 반복 실행이나 큰 입력의 비용을 미리 제한하기 어렵습니다.", solution: "호출 전에 입력과 최대 출력을 기준으로 비용을 보수적으로 예약합니다. 동시 작업·재시도·월 한도와 캠페인 만료를 별도로 검사합니다. 영상 길이와 자막 길이도 생성 전에 확인합니다.", limit: "예약 비용은 실제 청구액이 아니며 Supadata 크레딧과 호스팅 비용을 모두 포함하지 않습니다." },
];

export default function ProjectPage() {
  return <main className={styles.shell}><div className={styles.container}>
    <Link href="/" className={styles.back}>← TubeToPost</Link>
    <header className={styles.hero}><p className={styles.eyebrow}>PROJECT CASE STUDY</p><h1>만드는 것에서,<br />서비스로 내놓기까지.</h1><p className={styles.lead}>YouTube 자막을 편집 가능한 한국어 글로 바꾸는 개인 프로젝트.<br />구현·배포·검증 과정에서 내린 선택과 남은 한계를 기록합니다.</p><Link href="/demo" className={styles.textLink}>로그인 없이 데모 체험 →</Link></header>
    <section className={styles.facts} aria-label="프로젝트 범위">
      <div><span>목표</span><strong>서비스 개발·운영 경험</strong></div>
      <div><span>구현 범위</span><strong>URL → 생성 → 편집 → 공개</strong></div>
      <div><span>현재 상태</span><strong>배포된 포트폴리오 데모</strong></div>
    </section>
    <section className={styles.section}><p className={styles.eyebrow}>THE PRODUCT</p><h2>다시 보고 싶은 영상을, 고쳐 쓸 수 있는 글로.</h2><p>자막이 있는 20분 이하 영상의 내용을 섹션별 초안으로 만들고, 원본 구간을 확인하며 수정한 뒤 Markdown이나 공개 링크로 활용할 수 있게 했습니다. 생성 결과는 기본 비공개입니다.</p><p>개인 프로젝트로 기획·구현·배포를 진행했고 AI 도구를 구현 및 검토 보조에 사용했습니다. 실제 사용자 수·매출·전환율이나 대규모 운영 성과를 검증한 프로젝트는 아닙니다.</p></section>
    <section className={styles.section}><p className={styles.eyebrow}>HOW IT WORKS</p><h2>상태와 권한은 DB에, 긴 작업은 워커에.</h2><ol className={styles.pipeline}>{["Next.js · 인증된 작업 요청", "Postgres · 소유권 / 작업 상태", "Edge Function · 자막과 AI 생성", "검증된 완료 저장 · 편집 / 공개"].map((s, i) => <li key={s}><span>0{i + 1}</span>{s}</li>)}</ol><p className={styles.small}>Next.js 16.4 · React 19 · TypeScript · Supabase Auth / Postgres / Edge Functions · Supadata · OpenAI · Vercel</p></section>
    <section className={styles.section}><p className={styles.eyebrow}>ENGINEERING DECISIONS</p><h2>정상 동작 이후에 드러난 문제들.</h2><div className={styles.decisions}>{decisions.map(d => <article key={d.number}><span className={styles.number}>{d.number}</span><div><h3>{d.title}</h3><p>{d.problem}</p><p>{d.solution}</p><aside>{d.limit}</aside></div></article>)}</div></section>
    <section className={styles.section}><p className={styles.eyebrow}>QUALITY & EVIDENCE</p><h2>성공한 결과와, 발견한 오류를 함께 남겼습니다.</h2><div className={styles.evidence}><article><h3>생성 품질</h3><p>TED 예시에서 농담과 비유가 연구 사실처럼 서술된 오류를 발견했습니다. 생성 지시를 보강하고 원문 자막을 대조해 공개 원고를 수정했습니다. 사실 정확성을 자동으로 보장하지 않습니다.</p><Link href="/post/exploring-procrastin" className={styles.textLink}>검수 결과 읽기 →</Link></article><article><h3>검증 기록</h3><p>실제 변환 완료와 짧은·긴 영상 거절, 저장 지연·실패·충돌을 확인했습니다. DB 검증은 합성 데이터를 트랜잭션 안에서 확인한 뒤 롤백합니다. 기록은 시점별 결과이며 상시 가용성이나 전체 커버리지를 뜻하지 않습니다.</p><p className={styles.small}>재현 명령과 상세 기록은 README 및 docs에 보관합니다.</p></article></div></section>
    <section className={styles.section}><p className={styles.eyebrow}>OPERATIONS & NEXT</p><h2>지금의 우선순위는 완성도입니다.</h2><p>GitHub main push에서 lint·프로덕션 빌드를 거쳐 Vercel로 자동 배포합니다. DB 마이그레이션과 워커 배포는 별도 절차로 관리합니다. 실제 변환은 로그인과 운영 한도를 적용하며, 로그인 없는 체험은 외부 AI 호출 없는 예시 데모입니다.</p><p>공개 베타 기간을 자동 연장하지 않습니다. 이메일 전달 설정과 외부 사용자 테스트, 더 넓은 영상군의 품질 평가는 후속 과제입니다. 결제·광고·유료 전환은 현재 우선순위에서 제외했습니다.</p></section>
    <footer className={styles.footer}><Link href="/demo">데모 체험 →</Link><Link href="/">서비스 홈으로</Link><span>저장소는 비공개로 유지합니다.</span></footer>
  </div></main>;
}
