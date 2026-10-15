# 원문 대조·Claude 교차 검수 후 공개한 글

사용자의 후속 작업 계속 지시에 따라 공식 TED 영상 3개를 선정해 개발자 계정에서 순차 변환했다. 기존 TypeScript 초안 1개를 더해 원문 대조 후 비공개로 저장하고 Claude에게 교차 검수를 받았다. 지적 사항을 반영한 뒤 4개를 공개했다. 기존 검수 TED 글과 합쳐 원본 영상 5종의 검수 글을 갖췄다.

| 주제 | 원고 | 공개 글 |
|---|---|---|
| 작은 습관·도전 | [30일 도전](30-day-challenge.md) | [읽기](https://tubetopost.vercel.app/post/30-day-challenge) |
| 개발 | [TypeScript 정적 타입](typescript-static-types.md) | [읽기](https://tubetopost.vercel.app/post/typescript-advantage) |
| 소통 | [듣고 싶은 말하기](listening-and-speaking.md) | [읽기](https://tubetopost.vercel.app/post/how-to-speak-effect) |
| 협업 | [마시멜로 챌린지](marshmallow-teamwork.md) | [읽기](https://tubetopost.vercel.app/post/teamwork-marshmallow) |

## 원문 대조에서 수정한 내용

- Matt Cutts: `50,000 words`, `1,667 words`를 글자 수가 아닌 단어 수로 정정했다. 습관 형성 기간을 보편적으로 입증한 사실처럼 서술하지 않았다. Morgan Spurlock을 철학자로 부르는 농담은 생략했다.
- TypeScript: 모든 실행 오류를 방지한다는 단정을 피하고 타입 검사·IDE 피드백의 소개로 범위를 좁혔다. 반복 설명과 일시적 할인 광고를 생략했다.
- Julian Treasure: 부정적 태도와 불평을 별도로 세어 일곱 습관을 맞췄다. Integrity는 말과 행동의 일치, register는 성구, timbre는 음색으로 정정했다.
- Tom Wujec: 첫 공급 응답이 아랍어 번역 자막이었다. 영어 자막을 별도로 받아 대조했고 executive admin을 CEO로 바꾼 생성문을 정정했다. 원문에는 CEO가 평균보다 조금 높다는 별도의 설명도 있으나 이번 요약에서는 생략했다.

초안 저장 중 Windows 셸의 문자열 인코딩 때문에 제목이 깨진 것을 발견해 UTF-8로 복원했다. 비공개 단계에서 최종 제목과 원고의 정상 저장, 파일과 DB 본문의 완전 일치, 익명 사용자에게 4개 모두 조회되지 않는 것을 검증했다. 공개 후에는 4개 모두 익명 HTTP 200과 사이트맵 포함, 최종 원고와 DB 본문 일치를 다시 확인했다. 공개 전환은 정상 로그인 사용자의 API와 revision 검사를 거쳤다. 설명·키워드는 관리자 작업으로 해당 개발자 계정의 비공개 글만 revision 조건으로 갱신한 후 공개했다.

추가 3회 생성의 OpenAI 사용량 기반 비용 추정 합계는 $0.007039다. metadata+transcript 6회와 영어 자막 확인 1회를 사용했고 Supadata 계정 조회상 사용 27/100, 잔여 73 credits였다. 값은 확인 시점 기준이며 실제 청구서 금액을 뜻하지 않는다.

생성 워커에는 숫자의 단위 보존 지시와 Supadata 선호 언어 `en`을 추가했다. 선호 언어가 없으면 공급자가 다른 언어를 반환할 수 있으므로 자동으로 원문 언어가 보장되는 것은 아니다. Deno 19개 테스트와 배포 인증 probe를 통과하고 워커를 배포했다.

Claude의 독립 원문 대조에서는 Matt Cutts·TypeScript 원고에 사실 불일치가 없다는 답변을 받았다. Tom 원고에는 CEO와 executive admin의 비교를 유지하자는 제안이 있어 한 문장을 보강했다. 단순 생략을 사실 오류로 분류한 심각도에는 동의하지 않지만, 비교를 보존하면 이해에 도움이 된다고 판단했다. Julian 원고에는 불평이 부정적 태도의 또 다른 형태라는 관계를 보존하도록 수정했다. 원문·생성문 전체는 git에 넣지 않고 로컬 Supabase CLI 캐시에만 보관했다. 검수는 사실 정확성의 완전한 보증을 뜻하지 않는다.
