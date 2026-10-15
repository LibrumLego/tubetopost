"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { visitPage, visitSource } from "@/lib/beta";

export function BetaTracker() {
  const path = usePathname();
  useEffect(() => {
    const page = visitPage(path);
    if (!page || navigator.doNotTrack === "1") return;
    // Deduplicate per browser tab/day/category; no identifier leaves this device.
    const key = `beta-view:${new Date().toISOString().slice(0, 10)}:${page}`;
    try { if (sessionStorage.getItem(key)) return; } catch { return; }
    void fetch("/api/beta/visit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page, source: visitSource(document.referrer, location.origin) }), keepalive: true,
    }).then((r) => { if (r.ok) sessionStorage.setItem(key, "1"); }).catch(() => {});
  }, [path]);
  return null;
}
