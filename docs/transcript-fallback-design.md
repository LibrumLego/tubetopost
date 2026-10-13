# 자막 추출 fallback 설계

- 작성 2026-10-14
- 상태: 설계만. 코드/배포/시크릿 변경 없음.
- 범위: `transcript-poc.ts` / `transcript-diagnostic.ts` 격리 검증, Edge Function 자막 공급 경로 변경, 필요 시 전사 워커 추가.

## 1. 전제와 비변경 영역

### 유지하는 것
- `WORKER_SECRET` 공유 시크릿 + Edge Function `handler.ts` 인증 흐름
- Supabase `jobs/posts/profiles/usage_logs` 스키마, RLS, `enqueue_job` / `claim_job` / `finalize_job` / `update_post` / `delete_post` / `increment_view_count` RPC
- Next.js 작업/글 API, `after()` fire-and-forget 트리거
- 쿼터 (`profiles.monthly_quota` 기본 3) 와 완료 시점 소모 로직

### 변경 금지
- 기존 영상/작업 데이터, 운영 중 Supabase 프로젝트의 키/시크릿
- 커밋되지 않은 사용자 로컬 작업
- 성공한 적 없는 화면이나 지표의 기록

### 검증된 사실 (근거)
- 2026-10-14 기준 후보 9개 영상 모두 `caption baseUrl` 응답이 0바이트, URL에 `exp=xpe`. `transcript-diagnostic.ts` 로그에 기록됨.
- `exp=xpe` 는 PO Token 요구 플래그라는 외부 보고와 **부합**. 공식 유튜브 문서로는 확정 불가 — 미확인.
- 사용자 로그인 → `POST /api/jobs` 201 → 워커 호출 → `jobs.status=failed, error_code=NO_TRANSCRIPT` 저장은 실제로 작동.
- Whisper fallback, 외부 자막 공급자, ANDROID InnerTube 경로는 저장소에 **구현된 적 없음**.

### 가격 (2026-10 공식/반공식 자료)
각 수치는 해당 공급자 공식 페이지 기준. 공급자가 가격 변경 시 재검증 필요.

| 항목 | 요율 | 출처 |
| --- | --- | --- |
| OpenAI `gpt-4o-mini-transcribe` | $0.003 / 분 | OpenAI 가격 페이지 (2026-10 반공식 집계) |
| OpenAI `whisper-1` | $0.006 / 분 | 동일 |
| OpenAI `gpt-4o-transcribe` | $0.006 / 분 | 동일 |
| Supadata Free | 100 req/월, 신용카드 불필요, AI fallback 2 credit/분 | supadata.ai/pricing |
| Supadata Basic | $5/월 (연간), 300 credit | 동일 |

구체 금액은 가입/결제 시점에 재확인한다. 위 수치는 "미확인 가능" 상태로 설계만 사용한다.

## 2. 완료 기준 (acceptance)

MVP 완료는 아래 네 조건을 **같은 영상으로 한 번에** 통과해야 한다. 통과 전에는 성공 지표/화면을 포폴에 노출하지 않는다.

1. 로그인 사용자가 URL 입력 → `POST /api/jobs` 201
2. 워커가 자막 또는 전사 결과를 확보해 `jobs.status=done` 전이, `posts` 1건 생성, `profiles.used_this_month += 1`
3. `/app/posts/[id]/edit` 에서 `title`, `content_markdown`, `is_public=true` 토글 저장 성공
4. 비로그인 브라우저에서 `/post/[slug]` 로 접근해 글 본문과 OG 메타가 응답 (`is_public=true` 조건)

중간 실패는 `jobs.error_code` 로 사용자에게 안내한다.

## 3. 옵션 비교

제약: 새 결제·새 계정·새 키 없이 가능한 범위를 우선한다. 그 안에서 불가능하면 범위를 명시한 뒤 사용자 결정 사항으로 분리한다.

### 옵션 A — 외부 자막 공급자 (Supadata)
- **흐름**: Edge Function `fetchTranscript` 호출 전 Supadata REST 호출 → 성공 시 세그먼트 반환, 실패 시 기존 `fetchTranscript` 폴백 또는 즉시 실패.
- **새 계정/키**: Supadata 계정 1개와 API 키 필요. 결제 없이 Free (100 req/월) 로 시작 가능하다고 알려짐, 가입 시 재확인.
- **새 결제**: 100 req/월 초과 시만 필요.
- **운영 범위**: 네트워크 호출만, 추가 런타임 불필요. Edge Function (Deno) 안에서 `fetch` 로 가능.
- **포폴/MVP 적합도**: 가장 짧은 경로. "자막 추출" 역할만 외부에 위임, 생성·편집·공개 로직은 기존 그대로.
- **리스크**: 외부 서비스 장애 시 전체 차단. 요금제 변경 가능성. 공급자가 자체 저작권 정책 가짐.
- **보안**: `SUPADATA_API_KEY` 를 Edge Function Secrets 로만 저장, Next.js 클라이언트에는 노출하지 않음.

### 옵션 B — 별도 전사 워커 (Node 또는 Python + yt-dlp + OpenAI 전사)
- **흐름**: Edge Function 이 자막 추출 실패 시 jobs 상태를 `audio_pending` (신규) 로 바꾸고 중단 → 별도 워커가 큐를 집어 yt-dlp 로 오디오 추출, OpenAI `gpt-4o-mini-transcribe` 호출, 결과를 jobs 에 쓰고 `finalize_job` 호출.
- **새 계정/키**: OpenAI 전사용 추가 Secret 필요 없음 (기존 `OPENAI_API_KEY` 재사용). 전사 워커 호스팅은 Fly.io/Render/Railway 중 무료 티어 가능하지만 **신용카드 요구가 흔함** → 새 결제 수단 등록이 **잠재적으로 필요**. 로컬 상시 구동만으로도 PoC 가능.
- **새 결제**: 변환당 실 사용료 (대부분 영상 10분 이내 → 영상당 $0.03 미만). 월 운영비는 호스팅 선택에 따라 다름.
- **운영 범위**: yt-dlp 바이너리 유지보수, 유튜브가 봇 차단 시 끊김, 오디오 임시 파일 저장소, Edge Function → 워커 공유 시크릿 추가.
- **포폴/MVP 적합도**: 자막이 없는 영상도 처리 가능. 반면 작업 단위가 커진다 (큐·워커·시크릿 하나 더).
- **리스크**: yt-dlp 자체가 유튜브 변경에 깨짐. 상시 호스팅 선택 시 비용·운영 지속성 부담.
- **보안**: 오디오 파일을 로컬·R2 등에 저장 후 전사 완료 시 즉시 삭제. 전사 결과 외에는 보관하지 않는다.

### 옵션 C — 사용자 제공 자막/오디오 업로드
- **흐름**: `/app` 변환 폼에 URL 외에 "SRT/VTT 또는 mp3 업로드" 옵션 추가 → 파일을 Supabase Storage 에 올리고 jobs에 참조. 워커는 자막 파일이면 바로 파싱, 오디오면 OpenAI 전사 호출.
- **새 계정/키**: 없음. Supabase Storage 는 기존 프로젝트 기능.
- **새 결제**: 오디오 전사 호출 시만. Storage 는 Free 티어 범위 내.
- **운영 범위**: 업로드 UI, 파일 크기 상한 (예: 25 MB — OpenAI 전사 파일 상한과 일치), 진행률 UI, 파일 수명 (24h 자동 삭제).
- **포폴/MVP 적합도**: 유튜브 봇 차단과 무관하게 **항상 작동**. "유튜브 URL 자동 추출"이라는 기존 가치 제안이 약화됨.
- **리스크**: 사용자 입력 자막의 포맷 다양성, 파일 보안, 저작권 책임 전가 명시 필요.
- **보안**: Storage RLS 정책을 service_role 전용으로 하거나 서명 URL + 짧은 만료.

### 비교 표

| 축 | A: Supadata | B: 전사 워커 | C: 사용자 업로드 |
| --- | --- | --- | --- |
| 새 계정 필요 | 예 (Supadata 1건) | 없음 (호스팅 선택 시 추가) | 없음 |
| 새 결제 필요 | 조건부 (100 req 초과) | 조건부 (호스팅 + 전사비) | 조건부 (전사비) |
| 외부 의존 | 단일 공급자 | yt-dlp + OpenAI | OpenAI (오디오 시) |
| 유튜브 봇 차단 영향 | 공급자 책임 | 직접 피해 | 없음 |
| MVP 작업량 | 소 | 중 | 중 |
| 지속 운영 비용 | 저~중 | 저~중 (사용량 선형) | 사용량 선형 |
| 자막 없는 영상 커버 | AI fallback 포함 | 커버 | 커버 |
| 포폴 가치 | 외부 통합 설명 1건 | 큐/워커/파일 처리 | 파일 업로드 흐름 |

## 4. 추천 아키텍처

### 4.1 1단계: 옵션 A (Supadata)
외부 의존을 하나 늘리는 대신, 저장소 코드 변경과 운영 복잡도는 가장 적다. MVP 완료 기준을 가장 빠르게 통과할 수 있고, PO Token 여부와 상관없이 "YouTube 자막 공급" 역할을 한 번에 해결한다. Supadata 가입 자체는 사용자가 수행해야 하는 외부 작업으로 **별도 표시**.

### 4.2 2단계: 옵션 C (사용자 업로드) 를 안전망으로 추가
Supadata가 실패하거나 월 쿼터를 소진했을 때 사용자가 직접 자막/오디오를 제출할 수 있는 경로. 외부 공급자 장애에 대한 격리와 포폴에서 보여줄 "파일 처리" 범위를 동시에 확보한다.

### 4.3 보류: 옵션 B
yt-dlp 상시 호스팅은 운영 리스크·비용이 가장 크다. PoC가 명확하지 않은 상태에서 선투자하지 않는다. Supadata 공급 중단 또는 요금 정책 급변 시 재검토 트리거 조건을 문서에 남긴다.

### 4.4 데이터 모델 변경 최소안
현재 `transcript_source` enum은 `youtube_captions`, `whisper` 두 값이다. 설계 변화에 맞게 아래 값을 추가한다. **마이그레이션 작성/적용은 사용자 결정 후 별도 작업**.

- `supadata` : 외부 공급자가 반환한 자막
- `supadata_asr` : 공급자가 AI fallback 으로 생성한 전사
- `user_upload_captions` : 사용자가 올린 SRT/VTT
- `user_upload_asr` : 사용자가 올린 오디오를 OpenAI 전사한 결과

`whisper` 값은 유지하되 사용하지 않도록 하거나 `openai_asr` 로 통일한다. 변경은 **파괴적**이므로 enum 추가만 하는 마이그레이션으로 분리한다.

세그먼트 timestamp 보관: 현재 `jobs.transcript` 는 text 한 덩어리다. 세그먼트 기반 각주 (`[영상 구간](?t=123)`) 를 위해 `jobs.transcript_segments jsonb` 를 추가하는 안을 함께 제안한다. 추가 전 LLM 생성에 쓰이는 입력이 `Segment[]` 임을 확인하고 (`generateSections(outline, transcript.segments, ...)`) 데이터만 지속화한다.

## 5. 공통 PoC 설계

구현 전 아래 PoC 를 **격리된 스크립트**로 실행해 가정이 사실인지 확인한다. 모두 실패하면 해당 옵션은 폐기한다.

### PoC-A: Supadata
- 스크립트: `scripts/poc-supadata.mjs` (신규, Node)
- 입력: 환경변수 `SUPADATA_API_KEY`, 영상 ID 1개
- 호출: `GET https://api.supadata.ai/v1/youtube/transcript?url=https://youtu.be/<id>&format=json` 또는 공식 문서 지정 엔드포인트 (호출 전 공식 문서 1회 확인)
- 성공 기준:
  - HTTP 200
  - JSON 안에 segment 배열 (text + start time) 존재
  - PO Token 걸렸던 `arj7oStGLkU` 를 포함해 3개 중 2개 이상 성공
- 실패 분기: HTTP 4xx 또는 빈 segment → 옵션 A 보류, 사용자에게 공급자 변경 (`transcriptapi.com` 등) 또는 옵션 C 전환 결정 요청

### PoC-B: InnerTube ANDROID 직접 호출 (옵션 A 폐기 시 재검토용)
- 스크립트: `scripts/poc-innertube.ts` (Deno)
- 호출: `POST https://www.youtube.com/youtubei/v1/player` with `context.client = { clientName: "ANDROID", clientVersion: "19.09.37" }` (버전은 호출 시점에 재확인)
- 성공 기준: 응답의 `captions.playerCaptionsTracklistRenderer.captionTracks[].baseUrl` 가 PO Token 없이 자막 본문을 반환
- 실패 분기: 거의 확실하게 유튜브가 추가 보호를 걸고 있을 수 있음 → **단정하지 않고** 실제 호출로 검증. 실패 시 옵션 B 또는 C.

### PoC-C: OpenAI 전사
- 스크립트: `scripts/poc-transcribe.mjs` (Node)
- 입력: 로컬 짧은 mp3/mp4 1개, `OPENAI_API_KEY`
- 호출: `POST https://api.openai.com/v1/audio/transcriptions` with `model=gpt-4o-mini-transcribe`
- 성공 기준: 10초 영상 전사 결과 받기, 세그먼트 timestamps 포함 (`response_format=verbose_json`)
- 실패 분기: 조직 접근 권한 부족이면 사용자에게 OpenAI 계정 확인 요청

PoC 비용 상한: 각 PoC 당 OpenAI 쪽 최대 $0.05 (약 30분 전사 분량). 초과 시 즉시 중단.

## 6. 1단계 상세 설계 (옵션 A)

### 6.1 파일 수정 범위 (아직 수정하지 않음)
- `supabase/functions/process-job/types.ts`: `Segment` 는 그대로. `TranscriptSource` 추가 (내부 상수).
- `supabase/functions/process-job/transcript.ts`: 신규 함수 `fetchFromSupadata(videoId)` 추가. 성공 시 세그먼트 반환, 실패 시 기존 경로로 폴백.
- `supabase/functions/process-job/handler.ts`: `fetchTranscript` 호출 전 Supadata 시도 순서 추가. 에러 분기 그대로.
- `supabase/migrations/0004_transcript_source.sql` (신규): `transcript_source` CHECK 제약을 확장. 기존 값 유지.
- `scripts/poc-supadata.mjs` (신규): 위 PoC-A 스크립트.
- `docs/worker.md`: 공급자 추가와 Secret 이름 반영.
- `.env.local.example` + `scripts/check-env.mjs`: `SUPADATA_API_KEY` 를 **optional** 로 등록.
- Edge Function Secrets: `SUPADATA_API_KEY` 추가 (사용자가 `pnpm sb secrets set` 수행).

변경하지 않는 파일: `supabase/migrations/0001~0003`, `src/app/api/jobs/route.ts`, 모든 UI 파일. 자막 공급 변경은 워커 내부에 한정한다.

### 6.2 API 계약
Edge Function 외부 노출은 변경하지 않는다. Supadata 호출은 내부에서만 발생.

Supadata 호출 (최종 형태는 PoC-A 실측 후 확정):
```
GET https://api.supadata.ai/v1/youtube/transcript?url=<encoded>&format=json
Headers: x-api-key: <SUPADATA_API_KEY>
Timeout: AbortSignal.timeout(20000)
Response (성공): { lang, segments: [{ text, offset_ms, duration_ms }], ... }
Response (실패): { error, code }
```

실제 응답 필드명은 공식 문서로 재확인 후 반영. 매핑: `offset_ms / 1000 → Segment.start`, `text → Segment.text`.

실패 코드 매핑:
- 401 / 403: Secret 설정 오류 → `TranscriptError("SUPADATA_UNAUTHORIZED")` → `error_code=INTERNAL`, 유저 메시지는 일반 안내.
- 429: 쿼터 소진 → `TranscriptError("SUPADATA_QUOTA")` → `error_code=NO_TRANSCRIPT`, 유저 메시지에 "현재 변환 공급이 일시 중단되었습니다" 추가.
- 404 / 422: 자막 없음 → `TranscriptError("NO_CAPTIONS")` → 기존 경로.
- 5xx / timeout: 재시도 1회 후 실패.

### 6.3 비용 상한
- 영상당 Supadata credit 1 (자막) 또는 분당 2 (AI fallback). 영상 60분 전사 fallback = 120 credit → 월 Free 100 credit 금방 소진.
- 완화책: Edge Function 안에서 `video_duration_sec > 1200` (20분) 이면 Supadata AI fallback 요청을 스킵하고 즉시 `NO_TRANSCRIPT` 처리. 사용자에게 "20분 이상 영상은 추후 지원" 안내.
- 월 쿼터 추적: `usage_logs` 에 `provider='supadata', operation='transcript', input_tokens=null, output_tokens=null, audio_seconds=video_duration_sec, cost_usd=0` (실 요율은 Supadata 가격을 secret 로 주입하거나 미확인 상태로 0 유지) 로 기록. OpenAI 로그와 동일 테이블 재활용.

### 6.4 전사 timestamps / transcript_source
- `jobs.transcript_source` 를 `supadata` 또는 `supadata_asr` 로 기록 (마이그레이션 0004 적용 후).
- `jobs.transcript` 는 세그먼트 텍스트를 스페이스로 join 한 결과 (기존과 동일).
- 세그먼트 자체는 LLM 호출용으로만 메모리에서 사용. 추후 각주 기능 요구가 생기면 `jobs.transcript_segments jsonb` 를 추가하는 별도 마이그레이션.

### 6.5 시크릿 처리
- `SUPADATA_API_KEY` 는 Edge Function Secrets 전용. Next.js `.env.local` 에는 넣지 않는다.
- `.env.local.example` 에 "Edge Function 전용. Next.js 환경변수가 아니다" 주석을 명시.
- 사용자에게는 "`pnpm sb secrets set SUPADATA_API_KEY=...` 1회 실행" 지시 1줄.

### 6.6 내구성·재시도·타임아웃
- 1단계 범위에서는 **큐 내구성/자동 재시도를 신설하지 않는다**. 기존 `after()` + `waitUntil` 모델을 유지한다.
- 다만 `jobs` 에 `retry_count` 가 존재하고 미사용. 사용자가 `/app/jobs/[id]` 에서 수동 재시도 버튼을 눌렀을 때 `enqueue_job` 를 재호출하지 않고 `jobs` 상태만 `queued` 로 되돌리는 RPC 는 **별도 작업**으로 남긴다.
- Edge Function 전체 처리에 90초 상한 (Supabase Edge 기본 150초 안). 초과 시 handler 가 즉시 `error_code=INTERNAL`, `error_message=TIMEOUT_90S` 로 저장.
- 중복 완료는 `finalize_job` 의 `v_post.id is not null` 검사로 이미 차단된다. 변경 없음.

### 6.7 테스트 (실제 E2E 전에 확인)
- `supabase/functions/process-job/worker_test.ts`
  - 추가 시나리오: `supadata_success` (mock fetch), `supadata_401`, `supadata_404` → NO_CAPTIONS, `supadata_quota` → NO_TRANSCRIPT with 공급 중단 메시지
  - 기존 `success` 시나리오는 `supadata_success` 로 교체 또는 보존
- `scripts/poc-supadata.mjs`: 수동 실행만, CI 제외
- Next.js: 변경 없음, `pnpm lint && pnpm typecheck && pnpm build` 통과
- 수용 기준은 섹션 2 참조

### 6.8 배포
- Edge Function 재배포 (`pnpm sb:deploy`) 전에 `pnpm sb secrets set SUPADATA_API_KEY=...` 를 사용자에 요청
- 재배포 후 `pnpm worker:check` 로 인증 regression 없는지 확인
- `pnpm diag:transcript <id>` 는 그대로 유지 (기존 경로 상태 확인용)

## 7. 2단계 상세 설계 (옵션 C)

### 7.1 파일 수정 범위 (아직 수정하지 않음)
- `src/app/(protected)/app/convert-form.tsx`: URL 입력 외에 "SRT/VTT 또는 mp3 선택" 토글, 파일 input (type=file, accept=".srt,.vtt,.mp3,.m4a")
- 새 API Route `src/app/api/jobs/upload/route.ts`: multipart/form-data 수신, Supabase Storage 업로드, `enqueue_job` 호출 전 jobs 테이블에 파일 참조 저장 (추가 컬럼 필요)
- 마이그레이션 `0005_upload_assets.sql`: `jobs.upload_bucket text`, `jobs.upload_path text`, `jobs.upload_kind text check (upload_kind in ('captions','audio'))`
- Edge Function `transcript.ts`: upload 참조가 있으면 Supabase Storage 에서 파일을 받아 자막은 파싱, 오디오는 OpenAI 전사
- UI: 업로드 진행률, 25 MB 상한 안내, "저작권 책임은 업로더에게 있다" 체크박스

### 7.2 Storage 정책
- 전용 버킷 `uploads/jobs/{user_id}/{job_id}.{ext}`
- 공개 접근 금지, service_role 쓰기, 업로드 완료 후 24h 뒤 자동 삭제 (Supabase Storage 수명 정책 없으면 cron RPC)
- 파일 서명 URL 은 Edge Function 호출 시점에만 발급

### 7.3 비용/보안 상한
- 파일 최대 25 MB (OpenAI 전사 상한과 일치)
- 전사 호출당 `usage_logs` 기록, `audio_seconds` 반영
- 무료 쿼터 소진 시 업로드 거부

### 7.4 수용 기준
섹션 2 그대로. 업로드 경로에서도 `jobs.transcript_source=user_upload_captions` 또는 `user_upload_asr` 로 기록, 공개 글 조회까지 확인.

## 8. 순서와 결정 포인트

1. **사용자 결정 필요**: 옵션 A를 위해 Supadata 가입 수행 여부. 가입 전까지는 이 설계 1단계 구현 보류.
2. 가입 후 사용자가 `SUPADATA_API_KEY` 를 Edge Function Secrets 에 넣음.
3. `PoC-A` 실행 → 섹션 5 성공 기준 통과 여부 로그를 `docs/transcript-poc-log.md` (신규, 선택) 에 기록.
4. 통과 시 섹션 6 변경을 **별도 커밋 2건**으로 적용:
   - 마이그레이션 0004 + types 확장
   - 워커 Supadata 통합 + 테스트
5. 실제 영상 1개로 섹션 2 네 조건 통과 확인. 통과 못 하면 해당 커밋 revert.
6. 섹션 2 통과 후, 옵션 C 는 포폴 범위와 일정에 따라 추진 여부 결정.

## 9. 공식 자료 재확인 체크리스트 (구현 시점)

- Supadata 공식 가격/엔드포인트/응답 포맷 (현재 반공식 집계만 보유)
- OpenAI 전사 모델 가격, 세그먼트 timestamp 필드명 (`segments` vs `words`), 25 MB 상한 지속 여부
- Supabase Edge Function 실행 시간/메모리 한도 (현재 150초 기준으로 설계)
- YouTube 자막 추출의 저작권/약관 경계 (사용자 업로드 경로 포함)

구현 전에 각 항목에 대해 날짜 + 출처 URL + 확인 결과를 `docs/worker.md` 또는 본 문서 하단에 1줄씩 기록한다. 수치가 바뀌면 비용 상한과 안내 메시지를 갱신한다.

## 10. 비포함 항목 (명시적 보류)

- 내구성 큐 (Redis / Upstash / Supabase Queue) — 1단계 범위 밖
- 자동 재시도 cron — 수동 재시도 UI 가 선행
- 다수 자막 공급자 동시 운영 — 단일 공급자 성과 확인 후 고려
- 실시간 자막 (streaming transcription) — 포폴 범위 밖
- 음성 다이어라이제이션/스피커 분리 — 범위 밖
- 자막 원본의 상업적 재배포 — 범위 밖, 공개 글은 "요약 파생 저작물" 로 포지셔닝

## 11. 참고 출처

### 2026-10-14 공식 확인 및 구현 전 정정

기존 제안은 기록으로 보존한다. 아래 정정이 앞선 미확인 API 예시와 수치에 우선한다.

- Supadata [공식 transcript 계약](https://docs.supadata.ai/get-transcript): `GET /v1/transcript`, `x-api-key`, `mode=native`, `text=false`. 응답은 `content` 배열의 `text`, `offset`, `duration`이며 시간 단위는 밀리초다. `segments`와 `offset_ms`, `format=json`을 가정하지 않는다. HTTP 202는 async job이며 즉시 성공이 아니다. 준비된 PoC는 polling하지 않고 미통과로 처리한다.
- Supadata [공식 가격](https://supadata.ai/pricing): Free 100크레딧/월, 1요청/초, 카드 불필요. 기존 자막 1크레딧, AI 생성 분당 2크레딧. Basic은 월 $5 상당의 연간 $60 결제다. 3크레딧 PoC는 `auto` 대신 `native`로 AI 생성을 금지한다. 세 요청 사이 최소 1.1초를 둔다.
- OpenAI [공식 전사 가이드](https://developers.openai.com/api/docs/guides/speech-to-text): `timestamp_granularities`는 `whisper-1`에서만 지원한다. PoC-C에서 세그먼트 timestamp가 필수면 `whisper-1`과 `verbose_json`을 사용하도록 수정한다. `gpt-4o-mini-transcribe`에 같은 형식을 가정하지 않는다. 파일 상한은 25MB다.
- OpenAI [공식 가격](https://developers.openai.com/api/docs/pricing): `gpt-4o-mini-transcribe` 예상 분당 $0.003, `gpt-4o-transcribe` 예상 분당 $0.006. $0.05는 $0.003 기준 약 16.7분이므로 앞선 약 30분 설명은 잘못됐다. 세그먼트 전사는 선택 모델의 요율과 실제 입력 길이로 별도 예산을 계산한다.
- 저장소 대조: 후보 9개 중 8개는 빈 자막 응답, 1개는 자막 트랙 없음이다. `transcript_source`는 enum 타입이 아니라 text CHECK 제약이다. `usage_logs.operation`은 현재 `whisper/chat`만 허용하므로 공급자 로그 `transcript` 추가에는 별도 CHECK 확장과 테스트가 필요하다.
- 현재 handler는 모든 `TranscriptError`를 `NO_TRANSCRIPT`로 변환한다. 통합 시 공급자 인증·쿼터·자막 부재의 명시적 분류와 타입 변경을 함께 검증해야 한다. source 추가에 맞춰 `src/types/jobs.ts` 및 진행률 로직도 확인한다.
- 공급자 요청 전 영상 길이를 현재 oEmbed만으로 알 수 없으므로 20분 AI 비용 제한을 적용할 수 없다. 1단계는 native만 사용한다. AI fallback 도입은 신뢰할 수 있는 길이 조회·예산 예약·취소/타임아웃 계약을 정한 뒤 별도 작업이다.
- 업로드 작업은 `enqueue_job`로 먼저 원자적으로 생성하고 파일 참조를 소유자 검증 하에 연결하는 순서가 필요하다. 존재하지 않는 jobs 행에 파일 참조를 먼저 저장할 수 없다. 업로드 실패 정리, 잠금, 쿼터와 dispatch 전 상태를 별도 설계한다.
- PoC 스크립트와 테스트를 작성했지만 현재 키가 없어 외부 요청 0건으로 종료했다. [실제 로그](transcript-poc-log.md) 참고. 2개 이상 실제 성공 조건 충족 전 워커/DB 구현과 배포를 시작하지 않는다.

- Supadata 가격: https://supadata.ai/pricing — 2026-10 확인, 재검증 필요
- OpenAI 전사 가격 집계: https://costbench.com/software/ai-transcription-apis/openai-whisper/ 외 — 2026-10 집계, 공식 OpenAI 가격 페이지로 재확인 필요
- YouTube `exp=xpe` 보고: https://github.com/jdepoix/youtube-transcript-api/issues/592 — 가설과 부합, 저희 환경 단일 원인으로 단정하지 않음
- 저장소 내부: `docs/demo-videos.md`, `docs/worker.md`, `supabase/functions/process-job/transcript.ts`, `supabase/migrations/0001_init.sql`, `src/app/api/jobs/route.ts`
