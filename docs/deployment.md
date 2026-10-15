# 포트폴리오 데모 배포

- 앱: https://tubetopost.vercel.app
- 로그인 없이 보는 검수 글: https://tubetopost.vercel.app/post/exploring-procrastin
- 호스팅: Vercel 프로젝트 `tubetopost`, Node.js 24.x, Next.js 프리셋.
- DB/Auth/워커: 기존 Supabase 프로젝트. 새 DB나 별도 사용자 데이터 복제본을 만들지 않았다.

## 운영 설정

Vercel production에 다음 변수를 설정했다. 값은 문서·로그에 기록하지 않는다.

| 변수 | 역할 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | 브라우저·서버의 Supabase 주소 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | RLS가 적용되는 공개 클라이언트 키 |
| NEXT_PUBLIC_APP_URL | https://tubetopost.vercel.app |
| SUPABASE_SERVICE_ROLE_KEY | 서버 전용 DB 권한 |
| SUPABASE_WORKER_URL | 기존 배포 워커 주소 |
| WORKER_SECRET | 서버와 워커의 공유 인증값 |

서버 전용 키와 worker secret은 Vercel Secret으로 저장했다. OpenAI·Supadata 키는 Edge Function에 있으며 Next.js 배포에는 복사하지 않았다. `.env.local`, `.vercel`, Supabase CLI 캐시는 git에서 제외한다. Vercel CLI가 추가한 로컬 OIDC 토큰도 커밋하지 않는다.

Supabase Auth Site URL은 운영 주소로 바꾸고 운영 `/auth/callback`을 허용 목록에 추가했다. 기존 localhost callback을 유지했다. `supabase config diff`로 변경 두 항목을 확인한 후 push했으며 선언하지 않은 원격 설정은 유지했다.

## 다시 배포하기

GitHub 비공개 저장소 `LibrumLego/tubetopost`를 기존 Vercel 프로젝트에 연결했다. `main`에 push하면 Vercel Git Integration이 production 배포를 시작한다. 별도의 GitHub Actions용 Vercel 토큰을 복제하지 않는다.

```sh
git push origin main
```

Vercel production 환경변수는 기존 설정을 사용한다. 설정을 바꿀 때 secret은 명령행 인자 대신 stdin으로 전달한다. CLI 수동 배포도 가능하다.

```sh
vercel deploy --prod
node scripts/check-demo.mjs
```

`vercel.json`에서 frozen lockfile 설치와 `pnpm lint && pnpm build`를 고정했다. 검사 또는 빌드가 실패하면 새 배포가 production으로 승격되지 않는다. Vercel의 production 도메인은 공개이고 별도의 deployment URL은 Vercel 인증을 요구할 수 있다. 공유에는 위 운영 주소를 사용한다.

이 자동 배포는 Next.js 웹 앱을 대상으로 한다. Supabase DB 마이그레이션과 Edge Function은 기존 별도 배포 절차를 따른다. 현재 운영 환경변수를 production에 설정했으며 PR preview 환경은 별도로 준비해야 한다.

## 공개 글 검수

대상은 개발자 계정으로 생성한 TED 글이다. 원문 자막 전체와 대조해 다음을 수정했다.

- 마감 이틀 전이라는 오류를 사흘 전으로 정정. 90페이지·72시간·두 번의 밤샘을 대조했다.
- 최고의 논문이라는 학교 연락은 실제 사건이 아니라 이어지는 농담임을 명시했다.
- MRI·뇌 그림을 연구 근거로 서술하지 않고 행동을 설명하는 비유로 정리했다.
- 미루기 관련 번역 용어를 통일하고 겹치는 섹션을 합쳤다.
- 강연과 화자를 밝히고 원문 영상 구간 링크, AI 초안 검수 안내를 넣었다.

검수 원고는 [demo-article.md](demo-article.md)에 보관한다. 기존 편집 API와 revision 검사를 통과해 저장하고 공개로 전환했다. 다른 시험 글은 공개 전환하지 않았다.

## 검증

2026-10-15 Vercel production 빌드와 TypeScript 검사, lint 통과. 인증 없는 HTTP 요청으로 홈·로그인·공개 글 200, 원래 운영 주소의 canonical, 단일 H1과 원본 영상 링크를 확인했다. 브라우저에서 공개 글의 검수 안내와 본문 표시를 확인하고 실제 스크린샷을 README에 추가했다.

운영 로그인 화면에서 매직링크를 요청하고 수신 링크를 같은 브라우저에서 열어 운영 `/app` 진입과 개발자 계정 표시를 확인했다.

운영 API에서 TypeScript 변환 요청 201 → 작업 `6f9e46bb-0bd4-4518-a084-5cad65f6f57a`의 done 완료를 확인했다. 결과는 비공개다. 인증 없는 `/api/jobs`는 401이며 `/app`은 Next.js 스트리밍 응답의 로그인 리다이렉트를 확인한다. 스트리밍이 시작된 페이지는 HTTP 200과 meta redirect를 반환할 수 있다.

새 비공개 글은 인증 없는 요청에서 not-found UI와 noindex를 반환하며 제목·본문이 노출되지 않는 것을 확인했다. 이 응답 역시 스트리밍 시작 후에는 HTTP 200일 수 있다.

운영 편집 API에서 새 글의 제목 변경과 원래 제목 복원 요청 모두 200을 확인했다. revision을 순서대로 전달했고 글은 비공개로 유지했다.

참고: [Vercel CLI 배포](https://vercel.com/docs/projects/deploy-from-cli), [환경변수](https://vercel.com/docs/environment-variables). Next.js 설정은 설치된 `node_modules/next/dist/docs`의 배포·환경변수 안내를 확인했다.
