# TubeToPost (가칭)

유튜브 URL 하나로 Whisper + LLM이 SEO 최적화된 블로그 글로 변환해주는 서비스.

## 스택

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Backend**: Supabase (Auth + Postgres + Storage)
- **LLM**: OpenAI (Whisper + GPT-5-mini)
- **Hosting**: Vercel (예정)

## 로컬 개발

```bash
# 1. 의존성 설치
pnpm install

# 2. 환경변수 세팅
cp .env.local.example .env.local
# 그다음 .env.local 열어서 실제 값 채우기

# 3. 개발 서버
pnpm dev
```

브라우저에서 http://localhost:3000 열기.

## 폴더 구조

```
src/
├── app/
│   ├── (auth)/         # 로그인/회원가입 라우트 그룹
│   ├── (app)/          # 로그인 필요한 메인 앱
│   ├── api/            # API Routes
│   └── page.tsx        # 랜딩
├── components/
│   ├── ui/             # shadcn 기본 컴포넌트
│   └── shared/         # 서비스 공통 컴포넌트
├── lib/
│   ├── supabase/       # Supabase 클라이언트 (server/client/middleware)
│   ├── openai/         # Whisper + GPT 호출
│   ├── youtube/        # 유튜브 자막/메타 추출
│   └── utils.ts
├── types/              # 공유 타입
└── middleware.ts       # Supabase 세션 갱신
```

## 필요한 환경변수

`.env.local.example` 참고.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase 프로젝트 설정에서 가져옴
- `OPENAI_API_KEY`: OpenAI 대시보드

## 다음 할 일

- [ ] Supabase 프로젝트 생성 + 환경변수 세팅
- [ ] DB 스키마 설계 (users, jobs, posts)
- [ ] 유튜브 자막 추출 PoC
- [ ] LLM 변환 프롬프트 설계
- [ ] 작업 큐 아키텍처 (Vercel Cron 또는 GitHub Actions)
