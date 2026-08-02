import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["docxtemplater", "pizzip", "@react-pdf/renderer"],
    outputFileTracingIncludes: {
      '/api/generate': ['./templates/**'],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.zillowstatic.com" },
      { protocol: "https", hostname: "**.zillow.com" },
    ],
    minimumCacheTTL: 60,
  },
  // Baseline security headers. CSP omitted deliberately — needs per-route testing
  // against inline styles / Supabase / Stripe before it can be enforced safely.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
