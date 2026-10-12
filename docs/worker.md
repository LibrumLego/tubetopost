# 변환 워커

## 구성과 배포

`0002_finalize_job.sql`은 service_role 전용 완료 RPC다. 글 저장, done 전이, 월 사용량 증가를 한 트랜잭션으로 처리한다. 중복 완료는 P0012로 거부하고, slug 충돌과 월 쿼터 리셋도 처리한다.

Next.js는 응답 후 `after`로 워커를 호출한다. 워커는 요청한 job만 조건부 업데이트로 claim한 후 202를 반환하고 `EdgeRuntime.waitUntil`로 작업한다. 일반 사용자 JWT는 거부하며 Authorization 헤더가 서비스 키와 정확히 일치해야 한다.

1. 연결된 Supabase DB에 0001과 0002를 순서대로 적용한다. 기존에 적용한 0001은 다시 실행하지 않는다.
2. Edge Function secrets에 `OPENAI_API_KEY`를 설정한다. 기본 모델은 지시서의 `gpt-4o-mini`, 변경은 `OPENAI_MODEL`로 한다. `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`는 플랫폼 기본 secret이다.
3. `supabase functions deploy process-job` 실행. config.toml의 verify_jwt=false는 함수 내부 서비스 키 검증과 함께 사용한다.
4. Next.js 서버 환경에 `SUPABASE_WORKER_URL=https://<project-ref>.supabase.co/functions/v1/process-job`과 `SUPABASE_SERVICE_ROLE_KEY`를 설정한다. 클라이언트 공개 변수로 설정하지 않는다.
5. 로그인 후 작업 생성 → done 전이, 결과 글 1개와 쿼터 증가를 확인한다.

각 LLM 호출의 토큰 사용량을 기록한다. 비용 추정에는 Edge secret `OPENAI_INPUT_USD_PER_MILLION`, `OPENAI_OUTPUT_USD_PER_MILLION`에 해당 모델 요율을 설정한다. 미설정 시 cost_usd는 0으로 실제 청구 금액을 뜻하지 않는다.

## 로컬 검증

```powershell
deno check --config supabase/functions/process-job/deno.json supabase/functions/process-job/index.ts
deno test --config supabase/functions/process-job/deno.json --allow-env --allow-net --allow-read supabase/functions/process-job/worker_test.ts
deno run --config supabase/functions/process-job/deno.json --allow-net supabase/functions/process-job/transcript-poc.ts <video-id>
```

Next.js 타입 검사에서 Deno 디렉터리는 제외하고 Deno 자체 검사로 검증한다. 의존성은 deno.json과 deno.lock에 고정한다.

- PGlite: 완료 트랜잭션, invalid payload rollback, 상태 검증, 중복 완료, slug 충돌, 월 쿼터 리셋, 호출 권한 통과.
- Deno: 타입 검사와 테스트 9개 통과. 인증, 자막 파싱, HTML 정제, mocked 정상 완료/자막 없음/중복/DB claim 실패/LLM 실패 확인.
- Next.js: 타입 검사, lint, production build 통과.
- 실제 유튜브 dQw4w9WgXcQ PoC는 CAPTIONS_UNAVAILABLE로 실패했다. 비공식 자막 API의 실제 성공과 Supabase/OpenAI 실키 E2E는 미검증이다.

## 현재 제한

ASR도 DB enum에 맞는 youtube_captions로 기록한다. 자막 없는 영상의 Whisper fallback은 이번 MVP에 포함하지 않는다. 자막 50,000자 초과는 거부한다. 긴 영상 요약 체인은 후속 작업이다.

HTML은 DOM 없는 Deno에서도 동작하는 sanitize-html로 정제한다. 스크립트, 이벤트 속성, 위험한 링크를 제거한다. SDK는 Deno의 web shim을 사용한다.

after/waitUntil은 내구성 있는 큐가 아니다. 호출 실패 시 queued가 남고 런타임 종료 시 진행 중 상태가 남을 수 있다. 재dispatch·타임아웃 복구와 재시도 API는 후속 작업이다.

이번 작업은 로컬 구현이며 실제 DB 적용, 배포, 유료 LLM 호출은 하지 않았다.

공식 API 참고: [OpenAI Chat API](https://developers.openai.com/api/reference/resources/chat), [Supabase background tasks](https://supabase.com/docs/guides/functions/background-tasks). Next.js after는 설치된 node_modules/next/dist/docs 문서를 확인했다.
