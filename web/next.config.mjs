/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["docxtemplater", "pizzip"],
  },
  images: {
    remotePatterns: [],
    minimumCacheTTL: 60,
  },
};

export default nextConfig;
