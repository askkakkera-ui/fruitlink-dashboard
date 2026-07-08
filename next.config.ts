import type { NextConfig } from "next";
const nextConfig: NextConfig = {
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
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
    ];
  },
};
export default nextConfig;
