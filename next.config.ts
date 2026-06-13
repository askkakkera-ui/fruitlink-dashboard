import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fpwvutdvwnvrunviporz.supabase.co",
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
              "default-src \'self\'",
              "script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'",
              "style-src \'self\' \'unsafe-inline\'",
              "img-src \'self\' data: https:",
              "font-src \'self\' data:",
              "connect-src \'self\' https://api.fruitlinktech.in https://fpwvutdvwnvrunviporz.supabase.co",
              "frame-ancestors \'none\'",
            ].join("; "),
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
    ];
  },
};

export default nextConfig;
