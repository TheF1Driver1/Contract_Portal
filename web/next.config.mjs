/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["docxtemplater", "pizzip"],
    outputFileTracingIncludes: {
      '/api/generate': ['./templates/**'],
    },
  },
  images: {
    remotePatterns: [],
    minimumCacheTTL: 60,
  },
};

export default nextConfig;
