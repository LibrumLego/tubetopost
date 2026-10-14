# 변환 워커

Supadata native 자막을 우선 사용하고 제공자가 자막을 제공하지 못하면 YouTube 직접 추출로 fallback한다. Whisper와 AI 전사는 구현하지 않았다. Supadata metadata로 실제 영상 길이를 먼저 확인하며, 확인 실패 또는 20분 초과는 거절한다. 자막 제한은 50,000자다.

## 배포

1. `supabase/migrations`를 번호 순서대로 적용한다. 적용된 파일은 다시 실행하지 않는다. 현재 원격 DB에는 0007까지 적용되어 있다.
2. Edge secrets에 `OPENAI_API_KEY`, `OPENAI_MODEL`, 입력·출력 단가, `SUPADATA_API_KEY`, `WORKER_SECRET`을 설정한다. 단가는 모델에 맞춰야 한다. Supabase URL과 service role key는 플랫폼이 제공한다.
3. `pnpm sb:deploy`로 배포한다. `verify_jwt=false`와 함수 내부 worker secret 검증을 함께 사용한다.
4. Next.js에 `SUPABASE_WORKER_URL`, `SUPABASE_SERVICE_ROLE_KEY`, 동일한 `WORKER_SECRET`을 설정한다. 키와 secret은 공개 환경변수로 설정하지 않는다.
5. `pnpm env:check`, `pnpm worker:check`로 확인한다.

Next.js는 응답 후 `after`로 요청한다. 워커는 DB에서 attempt를 claim하고 `EdgeRuntime.waitUntil`로 실행한다. 완료 RPC는 결과 저장·완료 전이·월 사용량 증가를 트랜잭션으로 처리한다. 만료 작업 복구, 수동 재시도, 예산 예약, 편집 revision은 [운영 및 검증 기록](reliability.md)에 설명했다.

## 로컬 검증

```powershell
pnpm lint
pnpm build
pnpm worker:check
deno check --config supabase/functions/process-job/deno.json supabase/functions/process-job/index.ts
deno test --config supabase/functions/process-job/deno.json --allow-env --allow-net --allow-read supabase/functions/process-job/worker_test.ts
```

워커 probe는 작업이나 LLM 호출을 만들지 않는다. 잘못된 인증은 401, 올바른 secret과 잘못된 작업 ID는 400이어야 한다. Deno 테스트 19개와 실제 변환·편집 결과는 운영 기록을 참고한다. 이전 추출 실패와 공급자 도입 과정은 [PoC 기록](transcript-poc-log.md)에 남아 있다.

HTML은 sanitize-html로 정제한다. 사용량과 예약 예산은 서로 다르며 공급자 크레딧은 OpenAI 비용에 포함되지 않는다. 생성 글은 공개 전 원문 대조가 필요하다.

공식 문서: [Supadata metadata](https://docs.supadata.ai/get-metadata), [transcript](https://docs.supadata.ai/get-transcript), [OpenAI Chat API](https://developers.openai.com/api/reference/resources/chat), [Supabase background tasks](https://supabase.com/docs/guides/functions/background-tasks).
