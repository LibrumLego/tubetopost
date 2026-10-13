import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/shared/header";

export const metadata: Metadata = {
  title: "TubeToPost",
  description: "유튜브 영상을 블로그 글로 변환하는 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <Header />
        {children}
      </body>
    </html>
  );
}
