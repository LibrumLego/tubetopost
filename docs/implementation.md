# 구현 상태

Claude의 TubeToPost 설계 중 DB와 작업 API의 첫 단계를 구현했다.

## DB 적용

Supabase SQL Editor에서 `supabase/migrations/0001_init.sql`을 실행하거나, 프로젝트를 연결한 Supabase CLI에서 `supabase db push`를 실행한다. 외부 DB에는 아직 적용하지 않았다.

- profiles / jobs / posts / usage_logs, 인덱스, RLS, 가입 프로필 생성
- authenticated는 자기 데이터 조회, anon은 공개 글 조회만 허용
- 작업 생성은 authenticated 전용 `enqueue_job` RPC: 프로필 잠금, 월 리셋, 진행 중 작업을 포함한 쿼터 검사
- 워커의 `claim_job`은 service_role 전용, `FOR UPDATE SKIP LOCKED` 사용
- plan·quota·status·비용·렌더링 HTML 수정은 서버 작업에서만 수행

## API

- `POST /api/jobs`: `{ "youtube_url": "..." }`, 201 / 400 / 401 / 409 / 429
- `GET /api/jobs?limit=20&cursor=...`: 목록과 `next_cursor`. 반환된 커서를 그대로 전달한다. 동일 시각의 작업도 누락되지 않도록 시각과 ID를 함께 사용한다.
- `GET /api/jobs/:id`: 상태와 단계별 진행률. RLS로 소유자 확인

Next.js 로컬 문서에 따라 `src/middleware.ts`를 `src/proxy.ts`로 변경했다.

## 남은 작업

- 실제 Supabase 연결 및 매직링크 이메일 수신 통합 검증
- 재시도 RPC/API, 프로필 API, 결과물 조회·편집 API
- 워커 연결, 자막/Whisper 추출, LLM 생성, HTML 정제
- `finalize_job(p_job_id uuid, p_post_data jsonb)` 설계 대기: Claude 지시에 따라 이번 범위에서는 본체와 호출 가능한 skeleton을 추가하지 않는다. 후속 구현에서 service_role 전용으로 결과 저장, done 전이, 월 사용량 증가를 단일 트랜잭션으로 처리하고 중복 완료를 차단한다.
- 단계별 타임아웃 복구 및 워커 인증
- Claude의 후속 UI 설계를 반영한 화면

현재 작업 생성은 큐에 등록만 한다. 워커 연결 전에는 queued 상태를 유지한다. 서버 키나 외부 서비스 계정은 생성하지 않았다.

## 검증

- TypeScript, ESLint, Next.js production build 통과
- 임시 PGlite PostgreSQL에서 마이그레이션 실행, 가입 트리거, 중복 차단, 쿼터 제한, 컬럼 권한, 워커 claim, 다른 사용자 데이터 차단 확인
- YouTube URL 정상/위조 호스트/잘못된 ID, 상태 전이와 진행률 확인
- 실제 Supabase 인증·API 통합 테스트 및 다중 DB 세션의 동시성 검증은 연결 후 진행해야 한다.

## 2차 수정 (코드 리뷰 반영)

- `claim_job`을 `setof public.jobs`로 변경: 빈 큐는 0개 행, 작업이 있으면 1개 행 반환. 워커는 응답 배열의 `data[0]` 또는 `data.length`로 판별해야 한다.
- 목록·단건 조회가 `JobSummary`와 `toJobSummary`를 공유하고 `error: { code, message } | null` 형태로 반환한다.
- UUID 형식 오류는 `400 INVALID_REQUEST`, 없는 작업은 `404 JOB_NOT_FOUND`로 구분한다.
- `enqueue_job`의 SQLSTATE를 인증 P0001, 중복 P0002, 쿼터 P0003, 프로필 누락 P0004로 구분하고 API는 코드로 분기한다.
- `finalize_job`은 지시서에서 허용한 문서화 방식으로 설계 대기를 명시했다.
- Proxy 매처에서 `api/health`와 ico/txt/xml 정적 파일을 추가 제외한다.
- 아직 외부 DB에 적용하지 않은 초기 마이그레이션을 수정했다. 기존 0001을 이미 적용한 DB에는 함수 재생성 마이그레이션이 필요하다 (`claim_job` 반환 타입은 CREATE OR REPLACE로 변경할 수 없음).
- 검증: 타입 검사, ESLint, production build 통과. PGlite에 마이그레이션을 재적용해 빈 큐 0행, 작업 claim 1행/transcribing, 재claim 방지, P0001~P0004, 쿼터와 권한을 확인했다. 공통 요약 함수의 중첩 오류/오류 없음, 내부 필드 제외, 타임스탬프 정밀도 보존도 확인했다.

## 3차 구현: 매직링크 인증

- `/login`: 이메일 검증, 서버 액션 발송, 진행/오류 표시. 인증된 사용자는 `/app`으로 이동한다.
- `/auth/callback`: PKCE 코드를 세션 쿠키로 교환한다. 코드 누락/만료는 로그인 화면에 오류를 표시한다. `next`는 동일 origin 경로만 허용하며 역슬래시와 제어문자를 차단한다.
- `/auth/check-email`: 전송 안내와 재요청 링크. 지시서의 `(auth)/check-email` 경로는 `/check-email`이 되므로 실제 파일은 `(auth)/auth/check-email`에 배치했다.
- `(app)` 보호 레이아웃과 `/app` 페이지는 `requireUser()`로 서버 검증한다. 향후 API/서버 액션도 각각 인증 검증이 필요하다.
- `getUser()`는 React cache로 요청 안에서 조회를 공유한다. 환경변수 미설정 시 로그인 화면은 표시하고 발송은 안내 오류를 반환한다.
- 로그아웃 서버 액션을 `/app` 버튼에 연결했다. Supabase 로그아웃 성공 후 `/`으로 이동한다.
- Cache Components 설정에 맞춰 세션과 searchParams 조회를 Suspense 안에 배치했다.

### Supabase 설정 및 실제 로그인 검증

1. Supabase 프로젝트를 만들고 Project URL과 anon public key를 `.env.local`에 설정한다. `.env.local.example`의 `NEXT_PUBLIC_APP_URL`도 현재 서비스 주소로 설정한다.
2. Authentication → URL Configuration에서 Site URL을 `http://localhost:3000`, Redirect URLs에 `http://localhost:3000/auth/callback`을 등록한다. 운영에서는 실제 HTTPS 서비스 주소와 콜백도 등록한다.
3. 이메일 로그인을 활성화하고 Magic Link 이메일 템플릿에 `{{ .ConfirmationURL }}`이 포함되어 있는지 확인한다.
4. SQL Editor에서 초기 마이그레이션을 적용한다. 이미 적용했다면 앞 절의 함수 변경 사항을 별도 마이그레이션으로 반영한다.
5. `pnpm dev` 실행 후 `/app` 미인증 접근 → `/login`, 이메일 발송 → `/auth/check-email`, 같은 브라우저에서 메일 링크 클릭 → `/app`을 확인한다.
6. 로그인 상태에서 `/login` → `/app`, 로그아웃 → `/`, 다시 `/app` → `/login`을 확인한다. 만료 링크와 재전송 제한도 확인한다.

실제 Supabase 계정과 메일 발송 환경은 아직 연결하지 않았으므로 이메일 수신 및 로그인 성공 E2E는 위 설정 후 검증해야 한다.

### 인증 구현 검증

- 타입 검사, ESLint와 production build 통과. `/login`, `/app`, `/auth/callback`, `/auth/check-email` 라우트 생성 확인.
- 임시 production 서버에서 로그인 폼 표시, 미인증 `/app` 접근 차단, 코드 누락·잘못된 콜백의 로그인 오류 이동, `/auth/check-email` 이메일 표시 확인.
- 리다이렉트 헬퍼에서 외부 URL, `//`, 역슬래시, 제어문자를 차단하고 정상 로컬 경로를 허용하는 검사 통과.
