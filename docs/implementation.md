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

- 실제 Supabase 연결 및 인증 화면
- 재시도 RPC/API, 프로필 API, 결과물 조회·편집 API
- 워커 연결, 자막/Whisper 추출, LLM 생성, HTML 정제
- 결과 저장과 done 전이를 하나의 트랜잭션으로 처리하고 월 사용량을 한 번만 증가시키는 완료 RPC
- 단계별 타임아웃 복구 및 워커 인증
- Claude의 후속 UI 설계를 반영한 화면

현재 작업 생성은 큐에 등록만 한다. 워커 연결 전에는 queued 상태를 유지한다. 서버 키나 외부 서비스 계정은 생성하지 않았다.
