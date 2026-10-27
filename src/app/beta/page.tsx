import Link from "next/link";
import { Suspense } from "react";
import { BetaWindow } from "@/components/shared/beta-window";

export const metadata = { title: "실제 변환 이용 안내 | TubeToPost" };

export default function BetaPage() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-14">
      <h1 className="text-3xl font-bold">실제 변환 이용 안내</h1>
      <p className="leading-relaxed text-muted-foreground">현재는 서비스 개발·배포 경험을 소개하는 포트폴리오로 운영합니다. 로그인 없는 예시 체험은 베타 일정과 관계없이 볼 수 있으며, 실제 신규 변환은 아래 운영 상태와 계정 한도에 따라 제한됩니다.</p>
      <Link href="/demo" className="inline-block font-medium underline underline-offset-4">로그인 없이 데모 체험하기 →</Link>
      <Suspense fallback={null}><BetaWindow /></Suspense>
      <section className="space-y-3 leading-relaxed">
        <h2 className="text-xl font-semibold">영상 내용을 글로 정리해 보세요</h2>
        <p>자막이 있는 20분 이하 유튜브 영상을 대상으로 구현했습니다. 기존 무료 베타 계정은 월 3회 완료 한도였으며, 현재 한도와 신규 변환 가능 여부는 로그인 후 앱에서 확인할 수 있습니다. 실패한 변환은 완료 횟수에서 차감하지 않으며 재시도와 전체 처리량에는 별도 제한이 있습니다.</p>
        <p>베타의 전체 처리 한도에 도달하거나 다른 변환이 진행 중이면 잠시 이용이 제한될 수 있습니다. AI가 만든 초안의 사실과 표현을 원본에서 확인한 뒤 사용해 주세요.</p>
        <p>변환 결과는 기본 비공개입니다. 작성자가 직접 공개를 선택하면 누구나 볼 수 있고 검색에 노출될 수 있습니다.</p>
      </section>
      <section className="space-y-3 leading-relaxed">
        <h2 className="text-xl font-semibold">프로젝트를 더 알아보려면</h2>
        <p>현재는 결제·광고·추가 변환 팩 출시보다 핵심 사용 흐름과 검증 기록을 정리하는 데 집중합니다. 이전 베타와 수익화 검토는 개발 과정의 기록으로 남깁니다.</p>
        <Link href="/project" className="inline-block font-medium underline underline-offset-4">설계와 운영 경험 보기 →</Link>
      </section>
      <section className="space-y-3 leading-relaxed">
        <h2 className="text-xl font-semibold">개선을 위한 사용 측정</h2>
        <p>랜딩·로그인·앱·공개 글 화면의 조회와 유입 경로를 날짜별로 합산합니다. 이 측정에는 IP 주소, 방문자 식별자, 전체 방문 주소와 검색어를 저장하지 않으며, 외부 광고·분석 서비스로 전송하지 않습니다. 같은 브라우저 탭에서 같은 날짜의 화면 종류는 한 번만 집계하도록 기기 내 세션 저장소를 사용합니다. 브라우저의 추적 거부 설정(DNT)이 켜져 있으면 이 조회 집계를 보내지 않습니다.</p>
        <p>가입 계정, 변환 작업·완료·실패, 공급자 사용량과 관심 등록 내용으로 서비스 품질과 비용을 확인합니다. 조회 집계는 고유 방문자 수가 아니며, 관심 등록은 구매나 결제를 뜻하지 않습니다.</p>
      </section>
      <Link href="/" className="inline-block underline underline-offset-4">홈으로</Link>
    </main>
  );
}
