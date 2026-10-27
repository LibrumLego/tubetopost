import type { Metadata } from "next";
import { demoMarkdown } from "@/lib/demo-content";
import { renderMarkdown } from "@/lib/markdown";
import { DemoWalkthrough } from "./walkthrough";

export const metadata: Metadata = {
  title: "로그인 없는 데모 | TubeToPost",
  description: "검수한 예시로 영상에서 글까지의 흐름을 살펴보세요. 실제 변환이나 저장은 실행하지 않습니다.",
};

export default function DemoPage() {
  return <DemoWalkthrough html={renderMarkdown(demoMarkdown)} />;
}
