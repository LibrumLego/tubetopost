"use client";

import { useEffect } from "react";

export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `tubetopost:viewed:${slug}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch(`/api/posts/by-slug/${encodeURIComponent(slug)}/view`, { method: "POST" }).catch(() => {});
  }, [slug]);
  return null;
}
