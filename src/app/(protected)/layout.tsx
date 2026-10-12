import { Suspense } from "react";
import { requireUser } from "@/lib/auth";

async function ProtectedContent({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <main>{children}</main>;
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen"><Suspense fallback={null}><ProtectedContent>{children}</ProtectedContent></Suspense></div>;
}
