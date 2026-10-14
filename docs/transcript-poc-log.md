# 전사 공급 PoC 로그

## 2026-10-14: Supadata 통합 E2E 통과

- 마이그레이션 0004를 실제 DB에 적용하고 카탈로그의 CHECK 확장 및 적용 이력을 확인했다. 공급자 키는 값 출력 없이 Edge Function Secrets에 설정했다.
- 첫 통합 작업 `e170cb0d-a865-4a38-83d4-7b36503c8bc1`: Supadata 자막 12,671자 확보, 이후 GENERATION_FAILED. OpenAI 키 동일성 및 짧은 호출 200을 확인했고, 생성 호출 9건이 기록됐다. 마지막 JSON 검증 실패 가능성을 검토해 유효한 영문 SEO slug의 길이를 서버에서 제한하도록 보완했다. 이전 실패의 정확한 원본 JSON은 보관하지 않아 단정하지 않는다.
- 성공 영상: `arj7oStGLkU`. 작업 `5f8327bf-c152-498c-99f2-b62b7f4186f6`, 결과 글 `6a3def0c-8397-4888-822d-456efc94ee6e`, slug `procrastination-and`.
- 실제 앱 요청 후 `done / transcript_source=supadata`, 글 정확히 1건, 월 사용량 0→1, 워커 처리 시간 28.237172초 확인.
- 편집 화면 자동 이동 확인. 제목을 `미루는 습관의 심리: 팀 어반 TED 강연`으로 수정하고 저장됨 확인. 공개 토글 저장과 DB `is_public=true` 확인. Markdown은 4,706자다.
- 세션 쿠키 없는 별도 HTTP 클라이언트로 `/post/procrastination-and` 요청: HTTP 200, 수정된 제목·본문·og:title 모두 확인. 비로그인 브라우저 시각 검증을 대체한 비인증 HTTP 검증이며 UA는 PowerShell 기본값이다.
- 성공 작업 OpenAI 로그의 추정 비용 합계 $0.004732. 최초 실패 작업과 별도 짧은 API 진단 호출은 이 금액에 포함하지 않는다. Supadata native는 성공 작업당 1회 요청이며 실제 크레딧 청구는 공급자 대시보드 확인 대상이다.
- 자동 검증: production build(TypeScript 포함), ESLint, 환경 점검, Deno 테스트 17개 통과. 재배포 후 worker:check 401/400 통과.

## 2026-10-14: 실제 PoC-A 통과

실행자: Codex. Supadata 로그인과 온보딩 후 발급된 키를 `.env.local`에 설정하고 `pnpm poc:supadata` 실행. 키와 자막 내용은 로그에 출력하지 않았다.

| 영상 ID | HTTP 상태 | segments_count | usable |
| --- | ---: | ---: | --- |
| arj7oStGLkU | 200 | 315 | true |
| dQw4w9WgXcQ | 200 | 61 | true |
| jNQXAC9IVRw | 200 | 4 | true |

결론: native 공급 PoC 통과(3/3), 종료 코드 0. 총 3회 요청, 예상 3크레딧. 이 결과는 자막 공급 검증이며 전체 글 생성·편집·공개 조회 E2E 통과는 아니다. 아래 키 누락 기록은 이전 실행이다.

## 2026-10-14: PoC-A Supadata

실행자: Codex. 명령: `pnpm poc:supadata`.

결과: `SUPADATA_API_KEY_MISSING`, 종료 코드 1, 외부 요청 0건. 공급자 비용 0크레딧. 실제 영상 결과는 없으며 PoC 통과가 아니다.

검증 테스트: `node --test scripts/poc-supadata.test.mjs` 3개 통과. 요청 모드는 native, 최대 3회, 잘못된 timestamp·비동기 응답·잘못된 JSON은 성공으로 세지 않는다. 인증·결제·쿼터 오류는 즉시 중단한다. 응답 텍스트와 키는 출력하지 않는다.

## 실제 실행 준비

사용자가 Supadata에서 발급받은 키를 로컬 `.env.local`의 `SUPADATA_API_KEY`에 입력하거나 실행 환경변수로 설정하고 `pnpm poc:supadata`를 실행한다. 키는 채팅·커밋에 넣지 않는다. 로컬 키는 PoC용이며 운영 시 Edge Function Secrets에 따로 설정해야 한다.

기존 자막만 요청하며 AI 생성·자동 재시도·비동기 polling은 하지 않는다. HTTP 202는 이번 PoC에서 미통과로 기록한다. native 결과가 3개 중 2개 이상 유효할 때만 종료 코드 0이다. 요청 횟수 기준 예상 최대 3크레딧이며 실제 청구는 공급자 대시보드에서 확인한다.

키 설정 후 나온 숫자·boolean 결과를 이 문서에 기록한다. PoC 통과 전 워커 통합·DB 마이그레이션·재배포는 진행하지 않는다.
