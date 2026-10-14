# 변환 워커

## 구성과 배포

### Supadata native 통합

`SUPADATA_API_KEY`를 Edge Function Secrets에 설정하면 Supadata native 자막을 우선 요청한다. 로컬 키는 PoC용이며 운영 키 설정을 대체하지 않는다. 공식 계약: [transcript](https://docs.supadata.ai/get-transcript), [오류 코드](https://docs.supadata.ai/errors/list).

AI 생성과 자동 재시도는 하지 않으며 작업당 공급자 요청은 1회다. 미설정·202·206·404·422·빈 자막은 기존 YouTube 경로로 넘어간다. 잘못된 키·응답·공급자 장애는 INTERNAL, 429는 속도 또는 사용량 제한을 뜻하는 TRANSCRIPT_PROVIDER_LIMITED로 분류한다. 429를 크레딧 소진으로 단정하지 않는다.

Supadata 세그먼트는 ms에서 초로 변환하고 timestamp와 텍스트를 검증한다. 20분 이후 자막 구간이나 50,000자 초과 입력은 거부한다. 자막 끝 시각은 영상 길이의 하한일 뿐 전체 영상 길이가 아니므로 DB duration은 null이다. 따라서 무음 후반부까지 포함한 정확한 20분 영상 길이 제한은 보장하지 않는다. native 요청은 AI 분당 비용이 없으며 사용 크레딧은 공급자 대시보드에서 확인한다. 기존 usage_logs는 OpenAI 생성 비용만 기록한다.

배포 전에 `0004_transcript_source.sql`을 적용한다. 마이그레이션은 실제 카탈로그에서 transcript_source 단일 컬럼 CHECK를 찾아 교체하고, 예상과 다른 제약이 있으면 중단한다. 기존 값·NULL·RLS·완료 RPC는 유지한다. Next.js와 워커 타입에 `supadata`를 추가하며 진행률은 일반 자막과 동일하다.

`0002_finalize_job.sql`은 service_role 전용 완료 RPC다. 글 저장, done 전이, 월 사용량 증가를 한 트랜잭션으로 처리한다. 중복 완료는 P0012로 거부하고, slug 충돌과 월 쿼터 리셋도 처리한다.

Next.js는 응답 후 `after`로 워커를 호출한다. 워커는 요청한 job만 조건부 업데이트로 claim한 후 202를 반환하고 `EdgeRuntime.waitUntil`로 작업한다. Authorization 헤더는 전용 공유 시크릿 `WORKER_SECRET`과 일치해야 한다. 일반 사용자 JWT와 DB 서비스 키는 워커 호출 인증으로 허용하지 않는다.

1. 연결된 Supabase DB에 0001과 0002를 순서대로 적용한다. 기존에 적용한 0001은 다시 실행하지 않는다.
2. Edge Function secrets에 `OPENAI_API_KEY`를 설정한다. 기본 모델은 지시서의 `gpt-4o-mini`, 변경은 `OPENAI_MODEL`로 한다. `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`는 플랫폼 기본 secret이다.
3. `supabase functions deploy process-job` 실행. config.toml의 verify_jwt=false는 함수 내부 서비스 키 검증과 함께 사용한다.
4. Next.js 서버 환경에 `SUPABASE_WORKER_URL=https://<project-ref>.supabase.co/functions/v1/process-job`과 `SUPABASE_SERVICE_ROLE_KEY`를 설정한다. 32자 이상의 랜덤 `WORKER_SECRET`을 Next.js와 Edge Function secrets에 동일하게 설정한다. 클라이언트 공개 변수로 설정하지 않는다.
5. 로그인 후 작업 생성 → done 전이, 결과 글 1개와 쿼터 증가를 확인한다.

각 LLM 호출의 토큰 사용량을 기록한다. 비용 추정에는 Edge secret `OPENAI_INPUT_USD_PER_MILLION`, `OPENAI_OUTPUT_USD_PER_MILLION`에 해당 모델 요율을 설정한다. 미설정 시 cost_usd는 0으로 실제 청구 금액을 뜻하지 않는다.

## 로컬 검증

```powershell
deno check --config supabase/functions/process-job/deno.json supabase/functions/process-job/index.ts
deno test --config supabase/functions/process-job/deno.json --allow-env --allow-net --allow-read supabase/functions/process-job/worker_test.ts
deno run --config supabase/functions/process-job/deno.json --allow-net supabase/functions/process-job/transcript-poc.ts <video-id>
```

Next.js 타입 검사에서 Deno 디렉터리는 제외하고 Deno 자체 검사로 검증한다. 의존성은 deno.json과 deno.lock에 고정한다.

`node scripts/check-worker.mjs`는 잘못된 job ID로 배포된 함수의 인증을 확인한다. 잘못된 인증은 401, 올바른 공유 시크릿은 ID 검증 오류 400이어야 한다. 실제 작업 생성이나 LLM 호출은 하지 않는다.

- PGlite: 완료 트랜잭션, invalid payload rollback, 상태 검증, 중복 완료, slug 충돌, 월 쿼터 리셋, 호출 권한 통과.
- Deno: 타입 검사와 테스트 9개 통과. 인증, 자막 파싱, HTML 정제, mocked 정상 완료/자막 없음/중복/DB claim 실패/LLM 실패 확인.
- Next.js: 타입 검사, lint, production build 통과.
- 실제 유튜브 dQw4w9WgXcQ PoC는 CAPTIONS_UNAVAILABLE로 실패했다. 비공식 자막 API의 실제 성공과 Supabase/OpenAI 실키 E2E는 미검증이다.

## 현재 제한

### 2026-10-13 실제 검증

- 배포된 워커 인증 probe: 잘못된 시크릿 401, 올바른 시크릿과 잘못된 작업 ID 400.
- 매직링크 로그인 후 TED 영상 `arj7oStGLkU` 작업 생성은 201, 워커 결과는 `failed / NO_TRANSCRIPT`. 변환 완료 E2E는 미통과.
- 로컬 진단에서 영상 페이지 200, 자막 트랙 50개, 자막 URL의 `exp=xpe`, 자막 응답 200과 빈 본문을 확인했다. PO Token 제한과 부합하지만 그 원인만으로 확정하지 않는다.
- `deno run --config supabase/functions/process-job/deno.json --allow-net supabase/functions/process-job/transcript-diagnostic.ts arj7oStGLkU`로 응답 상태와 본문 길이를 확인한다. 자막 URL과 서명은 출력하지 않는다.
- 오르카 숨겨진 탭의 `document.visibilityState=hidden`, 애니메이션 프레임 0회, React 스트리밍 갱신 대기 상태를 확인했다. `orca tab switch --page <id> --focus --json`으로 표시하자 실패 결과가 정상 렌더링됐다. 해당 빈 화면은 세션 소실이 아니었다.

### 2026-10-14 후속 검증과 다음 범위

- `pnpm worker:check`로 배포된 함수 인증을 확인하고, `pnpm diag:transcript <video-id>`로 자막 응답을 진단한다. Deno가 PATH에 있어야 한다.
- 시연 후보 `arj7oStGLkU`, `zQnBQ4tB3ZA`, `rfscVS0vtbw`를 로컬에서 확인했다. 자막 트랙은 각각 50개, 1개, 14개였지만, 선택된 자막은 모두 `exp=xpe`, HTTP 200, 본문 0바이트였다. 이 후보들을 변환 성공 영상으로 추천하지 않는다.
- 현재 범위는 기존 자막 경로의 진단과 정확한 실패 안내다. 성공하는 시연 영상은 아직 확보하지 못했으며, 영상 교체만으로 해결된다는 근거도 없다.
- 실제 서비스의 변환 성공을 위해 별도 자막 공급 경로나 오디오 전사 fallback을 설계·검증해야 한다. InnerTube ANDROID나 Whisper는 이번 변경에서 도입하지 않았다. 공급 경로가 실제 자막을 반환한 뒤 LLM 생성, 완료 RPC, 결과 편집과 공개 조회 E2E를 검증해야 한다.

ASR도 DB enum에 맞는 youtube_captions로 기록한다. 자막 없는 영상의 Whisper fallback은 이번 MVP에 포함하지 않는다. 자막 50,000자 초과는 거부한다. 긴 영상 요약 체인은 후속 작업이다.

HTML은 DOM 없는 Deno에서도 동작하는 sanitize-html로 정제한다. 스크립트, 이벤트 속성, 위험한 링크를 제거한다. SDK는 Deno의 web shim을 사용한다.

after/waitUntil은 내구성 있는 큐가 아니다. 호출 실패 시 queued가 남고 런타임 종료 시 진행 중 상태가 남을 수 있다. 재dispatch·타임아웃 복구와 재시도 API는 후속 작업이다.

이번 작업은 로컬 구현이며 실제 DB 적용, 배포, 유료 LLM 호출은 하지 않았다.

공식 API 참고: [OpenAI Chat API](https://developers.openai.com/api/reference/resources/chat), [Supabase background tasks](https://supabase.com/docs/guides/functions/background-tasks). Next.js after는 설치된 node_modules/next/dist/docs 문서를 확인했다.
