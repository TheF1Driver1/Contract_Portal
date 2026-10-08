import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/en", "/pricing", "/en/pricing", "/terminos", "/privacidad", "/en/terms", "/en/privacy"],
      disallow: ["/api/", "/dashboard", "/contracts", "/properties", "/tenants", "/expenses", "/reports", "/market", "/watchlist", "/settings", "/profile", "/portal", "/invite"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
