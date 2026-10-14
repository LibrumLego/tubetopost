# TubeToPost

YouTube URL을 입력해 자막을 블로그 글로 변환하는 서비스입니다. 인증·작업 API·변환 워커·결과 편집과 공개 페이지를 구현했습니다.

2026-10-14 Supadata native 자막 통합 후 TED 영상 `arj7oStGLkU`로 로그인 → 작업 생성 → 글 생성 완료 → 제목 편집 저장 → 공개 설정 → 비인증 HTTP 조회까지 실제 통과했습니다. 기존 YouTube 직접 추출 경로는 검사한 9개 영상에서 실패했으며, Whisper fallback은 구현되지 않았습니다. [실제 검증 로그](docs/transcript-poc-log.md)에 성공·실패와 비용 범위를 기록했습니다.

## 스택과 처리 흐름

Next.js 16.4 App Router / React 19 / TypeScript / Tailwind CSS v4 / Supabase Auth·Postgres·Edge Functions / OpenAI. 배포된 생성 모델은 `gpt-4o-mini`입니다.

```mermaid
flowchart LR
  U[로그인 사용자] --> A[Next.js 작업 API]
  A --> D[(Supabase jobs / RLS)]
  A -->|after + WORKER_SECRET| W[Edge Function]
  W --> Y[YouTube 자막]
  Y --> L[LLM 글 생성]
  L --> F[finalize_job 트랜잭션]
  F --> P[글 편집 / 공개 페이지]
  W -->|실패 저장| D
```

워커 인증은 전용 공유 시크릿으로 검증합니다. DB 접근에는 플랫폼 서비스 키를 사용합니다. 작업 완료·글 저장·사용량 증가는 트랜잭션으로 처리합니다. `after`와 `waitUntil`은 내구성 있는 큐가 아니며 재시도·타임아웃 복구는 후속 작업입니다.

## 로컬 실행

```sh
pnpm install
cp .env.local.example .env.local
# 실제 환경변수 입력
pnpm env:check
pnpm dev
```

[로컬 앱](http://localhost:3000)에서 이메일 매직링크로 로그인합니다. Supabase Auth에 앱 주소와 `/auth/callback` 리다이렉트 주소를 등록해야 합니다. DB에는 `supabase/migrations`를 순서대로 적용합니다. 초기 마이그레이션을 이미 적용했다면 다시 실행하지 않습니다.

서버와 Edge Function의 `WORKER_SECRET`은 동일한 32자 이상 랜덤 값이어야 합니다. 키나 시크릿은 커밋하지 않습니다. UI는 시스템 폰트를 사용하므로 개발·빌드 중 Google Fonts 다운로드가 필요하지 않습니다.

## 검증과 배포

```sh
pnpm typecheck
pnpm lint
pnpm build
pnpm worker:check
pnpm diag:transcript <video-id>
```

자막 진단에는 Deno가 필요합니다. 진단은 서명 URL이나 시크릿을 출력하지 않습니다. 사용할 수 있는 자막이 없으면 종료 코드 1을 반환합니다.

- [워커 배포·검증 안내](docs/worker.md)
- [시연 후보 9개 검증 결과](docs/demo-videos.md)
- [이전 구현 기록](docs/implementation.md)

## 남은 작업

현재 경로는 Supadata native 우선, 공급자 미설정·자막 없음 등은 YouTube 직접 추출로 fallback합니다. `SUPADATA_API_KEY`는 Edge Function Secrets에 설정합니다. AI 전사·내구성 큐·자동 재시도는 후속 작업입니다. 인증된 결과 페이지에는 로딩 경계를 두고, 추출 제한을 자막 부재로 단정하지 않도록 안내합니다. 오르카 숨겨진 브라우저 탭은 프레임 갱신이 멈출 수 있으므로 시연 시 브라우저를 화면에 표시합니다.
