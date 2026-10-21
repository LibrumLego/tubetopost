import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    const database = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
    // PPR's static shell requires inline framework scripts. Block script
    // attributes and external origins; sanitization remains the XSS boundary.
    const csp = ["default-src 'self'", `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "script-src-attr 'none'", "style-src 'self' 'unsafe-inline'", "img-src 'self' https://i.ytimg.com data:",
      `connect-src 'self' ${database}`, "font-src 'self'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'"].join("; ");
    return [{ source: "/:path*", headers: [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
    ] }, { source: "/:area(api|app|auth|login)/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        // Preserve CSS Modules' scoped exports instead of rewriting them as global CSS.
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
