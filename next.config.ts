import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// Build stamp shown in the /visit footer (short commit sha · build date), computed
// at build time and inlined into the client bundle via the `env` key below — so it
// can NEVER go stale by hand the way the old `const BUILD = '2026-07-09-a'` did.
// Lets us ask a field-staff user over WhatsApp "what does the footer say?" and tell
// at a glance whether their PWA is on a stale cache. The date is when THIS bundle
// was built (India time) — the staleness signal — not the commit's authored date.
function buildStamp(): string {
  let id = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
  if (!id) {
    // Local/dev build has no Vercel sha — fall back to the local git short sha, else 'dev'.
    try { id = execSync("git rev-parse --short=7 HEAD").toString().trim(); }
    catch { id = "dev"; }
  }
  let date = "";
  try { date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }); }
  catch { /* no ICU in the build image — omit the date rather than fail the build */ }
  return date ? `${id} · ${date}` : id;
}

const nextConfig: NextConfig = {
  env: {
    // Inlined at build time; read in app/visit/page.tsx as process.env.NEXT_PUBLIC_BUILD.
    NEXT_PUBLIC_BUILD: buildStamp(),
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fpwvutdvwnvrunviporz.supabase.co",
      },
      {
        protocol: "https",
        hostname: "pub-4fca72024723498ea61f717d65c985e3.r2.dev",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Fix CORS misconfiguration — was Access-Control-Allow-Origin: *
          { key: "Access-Control-Allow-Origin", value: "https://www.fruitlinktech.in" },
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer policy
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:",
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://api.mapbox.com",
              "img-src 'self' data: https:",
              "media-src 'self' https://pub-4fca72024723498ea61f717d65c985e3.r2.dev",
              "font-src 'self' data:",
              "worker-src 'self' blob:",
              "connect-src 'self' https://api.fruitlinktech.in https://fpwvutdvwnvrunviporz.supabase.co https://api.mapbox.com https://events.mapbox.com https://b2d542f2726cff56a09392fdc78367b6.r2.cloudflarestorage.com https://fruitlink-ad-media.b2d542f2726cff56a09392fdc78367b6.r2.cloudflarestorage.com https://pub-4fca72024723498ea61f717d65c985e3.r2.dev",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
    ];
  },
};
export default nextConfig;
