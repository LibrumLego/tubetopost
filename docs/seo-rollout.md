# 공개 글과 검색 노출 작업

2026-10-15 Claude 지시서 A(도메인)·B(공개 글)를 확인했다. 도메인은 사용자가 이름 결정·구매 후 연결하는 범위다. 기존 운영 주소에서 공개 글 기반과 검색 노출 설정을 먼저 진행한다.

## 구현

- 랜딩 Before/After 아래에 최근 공개 글 최대 6개를 표시한다. 제목·설명·썸네일·글 링크가 있으며 공개 글이 없으면 섹션을 숨긴다.
- ‘최근’에 맞춰 created_at 내림차순으로 정렬한다. 지시서 예시의 `descending` 대신 SDK의 `ascending: false`를 사용했다.
- 조회에는 쿠키나 service role을 사용하지 않는 익명 클라이언트를 쓰고 is_public 필터와 RLS를 모두 적용한다.
- sitemap은 랜딩과 모든 공개 글만 포함하고 글의 updated_at을 lastModified로 사용한다. PostgREST 1,000행 제한을 넘는 경우도 페이지 단위로 읽는다. 조회 실패를 정상적인 빈 사이트맵으로 숨기지 않는다.
- robots는 /app·/api·/auth·/login 크롤링을 제외한다. 접근 권한은 별도로 Auth/RLS가 담당한다.
- OG 이미지·Twitter Card·canonical·Article JSON-LD를 확인했다. JSON-LD에 수정일을 추가하고 `<`를 escape해 사용자 제목이 script 태그를 종료하지 못하도록 했다.
- `scripts/review-post.mjs <post-id>`는 제목·목차·중복 목차·영상 링크·주의 표현·원문에 숫자로 일치하지 않는 수치를 출력한다. 읽기 전용이며 경고 유무는 사실 정확성 판정이 아니다.
- Google Search Console HTML meta 검증을 위해 서버 환경변수 `GOOGLE_SITE_VERIFICATION`을 지원한다. 값은 공개 meta 태그로 출력된다.

## 공개 글 현황

| 제목 | slug | 원본 영상 | 검수 상태 |
|---|---|---|---|
| 우리는 왜 미룰까: 팀 어반의 TED 강연에서 읽는 두 가지 미루기 | exploring-procrastin | arj7oStGLkU | 전체 원문 대조·수정 기록 있음 |
| 미루는 습관의 심리: 팀 어반 TED 강연 | procrastination-and | arj7oStGLkU | 이전 E2E 공개 글. 이번 전체 원문 대조 대상은 아님 |

실제 DB에는 공개 글 2개가 있으며 같은 영상이다. 다양한 주제의 검수 글 5개 이상이라는 목표를 달성했다고 간주하지 않는다. 기존 공개 설정은 유지했다. 새 글은 사용자 영상 선정과 검수·공개 결정에 따라 추가한다. 도메인과 서비스 이름 검토는 [이름 검토](naming-review.md)를 참고한다.

## 지시서에서 보정한 사항

현재 워커는 Supadata metadata와 native transcript를 각각 요청하므로 영상당 1 credit로 단정할 수 없다. 실제 생성 비용도 토큰 수와 단계별 호출에 따라 달라진다. 자동 업그레이드는 하지 않는다. 공급자 잔여 크레딧을 확인한 뒤 배치를 정한다.

service role key만으로 `enqueue_job`을 호출하면 auth.uid()가 없어 사용자 인증 조건을 충족하지 않는다. 향후 일괄 생성도 정상 로그인 사용자의 API 또는 명시적인 관리자 전용 설계를 사용해야 하며, 기존 권한·예산 제한을 우회하지 않는다.

## 남은 결정

추가 영상 목록·공개할 글, 서비스 표시명과 구매 도메인은 아직 확정되지 않았다. 승인되지 않은 초안이나 다른 사용자의 글을 공개하지 않는다. Search Console 등록만으로 검색 색인·유입을 보장하지 않는다.

## 검증 기록

lint·프로덕션 빌드 통과 후 GitHub push로 운영 자동 배포를 완료했다. `node scripts/check-demo.mjs`로 공개 글 쇼케이스 링크·sitemap·robots·canonical·인증 처리를 검증했다. 별도 원격 대조에서 공개 글 2개가 모두 사이트맵에 있고 비공개 글 5개가 모두 빠지는 것을 확인했다. Article JSON-LD의 수정일·OG 이미지·Twitter Card도 확인했다.

Supadata `/v1/me` 조회 결과 Free (100/mo), 사용 20 / 한도 100, 잔여 80 credits였다. 이 확인 과정에서 새 영상을 변환하지 않았다. 잔여량은 이후 사용에 따라 바뀐다.

Google Search Console에서 현재 운영 주소의 URL 접두어 속성을 추가하고 HTML meta 방식으로 ‘소유권이 확인됨’을 확인했다. production 환경변수의 검증 토큰을 유지해야 한다.
