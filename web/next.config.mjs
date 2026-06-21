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
};

export default withNextIntl(nextConfig);
